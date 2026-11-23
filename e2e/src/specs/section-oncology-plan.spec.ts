import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { NCD_INITIAL_ENCOUNTER_TYPE_UUID, ONCOLOGY_INTAKE_CONSULT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { addMedication, expectObs, isoDate, obsDisplays, pickDate, pickerDate, viewDate } from '../pages/form-widgets';
import { specFacts } from '../spec-facts';

// section-oncology-plan.xml (pihemr, v3.0): "Oncology Plan": radiology/pathology pointers + "other tests" text/date, ECOG and ZLDSI scores (two obsgroups),
// psychosocial referral, diagnosis (coded diagnoses, non-coded diagnosis, clinical note, enrolment in the Oncology program), clinical management plan,
// medication orders (drug-order-widget-obgyn), lab orders (order widget, format select), assistance table, disposition + comment + return visit date.
// On the visit page it is the `section-oncology-plan` section of the oncologyIntakeConsult encounter (Oncology Initial Consult); the specs create the
// parent encounter over REST and open the section's edit URL directly (skips the gating of _availability.e2e.md). The form uses the HFE <submit> tag:
// there is no #submit, the button is `#buttons input.submitButton`. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-oncology-plan.inv.md):
//   includeIf !radiology component :101   Chest X-ray checkbox + "other" autocomplete; includeIf radiology :119 "Radiology: order with other form";
//                                         includeIf pathologyTracking :127 "Pathology: order with other form". zl-ci has both components ON, so only the
//                                         :119 and :127 arms are seen (the :101 arm is not tested)
//   toggle PIH:20580 checkbox   :203   shows #nonCodedDiagnosis
//   includeIf encounterType not NCD initial/followup :402   the return visit date (#apptDate); NCD encounters have none. Oncology (the only parent on
//                                         the visit page) is the "not NCD" arm; the NCD arm is opened under an NCD initial encounter by direct URL
//   ifMode VIEW include=false :8, :66, :90, :414   styles, the validation script, the <h1>, the #buttons row; absent in VIEW
// Scripts :67-86 getBeforeValidation: a disposition picked while one of its visible fields (ward, site, location, death date) is empty ->
//   "Please fill out all fields associated with the selected disposition" and the save is stopped.
// Side effects on save: postSubmissionAction ApplyDispositionAction :5 (a Discharge leaves the visit open; Admission/Death/Transfer not saved);
//   enrollInProgram Oncology :218 (checkbox, tested); one drug order (voided with the encounter); lab orders (the `order` widget, :255) are not saved.
// VIEW is tested on the visit page, which shows the section's own VIEW (`section-oncology-plan` has an active templateModelUrl in
//   encounterTypeConfig.js, longTemplate viewSectionWithHtmlFormLong.page): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-oncology-plan
//   V1 Low :229 id="clinical-management-plan" is on both the <section> and the <obs> (same as section-plan V2); and the drug and lab order widgets both
//          render id="order-action-button-NEW": duplicate ids in the rendered form.
// Not covered here: the radiology-off arm (:101), lab orders, drug order revise / renew / discontinue, Death / Transfer / Admission dispositions that
//   succeed, #apptDate error cases, the ECOG 0-5 range message (HFE number check).

const FORM = 'section-oncology-plan.xml';
const SAVE = '#buttons input.submitButton';
const patient = { givenName: 'AutoOncPlan', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(45) };

const open = async (page: Page, create: (o: { encounterTypeUuid: string; patient: typeof patient }) => Promise<SectionEncounter>, type = ONCOLOGY_INTAKE_CONSULT_ENCOUNTER_TYPE_UUID) => {
  const section = await create({ encounterTypeUuid: type, patient });
  await page.goto(SectionFormPage.editUrl(FORM, section));
  await expect(page.locator(SAVE)).toBeVisible();
  return section;
};
const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};
const disposition = (page: Page) => page.locator('#disposition select').first();
// the three columns of #misc: ECOG group, ZLDSI group, psychosocial referral
const ecog = (page: Page) => page.locator('#misc .three-columns > div').nth(0);
const zldsi = (page: Page) => page.locator('#misc .three-columns > div').nth(1);
const assistanceRow = (page: Page, label: string) => page.locator('#assistance tr', { hasText: label }).first();

