import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { OBGYN_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { addMedication, expectObs, isoDate, obsDisplays, pickDate, viewDate } from '../pages/form-widgets';
import { specFacts } from '../spec-facts';

// section-obgyn-plan.xml (pihemr, v2.0): "OB-GYN Plan V2": type of visit + new/follow-up (both required), procedures (5 autocomplete rows), lab orders
// (pihLabOrder), medication orders (drug-order-widget-obgyn: route limited to oral/topical/vaginal) + remarks, other support (counselling checkboxes,
// treatment status), delivery plan, referral, disposition (encounterDisposition) + comment + return visit date. On the visit page it is the
// `section-obgyn-plan` section of the OB/GYN encounter; the specs create the parent encounter over REST (a female patient) and open the section's edit
// URL directly (skips the gating of _availability.e2e.md). The form uses the HFE <submit> tag: there is no #submit, the button is
// `#buttons input.submitButton`. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-obgyn-plan.inv.md):
//   when CIEL:165309 (counselling checkbox) = CIEL:5622 (Other)  :247  shows #support-freetext (the "Other support" text)
//   when CIEL:159758 (delivery location) = CIEL:1589 (Hospital)  :314  shows #hospital-details (specify hospital)
//   ifMode VIEW include=false :30, :152, :404   the validation script, the <h1>, the #buttons row (Save, Cancel); absent in VIEW
//   no includeIf/excludeIf: the form is the same for every patient and parent encounter
// Scripts :32-146: getBeforeValidation: (1) a disposition picked while one of its visible fields (ward, site, location, death date) is empty ->
//   "Please fill out all fields associated with the selected disposition" and the save is stopped; (2) a medication check on `fieldset.medication` (:40)
//   rows, plus a show-more/less handler for `#medication-2..8`: none of those elements exists in this form (the order widget has its own markup),
//   so that part is dead code (see V2). :145 setUpNextAndSubmitButtons() (unused here: no #next, the page has the <submit> tag instead).
// Side effects on save: postSubmissionAction ApplyDispositionAction (:5): a Discharge leaves the visit open (tested); Admission and Death/Transfer
//   dispositions would admit/mark the patient dead and are not saved. Drug orders: one saved below (voided with the encounter).
// VIEW is tested on the visit page, which shows the section's own VIEW (`section-obgyn-plan` has an active templateModelUrl in
//   encounterTypeConfig.js, longTemplate viewSectionWithHtmlFormLong.page): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-obgyn-plan
//   V1 High :247 every counselling checkbox carries the same <when value=CIEL:5622 thenDisplay=#support-freetext>, so the handlers of the six other
//          boxes hide the target (and clear its text) whenever they run: ticking Hygiene after Other hides "Other support" while Other stays ticked, and
//          on EDIT load the div is shown but its textarea is EMPTY although the obs is saved, and the next Save voids the saved obs (confirmed on zl-ci by saving
//          twice and reading the obs back; both TESTED, test.fixme).
//          Fix: one <obs style=checkbox> per answer without the repeated <when>, or a single handler on the Other box only.
//   V2 Low :40-88, :110-139 the medication validation and show-more/less code select `fieldset.medication`, `#medication-N`, `#show-more-medications-button`,
//          which do not exist: dead code copied from an older plan form.
// Not covered here: pihLabOrder (a lab order cannot be undone except by voiding the encounter), drug order revise / renew / discontinue, Death /
//   Transfer / Admission dispositions that succeed (ApplyDispositionAction), #apptDate error cases.

const FORM = 'section-obgyn-plan.xml';
const SAVE = '#buttons input.submitButton';
const female = { givenName: 'AutoObgynPlan', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(30) };

const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};
const disposition = (page: Page) => page.locator('#disposition select').first();
const checkbox = (page: Page, sectionId: string, label: string) => page.locator(`#${sectionId}`).getByLabel(label, { exact: true });
const countering = (page: Page, id: string) => page.locator(`[id="counsel-${id}"] input[type=checkbox]`);

// A drug of the site's formulary (its fact), set before each test.
let DRUG = '';

