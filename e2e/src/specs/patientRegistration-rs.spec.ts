import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import type { SectionEncounter, SiteSettings } from '../contract';
import { getEncounterLocation, getEncounterObs, getPatientEncounters, getRegistrationLocations } from '../rest';
import { EntryFormPage, RegistrationSummaryPage, SectionFormPage, VISIT_PAGE_URL, buttonsSubmit, openEditWithButtonsSubmit } from '../pages';

// patientRegistration-rs.xml (pihemr's file, used by the ZL and SL configs): "Patient Registration" metadata of the registration encounter: when, who and
// where (encounter date, provider with the Registration clerk role cbfe0b9d, location). It has no obs. The registration summary page shows it as a "most
// recent encounter" widget (editable and creatable) and opens it for editing, so the specs create an empty Patient Registration encounter over REST
// (createSectionEncounter) and open the edit URL directly. That skips the summary-page widget gating (_availability.e2e.md).
//
// Conditions in the form, from documentation inventory (patientRegistration-rs.inv.md):
//   ifMode VIEW include=false  :9, :27, :64   script, h2, Save/Cancel (ENTER/EDIT only)
// Required (HFE): provider (`required="true"` :47) and, as always, the encounter date and location. In EDIT the date and the location are prefilled
//   (from the encounter), so a blank save reports only the provider; in ENTER (the widget's "create") all three are reported.
// Location: the select lists the locations tagged "Registration Location" plus the encounter's current location when it does not carry that tag.
//   The encounter's location is the session location of the harness (createSectionEncounter), which differs per site, so the spec reads it from the
//   encounter instead of naming it.
// Scripts (:10-18): removes the first generated title span of #patientRegistration (tested). :24 `#most-recent-encounter-title` is a hidden
//   placeholder that the registration summary page's widget fills (not covered).
// Side effects on save: none. Encounter type Patient Registration (873f968a).
// Visit-page display: the Patient Registration entry of encounterTypeConfig.js has no templateModelUrl, so the visit page shows no VIEW of
//   this form; the encounter is listed with defaultEncounterLong, which has no row here (the form saves no obs). Nothing to assert there.
// Registration summary page: the "REGISTRATION" widget (coreapps-mostRecentRegistrationSummary, every site; editable and creatable) renders
//   this form in VIEW (getAsHtml): the title "Registered On: <encounter date>" (the widget fills the hidden #most-recent-encounter-title :24),
//   then Date (#encounterDateField), Provider (no id; empty until a provider is saved) and Location (#encounterLocationField), no h2 or
//   #buttons (ifMode VIEW include=false), and an edit pencil to this form. The tests read it through RegistrationSummaryPage.
// Not covered here: the widget's "add" pencil (an encounter-less patient), Cancel, changing the encounter date (HFE's own rule: not before the visit start; the fixture's visit
//   starts a minute before the test).
// Findings: see pihemr _findings.e2e.md#patientRegistration-rs

const FORM = 'patientRegistration-rs.xml';
const PATIENT_REGISTRATION_ENCOUNTER_TYPE_UUID = '873f968a-73a8-4f9c-ac78-9f4778b751b6';
const REGISTRATION_CLERK_ROLE_UUID = 'cbfe0b9d-9923-404c-941b-f048adc8cdc0';

const save = async (page: Page) => {
  await buttonsSubmit(page).click();
};

const provider = (page: Page) => page.locator('#patientRegistration select').first();
const location = (page: Page) => page.locator('#encounterLocationField select');

// Selects the harness user's provider; falls back to the first provider of the list when that name is not offered.
const chooseProvider = async (page: Page, site: SiteSettings): Promise<string> => {
  const name = site.defaultProviderName;
  const labels = (await provider(page).locator('option').allTextContents()).map((t) => t.trim());
  const label = name && labels.includes(name) ? name : labels[1];
  await provider(page).selectOption({ label });
  return label;
};

const openForm = (page: Page, section: SectionEncounter) => openEditWithButtonsSubmit(page, FORM, section);