// A drug of the site's formulary (its fact), set before each test.
let DRUG = '';

test.describe('section-oncology-plan', () => {
  test.beforeEach(({ site }) => {
    DRUG = specFacts(site, 'section-oncology-plan').drug;
  });
  test('under oncology: radiology/pathology pointers, the return visit date, heading, Save and Cancel', async ({ page, createSectionEncounter }) => {
    // includeIf :119, :127 (components on at zl-ci), :402 (not NCD), ifMode VIEW include=false :90, :414
    await open(page, createSectionEncounter);
    await expect(page.locator('[id="radiology-pathology.orders"]')).toContainText('Radiology: order with other form');
    await expect(page.locator('[id="radiology-pathology.orders"]')).toContainText('Pathology: order with other form');
    await expect(page.locator('[id="radiology-pathology.orders"] input[type=checkbox]'), 'no Chest X-ray checkbox when radiology is on').toHaveCount(0);
    await expect(page.locator('#apptDate')).toHaveCount(1);
    await expect(page.locator('form#htmlform h1')).toBeVisible();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('#submit')).toHaveCount(0);
  });

  test('under an NCD initial encounter (direct URL) there is no return visit date', async ({ page, createSectionEncounter }) => {
    // includeIf :402, state "NCD"
    await open(page, createSectionEncounter, NCD_INITIAL_ENCOUNTER_TYPE_UUID);
    await expect(page.locator('#apptDate')).toHaveCount(0);
    await expect(page.locator('#disposition-section')).toBeVisible();
  });

  test('the non-coded diagnosis text shows only while its checkbox is ticked', async ({ page, createSectionEncounter }) => {
    // toggle :203
    await open(page, createSectionEncounter);
    const text = page.locator('#nonCodedDiagnosis');
    await expect(text).toBeHidden();
    await page.locator('#diagnosis input[togglehide="nonCodedDiagnosis"]').check();
    await expect(text).toBeVisible();
    await page.locator('#diagnosis input[togglehide="nonCodedDiagnosis"]').uncheck();
    await expect(text).toBeHidden();
  });

  test('Admission without a ward is refused before anything is submitted; Discharge saves and leaves the visit open', async ({ page, api, createSectionEncounter }) => {
    // getBeforeValidation :67
    const section = await open(page, createSectionEncounter);
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
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'disposition');
    const visit = await api.get(`visit/${section.encounter.visitUuid}?v=custom:(stopDatetime)`);
    expect((await visit.json()).stopDatetime).toBeNull();
  });

  test('saves the plan, diagnoses, scores, medication order, assistance and disposition, enrols the patient in Oncology; EDIT and VIEW show them', async ({ page, api, createSectionEncounter }) => {
    test.slow(); // the form is long and the order widget and the visit page are slow
    const RETURN = isoDate(30);
    const ECOG_DATE = isoDate(-3);
    const ZLDSI_DATE = isoDate(-1);
    const section = await open(page, createSectionEncounter);

    await page.locator('#radiology-pathology\\.orders textarea').fill('Bone scan requested');
    await ecog(page).locator('input[type=text]').first().fill('2');
    await pickDate(ecog(page).locator('input[readonly]'), ECOG_DATE);
    await zldsi(page).locator('input[type=text]').first().fill('12');
    await pickDate(zldsi(page).locator('input[readonly]'), ZLDSI_DATE);
    await page.locator('#misc').getByLabel('Yes').check(); // psychosocial referral

    await page.locator('#diagnosis-search').fill('Asthma');
    await page.locator('ul.ui-autocomplete li', { hasText: 'J45.9 Asthma' }).first().click();
    await page.locator('#diagnosis input[togglehide="nonCodedDiagnosis"]').check();
    await page.locator('#nonCodedDiagnosis textarea').fill('Suspected lymphoma');
    await page.locator('#diagnosis textarea').last().fill('Biopsy planned');
    await page.locator('#diagnosis input[type=checkbox][value=true]').check(); // enrollInProgram Oncology
    await page.locator('#clinical-management-plan textarea').fill('Refer to oncology clinic');
    await addMedication(page, DRUG);
    await assistanceRow(page, 'Transport').locator('input[type=checkbox]').nth(0).check(); // received
    await assistanceRow(page, 'Financial').locator('input[type=checkbox]').nth(1).check(); // recommended
    await page.locator('#assistance input[type=text]').first().fill('Housing');
    await disposition(page).selectOption({ label: 'Discharge' });
    await page.locator('#disposition-section input[type=text]:not([readonly])').first().fill('Return in a month');
    await pickDate(page.locator('#apptDate input[readonly]'), RETURN);
    await save(page);

    expectObs(
      await obsDisplays(api, section.encounter.uuid),
      'Bone scan requested', 'Suspected lymphoma', 'Biopsy planned', 'Refer to oncology clinic', 'Housing', 'Return in a month', 'discharge', 'Asthma',
    );
    const enrolments = await api.get(`programenrollment?patient=${section.patient.uuid}&v=custom:(program:(name))`);
    expect(enrolments.ok()).toBeTruthy();
    expect(((await enrolments.json()).results as Array<{ program: { name: string } }>).map((e) => e.program.name)).toContain('Oncology');
    const orders = await api.get(`order?patient=${section.patient.uuid}&v=custom:(action,drug:(display))`);
    expect(((await orders.json()).results as Array<{ drug: { display: string } | null }>).map((o) => o.drug?.display)).toEqual([DRUG]);

    // EDIT starts from the saved values; each score keeps its own date although both groups use the same date concept
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(ecog(page).locator('input[type=text]').first()).toHaveValue('2');
    await expect(zldsi(page).locator('input[type=text]').first()).toHaveValue('12');
    await expect(ecog(page).locator('input[readonly]')).toHaveValue(pickerDate(ECOG_DATE));
    await expect(zldsi(page).locator('input[readonly]')).toHaveValue(pickerDate(ZLDSI_DATE));
    await expect(page.locator('#nonCodedDiagnosis')).toBeVisible();
    await expect(page.locator('#nonCodedDiagnosis textarea')).toHaveValue('Suspected lymphoma');
    await expect(page.locator('#clinical-management-plan textarea')).toHaveValue('Refer to oncology clinic');
    await expect(assistanceRow(page, 'Transport').locator('input[type=checkbox]').nth(0)).toBeChecked();
    await expect(assistanceRow(page, 'Transport').locator('input[type=checkbox]').nth(1)).not.toBeChecked();
    await expect(disposition(page).locator('option:checked')).toHaveText('Discharge');

    // VIEW on the visit page
    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Disposition categories: Discharged': 'Discharge',
      'Socio-economic assistance received: Transport assistance': '',
      'Socio-economic assistance recommended: Financial aid': '',
      // the diagnosis widget prints the diagnosis as plain text (asserted below)
      'Diagnosis: Asthma': '',
      'Diagnosis certainty: Presumed': '',
      'Diagnosis order: Primary': '',
    });
    await expect(view.root.locator('#diagnosis')).toContainText('Asthma [J45.9]');
    // each score is printed with its own date
    await expect(view.root.locator('#misc .three-columns > div').nth(0)).toContainText(new RegExp(`2\\s+Date\\s*${pickerDate(ECOG_DATE)}`));
    await expect(view.root.locator('#misc .three-columns > div').nth(1)).toContainText(new RegExp(`12\\s+Date\\s*${pickerDate(ZLDSI_DATE)}`));
    const shown = (await view.valueTexts()).join(' | ');
    for (const text of ['Bone scan requested', 'Suspected lymphoma', 'Refer to oncology clinic', 'Return in a month', 'Housing', viewDate(RETURN), viewDate(ECOG_DATE), viewDate(ZLDSI_DATE)]) {
      expect(shown, text).toContain(text);
    }
    await expect(view.root.locator('#buttons, input.submitButton, h1')).toHaveCount(0);
  });

  test('VIEW shows only the plan text when only it is saved', async ({ page, api, createSectionEncounter }) => {
    const section = await open(page, createSectionEncounter);
    await page.locator('#clinical-management-plan textarea').fill('Only a plan');
    await save(page);
    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {});
    expect(await view.valueTexts()).toEqual(['Only a plan']);
  });
});