test.describe('section-obgyn-plan', () => {
  test.beforeEach(({ site }) => {
    DRUG = specFacts(site, 'section-obgyn-plan').drug;
  });
  let section: SectionEncounter;

  test.beforeEach(async ({ page, createSectionEncounter }) => {
    section = await createSectionEncounter({ encounterTypeUuid: OBGYN_ENCOUNTER_TYPE_UUID, patient: female });
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await expect(page.locator(SAVE)).toBeVisible();
  });

  test('ENTER/EDIT shows the heading, Save and Cancel', async ({ page }) => {
    // ifMode VIEW include=false :30, :152, :404
    await expect(page.locator('form#htmlform h1')).toBeVisible();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('#submit')).toHaveCount(0);
  });

  test('saving with the type of visit and new/follow-up blank is refused with "Required" on both', async ({ page }) => {
    // required="true" on #visit-reason-2 and #intake-or-followup-2
    await page.locator(SAVE).click();
    await expect(page.locator('#visit-reason-2 .field-error')).toHaveText('Required');
    await expect(page.locator('#intake-or-followup-2 .field-error')).toHaveText('Required');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
  });

  test('"Other support" shows while the counselling "Other" box is ticked, and the hospital text for a delivery in hospital', async ({ page }) => {
    // when :247
    const other = page.locator('#support-freetext');
    await expect(other).toBeHidden();
    await countering(page, 'other').check();
    await expect(other).toBeVisible();
    await countering(page, 'other').uncheck();
    await expect(other).toBeHidden();
    // when :314
    const hospital = page.locator('#hospital-details');
    await expect(hospital).toBeHidden();
    await page.locator('#birth-location').getByLabel('Hospital').check();
    await expect(hospital).toBeVisible();
    await page.locator('#birth-location').getByLabel('Home').check();
    await expect(hospital).toBeHidden();
  });

  test.fixme('V1: ticking another counselling box does not hide "Other support" while Other stays ticked', async ({ page }) => {
    // remove test.fixme() when fixed. when :247 is repeated on every counselling checkbox with the same target
    await countering(page, 'other').check();
    await expect(page.locator('#support-freetext')).toBeVisible();
    await countering(page, 'hygiene').check();
    await expect(countering(page, 'other')).toBeChecked();
    await expect(page.locator('#support-freetext')).toBeVisible();
  });

  test.fixme('V1: EDIT shows the saved "Other support" text, and saving again keeps it', async ({ page, api }) => {
    // remove test.fixme() when fixed. On load every counselling checkbox runs the same when :247 (hide, clearing the textarea, unless it holds Other), and
    // the Other box's handler shows the div afterwards: EDIT shows the div EMPTY although the obs is saved, and the next Save voids it.
    await countering(page, 'other').check();
    await page.locator('#support-freetext textarea').fill('Iron supplements');
    await page.locator('#visit-reason-2').getByLabel('Gynecology').check();
    await page.locator('#intake-or-followup-2').getByLabel('New').check();
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'Iron supplements');
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await expect(page.locator('#support-freetext textarea')).toHaveValue('Iron supplements');
    await save(page); // a second Save without touching anything
    expectObs(await obsDisplays(api, section.encounter.uuid), 'Iron supplements');
  });

  test('a disposition with an empty extra field is refused before anything is submitted; Discharge saves and leaves the visit open', async ({ page, api }) => {
    // getBeforeValidation :91 (second rule)
    await page.locator('#visit-reason-2').getByLabel('Gynecology').check();
    await page.locator('#intake-or-followup-2').getByLabel('New').check();
    const submits: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/submit.action')) {
        submits.push(r.url());
      }
    });
    await disposition(page).selectOption({ label: 'Admission' });
    await page.locator(SAVE).click();
    await expect(page.locator('#disposition .field-error').first()).toHaveText('Please fill out all fields associated with the selected disposition');
    await page.waitForTimeout(1000);
    expect(submits).toEqual([]);
    await disposition(page).selectOption({ label: 'Discharge' });
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'disposition');
    const visit = await api.get(`visit/${section.encounter.visitUuid}?v=custom:(stopDatetime)`);
    expect((await visit.json()).stopDatetime).toBeNull();
  });

  test('saves the plan, a medication order and the disposition; EDIT and VIEW show them', async ({ page, api }) => {
    test.slow(); // the form is long and the order widget and the visit page are slow
    const RETURN = isoDate(21);
    await page.locator('#visit-reason-2').getByLabel('Prenatal').check();
    await page.locator('#intake-or-followup-2').getByLabel('Follow-up').check();
    await page.locator('#procedures input.autoCompleteText').first().pressSequentially('Hyst', { delay: 60 });
    await page.locator('ul.ui-autocomplete:visible li', { hasText: /^Hysterectomy$/ }).click();
    await page.locator('#procedures p input[type=text]').fill('Dilatation and curettage');
    await addMedication(page, DRUG);
    await page.locator('#drug-orders textarea').fill('Take with food');
    await countering(page, 'other').check();
    await page.locator('#support-freetext textarea').fill('Iron supplements');
    await page.locator('#other-support').getByLabel('Treatment delayed').check();
    await page.locator('#delivery-plan').getByLabel('Yes').first().check(); // accept CHW
    await page.locator('#birth-location').getByLabel('Hospital').check();
    await page.locator('#hospital-details input').fill('Hopital Universitaire de Mirebalais');
    await checkbox(page, 'referral', 'Nutrition program').check();
    await checkbox(page, 'referral', 'Other').check();
    await page.locator('#referral p input[type=text]').fill('Social worker');
    await disposition(page).selectOption({ label: 'Discharge' });
    await page.locator('#disposition-section input[type=text]:not([readonly])').first().fill('Return in three weeks');
    await pickDate(page.locator('#apptDate input[readonly]'), RETURN);
    await save(page);

    expectObs(
      await obsDisplays(api, section.encounter.uuid),
      'antenatal visit', 're-evaluation', 'Hysterectomy', 'Dilatation and curettage', 'Take with food', 'Iron supplements', 'Treatment postponed',
      'Hopital Universitaire de Mirebalais', 'Return in three weeks', 'discharge',
    );
    const orders = await api.get(`order?patient=${section.patient.uuid}&v=custom:(action,drug:(display),dose,quantity)`);
    expect(orders.ok()).toBeTruthy();
    const list = (await orders.json()).results as Array<{ action: string; drug: { display: string } | null; dose: number; quantity: number }>;
    expect(list).toHaveLength(1);
    expect(list[0].drug?.display).toContain(DRUG.split(',')[0]);
    expect(list[0].dose).toBe(250);

    // EDIT starts from the saved values: the when :247 and :314 targets are shown
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#visit-reason-2').getByLabel('Prenatal')).toBeChecked();
    await expect(page.locator('#intake-or-followup-2').getByLabel('Follow-up')).toBeChecked();
    // (the "Other support" text is not asserted in EDIT: it is emptied on load, V1)
    await expect(countering(page, 'other')).toBeChecked();
    await expect(page.locator('#hospital-details')).toBeVisible();
    await expect(page.locator('#hospital-details input')).toHaveValue('Hopital Universitaire de Mirebalais');
    await expect(page.locator('#referral p input[type=text]')).toHaveValue('Social worker'); // the Other referral's comment (obs comment, not in the obs display)
    await expect(checkbox(page, 'referral', 'Nutrition program')).toBeChecked();
    await expect(checkbox(page, 'referral', 'Psychologist')).not.toBeChecked();
    await expect(disposition(page).locator('option:checked')).toHaveText('Discharge');

    // VIEW on the visit page
    await page.goto('about:blank');
    // the form labels some answers differently from the concept names (answerCodes): Prenatal = Antenatal visit, Follow-up = Re-evaluation,
    // Treatment delayed = Treatment postponed, Nutrition = Nutrition counseling
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Type of outpatient visit: Antenatal visit': 'Prenatal',
      'Visit type: Re-evaluation': 'Follow-up',
      'General treatment status: Treatment postponed': 'Treatment delayed',
      'Type of counseling provided: Nutrition counseling': 'Nutrition',
      'Disposition categories: Discharged': 'Discharge',
    });
    const shown = (await view.valueTexts()).join(' | ');
    for (const text of ['Prenatal', 'Follow-up', 'Hysterectomy', 'Take with food', 'Iron supplements', 'Treatment delayed', 'Social worker', viewDate(RETURN)]) {
      expect(shown, text).toContain(text);
    }
    await expect(view.root.locator('#buttons, input.submitButton, h1')).toHaveCount(0);
  });

  test('VIEW shows only the two required answers when only they are saved', async ({ page, api }) => {
    await page.locator('#visit-reason-2').getByLabel('Gynecology').check();
    await page.locator('#intake-or-followup-2').getByLabel('New').check();
    await save(page);
    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Type of outpatient visit: Gynecology specialty': 'Gynecology',
      'Visit type: New visit': '[X] New',
    });
    expect(await view.valueTexts()).toHaveLength(2);
  });
});