test.describe('patientRegistration-rs', () => {
  let section: SectionEncounter;

  test.beforeEach(async ({ page, createSectionEncounter }) => {
    section = await createSectionEncounter({
      encounterTypeUuid: PATIENT_REGISTRATION_ENCOUNTER_TYPE_UUID,
      patient: { givenName: 'AutoRegRs', familyName: 'Tester', gender: 'F' },
    });
    await openForm(page, section);
  });

  test('renders the heading, date, provider, location and Save/Cancel, with the generated title span removed', async ({ page }) => {
    // when :9, :27, :64 (ENTER/EDIT)
    await expect(page.locator('h2')).toHaveCount(1);
    await expect(page.locator('input.hasDatepicker')).toBeVisible();
    await expect(provider(page)).toBeVisible();
    await expect(location(page)).toBeVisible();
    await expect(page.locator('#buttons button.cancel')).toBeVisible();
    await expect(page.locator('#patientRegistration span.title')).toHaveCount(0); // script :10-18
    await expect(page.locator('#most-recent-encounter-title')).toBeHidden(); // :24, the summary widget's placeholder
  });

  test("the location select lists the Registration Location locations and the encounter's own location", async ({ page, api, site }) => {
    const tagged = await getRegistrationLocations(api);
    expect(tagged.length).toBeGreaterThan(0);
    const own = await getEncounterLocation(api, section.encounter.uuid);
    const options = (await location(page).locator('option').allTextContents()).map((t) => t.trim()).filter((t) => t && !/^Choose/.test(t));
    // Every option is a tagged location or the encounter's own, and both kinds are offered. (Not an equality: the REST tag filter also lists the Registration Locations of
    // other sites, such as the Klinik MNT, Sante Fanm and Sante Mantal of Cange; the widget offers only those of the session's own site.)
    const allowed = new Set([...tagged, own]);
    expect(options.filter((o) => !allowed.has(o)), 'options that are neither tagged nor the encounter location').toEqual([]);
    expect(options).toContain(own);
    expect(options.filter((o) => tagged.includes(o)).length).toBeGreaterThanOrEqual(site.minRegistrationLocations ?? 1);
    expect((await location(page).locator('option:checked').textContent())?.trim()).toBe(own);
  });

  test('the date is prefilled with the encounter date', async ({ page, api }) => {
    const res = await api.get(`encounter/${section.encounter.uuid}?v=custom:(encounterDatetime)`);
    const date = new Date((await res.json()).encounterDatetime);
    await expect(page.locator('input.hasDatepicker')).toHaveValue(new RegExp(`${date.getFullYear()}`));
  });

  test('saving without a provider shows Required on the provider and does not save', async ({ page }) => {
    // required="true" :47
    await save(page);
    await expect(page.locator('span.field-error:visible')).toHaveText('Required');
    expect(new URL(page.url()).pathname).toMatch(/editHtmlFormWithStandardUi/); // the returnUrl in the query string also contains visit.page
  });

  test('saves the provider with the Registration clerk role and the chosen location, as an encounter without obs', async ({ page, api, site }) => {
    const [target] = await getRegistrationLocations(api);
    const providerName = await chooseProvider(page, site);
    await location(page).selectOption({ label: target });
    await save(page);
    await new SectionFormPage(page, FORM).expectSaved();

    const res = await api.get(
      `encounter/${section.encounter.uuid}?v=custom:(location:(display),obs:(uuid),encounterProviders:(provider:(person:(display)),encounterRole:(uuid)))`,
    );
    expect(res.ok()).toBeTruthy();
    const encounter = await res.json();
    expect(encounter.location.display).toBe(target);
    expect(encounter.obs).toHaveLength(0);
    expect(encounter.encounterProviders).toHaveLength(1);
    expect(encounter.encounterProviders[0].provider.person.display).toBe(providerName);
    // :47 encounterRole="cbfe0b9d-..."
    expect(encounter.encounterProviders[0].encounterRole.uuid).toBe(REGISTRATION_CLERK_ROLE_UUID);

    // Registration summary page: the widget shows the date, the saved provider and the chosen location
    const summary = await RegistrationSummaryPage.open(page, section.patient.uuid);
    const widget = summary.widget('summary');
    await expect(widget.locator('#most-recent-encounter-title')).toBeVisible();
    await expect(summary.value('summary', 'encounterDateField')).toHaveText(/^\d{2} \w{3} \d{4}$/);
    await expect(summary.value('summary', 'encounterLocationField')).toHaveText(target);
    expect((await summary.rows('summary')).Provider.includes(providerName), 'the saved provider is shown').toBe(true);
    for (const gone of ['h2', '#buttons', 'button.submitButton', 'select']) {
      await expect(widget.locator(gone), `${gone} is ENTER/EDIT only`).toHaveCount(0);
    }
    await summary.expectEditLink('summary');
  });

  test('the registration summary page shows the encounter before anything is saved: date and location, no provider; the pencil edits it', async ({
    page,
    api,
  }) => {
    const own = await getEncounterLocation(api, section.encounter.uuid);
    const summary = await RegistrationSummaryPage.open(page, section.patient.uuid);
    await expect(summary.value('summary', 'encounterDateField')).toHaveText(/^\d{2} \w{3} \d{4}$/);
    await expect(summary.value('summary', 'encounterLocationField')).toHaveText(own);
    expect((await summary.rows('summary')).Provider, 'no provider saved').toBe('');
    await summary.clickEdit('summary');
    await expect(provider(page)).toBeVisible();
  });

  test('EDIT: the saved provider and location are selected, and the location can be changed', async ({ page, api, site }) => {
    const tagged = await getRegistrationLocations(api);
    test.skip(tagged.length < 2, 'needs two Registration Location locations');
    const own = await getEncounterLocation(api, section.encounter.uuid);
    const providerName = await chooseProvider(page, site);
    await location(page).selectOption({ label: tagged[0] });
    await save(page);
    await new SectionFormPage(page, FORM).expectSaved();

    await openForm(page, section);
    await expect(provider(page).locator('option:checked')).toHaveText(providerName);
    await expect(location(page).locator('option:checked')).toHaveText(tagged[0]);
    if (!tagged.includes(own)) {
      // the old location was listed only as the encounter's own: it is gone once another one is saved
      await expect(location(page).locator('option').filter({ hasText: new RegExp(`^\\s*${own}\\s*$`) })).toHaveCount(0);
    }
    await location(page).selectOption({ label: tagged[1] });
    await save(page);
    await new SectionFormPage(page, FORM).expectSaved();

    const res = await api.get(`encounter/${section.encounter.uuid}?v=custom:(location:(display))`);
    expect((await res.json()).location.display).toBe(tagged[1]);

    // Registration summary page: the second location and the provider of the first save
    const summary = await RegistrationSummaryPage.open(page, section.patient.uuid);
    await expect(summary.value('summary', 'encounterLocationField')).toHaveText(tagged[1]);
    expect((await summary.rows('summary')).Provider.includes(providerName), 'the saved provider is still shown').toBe(true);
  });
});

