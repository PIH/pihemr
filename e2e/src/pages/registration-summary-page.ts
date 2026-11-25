import { type Locator, type Page, expect } from '@playwright/test';

// The registration summary page (registrationapp/registrationSummary.page), where a user reads the patient's registration data after the
// registration wizard and where each registration encounter form is opened for editing. The apploader (CustomAppLoaderFactory
// enablePatientRegistration) puts one "most recent encounter" widget (coreapps/encounter/mostRecentEncounter) per patientRegistration-*
// form in its columns: the widget fetches the patient's most recent Patient Registration encounter from
// htmlformentryui viewEncounterWithHtmlForm/getAsHtml with the form named by its `definitionUiResource` and binds the VIEW of that form
// into `.info-body`, under a header with the widget's title and an edit pencil (`i.edit-action`, an inline onclick to the form's
// editHtmlFormWithStandardUi.page with the encounter and the form). So this page is the only place where users see the VIEW of these
// forms (the visit page has no VIEW of them: it lists the Patient Registration encounter with defaultEncounterLong, one row per obs).
//
// In the VIEW every saved obs is a `span.value` (the unanswered ones a `span.emptyValue`) inside the span with the field's id
// (`#contactFirstName`, `#civilStatus`, ...), and each question is a `div` with an `h3` label and a `p` that holds the answer.
export const REGISTRATION_SUMMARY_PATH = '/openmrs/registrationapp/registrationSummary.page';

// The widget of each form, by the id the apploader gives its app (CustomAppLoaderConstants.Apps; the fragment prints it with the dots
// replaced by dashes). Which of them a site shows is set by the apploader: insurance if Haiti or Mexico, contact unless Liberia,
// health center only in Haiti at the CENTRAL site, local address only in Sierra Leone, social and the summary (patientRegistration-rs)
// everywhere. On the Sierra Leone sites (pihsl-emr) only summary, social, contact and localAddress exist; the social form is SL's own copy
// (no religion, place of birth as free text) and `form` names the file the widget opens, the same name in every config.
export const REGISTRATION_SUMMARY_WIDGETS = {
  summary: { id: 'coreapps-mostRecentRegistrationSummary', form: 'patientRegistration-rs.xml' },
  social: { id: 'coreapps-mostRecentRegistrationSocial', form: 'patientRegistration-social.xml' },
  insurance: { id: 'coreapps-mostRecentRegistrationInsurance', form: 'patientRegistration-insurance.xml' },
  contact: { id: 'coreapps-mostRecentRegistrationContact', form: 'patientRegistration-contact.xml' },
  healthCenter: { id: 'coreapps-mostRecentRegistrationHealthCenter', form: 'patientRegistration-healthCenter.xml' },
  localAddress: { id: 'coreapps-mostRecentRegistrationLocalAddress', form: 'patientRegistration-localAddress.xml' },
} as const;
export type RegistrationWidget = keyof typeof REGISTRATION_SUMMARY_WIDGETS;

// The URL of the page, as the clinician dashboard links to it. `patient` is the patient's id or uuid.
export const registrationSummaryPath = (patient: string): string =>
  `${REGISTRATION_SUMMARY_PATH}?patientId=${patient}&appId=registrationapp.registerPatient&returnUrl=${encodeURIComponent(
    `/openmrs/coreapps/clinicianfacing/patient.page?patientId=${patient}&`,
  )}`;

export class RegistrationSummaryPage {
  constructor(readonly page: Page) {}

  // Opens the page and waits until every most-recent-encounter widget that has an encounter has its form bound (the widget first shows a
  // loading placeholder and fills itself from a getAsHtml request; the page never settles for networkidle because of the relationships
  // widget, so this waits for the widgets themselves).
  static async open(page: Page, patient: string): Promise<RegistrationSummaryPage> {
    await page.goto(registrationSummaryPath(patient));
    await page.locator('.most-recent-encounter').first().waitFor();
    await page.waitForFunction(() => {
      const widgets = Array.from(document.querySelectorAll('.most-recent-encounter'));
      // A widget with an encounter has the script that fetches the form; once it has run the body holds an <htmlform>.
      return widgets.every((w) => !w.querySelector('script') || !!w.querySelector('htmlform'));
    });
    return new RegistrationSummaryPage(page);
  }

  // The widget of the form (it exists only where the apploader shows it: use `toHaveCount(0)` to assert that it does not).
  widget(name: RegistrationWidget): Locator {
    return this.page.locator(`#${REGISTRATION_SUMMARY_WIDGETS[name].id}`);
  }

  // The saved value shown for the field with this id (HFE puts the id on the span around the value): a span.value, so an unanswered
  // field (span.emptyValue) does not match.
  value(name: RegistrationWidget, fieldId: string): Locator {
    return this.widget(name).locator(`#${fieldId} span.value`);
  }

  // The answer of each question in the widget, by its label: the text of the question's <p> with whitespace collapsed and the
  // placeholder of an unanswered field left out (so '' for an unanswered question).
  async rows(name: RegistrationWidget): Promise<Record<string, string>> {
    return this.widget(name)
      .locator('.info-body')
      .evaluate((body) => {
        const rows: Record<string, string> = {};
        body.querySelectorAll('h3').forEach((h) => {
          const p = h.nextElementSibling;
          if (p && p.tagName === 'P') {
            const copy = p.cloneNode(true) as Element;
            copy.querySelectorAll('.emptyValue').forEach((e) => e.remove());
            rows[(h.textContent || '').replace(/\s+/g, ' ').trim()] = (copy.textContent || '').replace(/\s+/g, ' ').trim();
          }
        });
        return rows;
      });
  }

  // The widget's pencil. Only a widget whose form is `editable` has it, and the "add" pencil of a creatable one without an encounter
  // is the same element, leading to enterHtmlFormWithStandardUi.page.
  editLink(name: RegistrationWidget): Locator {
    return this.widget(name).locator('.info-header i.edit-action');
  }

  // Where the pencil leads (its inline onclick: `location.href='<url>'`), as a URL object.
  async editUrl(name: RegistrationWidget): Promise<URL> {
    const onclick = (await this.editLink(name).getAttribute('onclick')) ?? '';
    const href = /location\.href='([^']+)'/.exec(onclick)?.[1];
    expect(href, `the edit link of the ${name} widget leads somewhere`).toBeTruthy();
    return new URL(href!, this.page.url());
  }

  // Asserts that the pencil opens the edit page of this form for an encounter (without leaving the page).
  async expectEditLink(name: RegistrationWidget): Promise<void> {
    await expect(this.editLink(name)).toHaveCount(1);
    const url = await this.editUrl(name);
    expect(url.pathname).toMatch(/htmlformentryui\/htmlform\/editHtmlFormWithStandardUi\.page$/);
    expect(url.searchParams.get('definitionUiResource') ?? '').toMatch(new RegExp(`/${REGISTRATION_SUMMARY_WIDGETS[name].form.replace('.', '\\.')}$`));
    expect(url.searchParams.get('encounterId'), 'the pencil edits the registration encounter').toMatch(/^\d+$/);
  }

  // Clicks the pencil, as a user does, and waits for the form's edit page.
  async clickEdit(name: RegistrationWidget): Promise<void> {
    await this.editLink(name).click();
    await this.page.waitForURL(/editHtmlFormWithStandardUi\.page/);
  }
}