// ENTER is the path of the summary widget's "create" (encounter in the current visit): the date, the provider and the location are then required
// (the date is only prefilled in EDIT).
test.describe('patientRegistration-rs ENTER', () => {
  test('a blank save shows Required on the date, provider and location; with all three chosen one encounter without obs is created', async ({
    page,
    api,
    site,
    createEntryContext,
  }) => {
    const context = await createEntryContext({ givenName: 'AutoRegRs', familyName: 'Tester', gender: 'F' });
    await EntryFormPage.open(page, FORM, context);
    await expect(buttonsSubmit(page)).toBeVisible();
    await save(page);
    await expect(page.locator('#patientRegistration span.field-error:visible')).toHaveCount(3); // date (blank in ENTER), provider, location
    expect(await getPatientEncounters(api, context.patient.uuid)).toHaveLength(0);

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).jq('input.hasDatepicker').first().datepicker('setDate', new Date());
    });
    await chooseProvider(page, site);
    await location(page).selectOption({ label: (await getRegistrationLocations(api))[0] });
    await save(page);
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    const encounters = await getPatientEncounters(api, context.patient.uuid);
    expect(encounters.map((e) => e.encounterType.uuid)).toEqual([PATIENT_REGISTRATION_ENCOUNTER_TYPE_UUID]);
    expect(await getEncounterObs(api, encounters[0].uuid)).toHaveLength(0);
  });
});
