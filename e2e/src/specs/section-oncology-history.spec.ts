import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { CONSULT_ENCOUNTER_TYPE_UUID, ONCOLOGY_INTAKE_CONSULT_ENCOUNTER_TYPE_UUID, VITALS_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { expectObs, isoDate, obsDisplays, pickDate, pickerDate, viewDate } from '../pages/form-widgets';

// section-oncology-history.xml (pihemr, v1.0): "Oncology History": the most recent vitals of the visit, risk factors (tobacco, alcohol, drugs), HIV
// test / ARV, past medical history, family history of cancer, OB/GYN block (females: gravida/para/abortus/living, contraception, menopause, pregnancy
// with LMP/EDD), chief complaint, presenting history, current medications and referral. On the visit page it is the `section-oncology-history` section of
// the oncologyIntakeConsult encounter; the specs create the parent encounter over REST and open the section's edit URL directly (skips the gating of
// _availability.e2e.md). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-oncology-history.inv.md):
//   includeIf patient.gender == 'F' :615   #obgyn-section (GPAL, contraception, menopause, pregnancy, LMP / EDD)
//   toggle HIV test checkbox (CIEL:164401) :478  shows #hiv-test (test date + result);  when on ARV (CIEL:160119) = Yes :553  shows #art-startdate
//   includeIf $fn.latestObs(CIEL:163722 | 856 | 5497 | 159427) :482-:516  the grey "last HIV rapid test / viral load / CD4 / HIV test" lines, one per
//          existing obs of the patient (any encounter); nothing when the patient has none of them
//   toggle pregnant checkbox (CIEL:5272) :714  target `pregnant` matches no id or class (V1)
//   ifMode VIEW include=false :70, :205, :266, :699, :852   CSS, validation script, <h2>, the EDD script, the #buttons row (Next, Save, Cancel); absent in VIEW
// Scripts: :77-203 (also in VIEW) GET ws/rest/v1/visit/<visit>?v=custom:(encounters:(...obs)) and, for the first Vitals encounter of the visit, fills the "most
//   recent vitals" block (#last_height, #last_weight, #last_bmi = kg / m2 to 1 decimal, temperature, BP, pulse, SpO2, respiratory rate) and shows #lastVitals;
//   :206-264 family / past-history text rule (.medicalHistoryText rows: Cancer, Other, past-history "Other"): text without a ticked member/box -> "Select
//   family member(s)" / "Select checkbox with comment"; a ticked one without text -> "Please specify"; on change and in beforeSubmit (blocks the save);
//   :700-707 mch.js setUpEdd + the two EDD validators for #lastPeriodDate / #edd (shared, see _shared.e2e.md; one test); setUpNextAndSubmitButtons().
// Side effects on save: none (no postSubmissionAction, program, order). Nothing is required.
// VIEW is tested on the visit page, which shows the section's own VIEW (`section-oncology-history` has an active templateModelUrl in
//   encounterTypeConfig.js, longTemplate viewSectionWithHtmlFormLong.page): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-oncology-history
//   V1 Low :714 `toggle="pregnant"` has no target: there is no `#pregnant` or `.pregnant` element, so the LMP / EDD fields are always shown, whether the
//          pregnancy box is ticked or not (section-history wraps them in `#pregnant`).
//   V2 Low :206-264 typing in the "Cancer / Other, specify" text of the family history and then clicking a member's box loses the click: the blur shows
//          "Select family member(s)" and the layout shifts under the pointer (same as section-history V3).
// Not covered here: #next (navigation of the visit page), the HIV rapid-test and generic-HIV-test "last" lines (:487, :516; the viral load and CD4 lines are
//   tested), the EDD validators (shared, see _shared.e2e.md V1).

const FORM = 'section-oncology-history.xml';
const SAVE = '#submit';
const patient: { givenName: string; familyName: string; gender: 'M' | 'F'; birthdate: string } = {
  givenName: 'AutoOncHist',
  familyName: 'Tester',
  gender: 'F',
  birthdate: birthdateYearsAgo(45),
};

const open = async (page: Page, create: (o: { encounterTypeUuid: string; patient: typeof patient }) => Promise<SectionEncounter>, gender: 'F' | 'M' = 'F') => {
  const section = await create({ encounterTypeUuid: ONCOLOGY_INTAKE_CONSULT_ENCOUNTER_TYPE_UUID, patient: { ...patient, gender } });
  await SectionFormPage.openEdit(page, FORM, section);
  return section;
};
const reopen = async (page: Page, section: SectionEncounter) => SectionFormPage.openEdit(page, FORM, section);
const save = async (page: Page) => {
  await new SectionFormPage(page, FORM).save();
  await new SectionFormPage(page, FORM).expectSaved();
};
const conceptUuid = async (api: APIRequestContext, mapping: string): Promise<string> => {
  const res = await api.get(`concept/${mapping}?v=custom:(uuid)`);
  expect(res.ok(), `get concept ${mapping}: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};
// Adds another encounter (30 seconds ago, after the visit's start) with obs to the section's visit.
const addEncounter = async (api: APIRequestContext, section: SectionEncounter, encounterTypeUuid: string, obs: Array<{ concept: string; value: number }>, locationUuid: string) => {
  const res = await api.post('encounter', {
    data: {
      patient: section.patient.uuid,
      encounterType: encounterTypeUuid,
      location: locationUuid,
      encounterDatetime: new Date(Date.now() - 30_000).toISOString(),
      visit: section.encounter.visitUuid,
      obs,
    },
  });
  expect(res.ok(), `create encounter: ${res.status()} ${res.ok() ? '' : (await res.text()).slice(0, 300)}`).toBeTruthy();
};
// A row of a radio question in #risk-factors, found by part of its label.
const riskRow = (page: Page, text: string) => page.locator('#risk-factors p.radio', { hasText: text });
const pmhRow = (page: Page, label: string) => page.locator('.past-medical-history-item', { has: page.locator(`label:text-is("${label}")`) });
const family = (page: Page, id: string, relative: string): Locator => page.locator(`#${id} .relative`, { hasText: relative }).locator('input[type=checkbox]');

test.describe('section-oncology-history', () => {
  test('ENTER/EDIT shows the heading, Next, Save and Cancel; the OB/GYN block only for a female patient', async ({ page, createSectionEncounter }) => {
    // ifMode VIEW include=false :266, :852; includeIf gender F :615
    await open(page, createSectionEncounter);
    await expect(page.locator('form#htmlform h2')).toBeVisible();
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
    await expect(page.locator('#obgyn-section')).toBeVisible();
    await expect(page.locator('#gravidaInput')).toBeVisible();
    await open(page, createSectionEncounter, 'M');
    await expect(page.locator('#obgyn-section')).toHaveCount(0);
    await expect(page.locator('#risk-factors')).toBeVisible();
  });

  test('the HIV test box shows the test date and result; ARV "yes" shows the start date and regimen', async ({ page, createSectionEncounter }) => {
    // toggle :478, when :553
    await open(page, createSectionEncounter);
    await expect(page.locator('#hiv-test')).toBeHidden();
    await page.locator('#hiv-test-checkbox input[type=checkbox]').check();
    await expect(page.locator('#hiv-test')).toBeVisible();
    await page.locator('#hiv-test-checkbox input[type=checkbox]').uncheck();
    await expect(page.locator('#hiv-test')).toBeHidden();
    await expect(page.locator('#art-startdate')).toBeHidden();
    await page.locator('#on-arv').getByLabel('Yes').check();
    await expect(page.locator('#art-startdate')).toBeVisible();
    await page.locator('#on-arv').getByLabel('No').check();
    await expect(page.locator('#art-startdate')).toBeHidden();
  });

  test('family history: text without a member is rejected, a ticked member without text is rejected; Save is blocked until it is fixed', async ({ page, createSectionEncounter }) => {
    // :206-264 (same rule as section-history)
    await open(page, createSectionEncounter);
    const text = page.locator('#familyCancer input[type=text]');
    const error = page.locator('#familyCancer .field-error');
    await expect(error).toBeHidden();
    await text.fill('Lymphoma');
    await text.blur();
    await expect(error).toHaveText('Select family member(s)');
    await family(page, 'familyCancer', 'Mother').check();
    await expect(error).toBeHidden();
    await text.fill('');
    await text.blur();
    await expect(error).toHaveText('Please specify');
    await family(page, 'familyCancer', 'Mother').uncheck();
    await expect(error).toBeHidden();
    // past medical history "Other"
    const pmhError = pmhRow(page, 'Other').locator('.field-error');
    await pmhRow(page, 'Other').locator('input[type=text]').fill('Gout');
    await pmhRow(page, 'Other').locator('input[type=text]').blur();
    await expect(pmhError).toHaveText('Select checkbox with comment');

    // beforeSubmit blocks the save while a rule is broken
    const submits: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/submit.action')) {
        submits.push(r.url());
      }
    });
    await page.locator(SAVE).click();
    await page.waitForTimeout(1000);
    expect(submits).toEqual([]);
    await pmhRow(page, 'Other').locator('input[type=checkbox]').check();
    await save(page);
  });

  test('the most recent vitals of the visit are shown with a computed BMI', async ({ site, page, api, createSectionEncounter }) => {
    // script :77-203
    const section = await open(page, createSectionEncounter);
    await expect(page.locator('#lastVitals')).toBeHidden();
    await addEncounter(api, section, VITALS_ENCOUNTER_TYPE_UUID, [
      { concept: '3ce93b62-26fe-102b-80cb-0017a47871b2', value: 70 }, // weight
      { concept: '3ce93cf2-26fe-102b-80cb-0017a47871b2', value: 170 }, // height
      { concept: '3ce934fa-26fe-102b-80cb-0017a47871b2', value: 120 }, // systolic
      { concept: '3ce93694-26fe-102b-80cb-0017a47871b2', value: 80 }, // diastolic
    ], site.sessionLocationUuid);
    await reopen(page, section);
    await expect(page.locator('#lastVitals')).toBeVisible();
    await expect(page.locator('#last_weight')).toHaveText('70');
    await expect(page.locator('#last_height')).toHaveText('170');
    await expect(page.locator('#last_bmi')).toHaveText('24.2'); // 70 / 1.7^2
    await expect(page.locator('#last_bp_systolic')).toHaveText('120');
    await expect(page.locator('#last_bp_diastolic')).toHaveText('80');
    await expect(page.locator('#last_heart_rate .emptyValue'), 'pulse was not recorded').toHaveCount(1);
  });

  test('the last HIV viral load and CD4 count of the patient are shown, and no line for tests she never had', async ({ site, page, api, createSectionEncounter }) => {
    // includeIf $fn.latestObs :482, :497 (CIEL:856), :507 (CIEL:5497), absent :487 (CIEL:163722)
    const section = await open(page, createSectionEncounter);
    await expect(page.locator('#risk-factors')).not.toContainText('CD4');
    await addEncounter(api, section, CONSULT_ENCOUNTER_TYPE_UUID, [
      { concept: await conceptUuid(api, 'CIEL:856'), value: 1500 },
      { concept: await conceptUuid(api, 'CIEL:5497'), value: 350 },
    ], site.sessionLocationUuid);
    await reopen(page, section);
    const lines = page.locator('#risk-factors i[style*="BBBBBB"]');
    await expect(lines).toContainText('1500');
    await expect(lines).toContainText('350');
    await expect(lines).not.toContainText('rapid');
  });

  test('an LMP fills the EDD and shows the calculated gestational age', async ({ page, createSectionEncounter }) => {
    // mch.js setUpEdd (shared) wired at :700
    await open(page, createSectionEncounter);
    await expect(page.locator('#calculated-edd-and-gestational')).toBeHidden();
    await pickDate(page.locator('#lastPeriodDate input[type=text]'), isoDate(-100));
    await expect(page.locator('#edd input[type=hidden]')).toHaveValue(isoDate(180));
    await expect(page.locator('#calculated-edd-and-gestational')).toBeVisible();
    await expect(page.locator('#calculated-gestational-age-value')).toHaveText(/^14 [123]\/7/);
  });

  test('saves the history, EDIT and VIEW show it', async ({ page, api, createSectionEncounter }) => {
    test.slow();
    const HIV_DATE = isoDate(-60);
    const ARV_DATE = isoDate(-400);
    const LMP = isoDate(-70);
    const section = await open(page, createSectionEncounter);
    await riskRow(page, 'Smokes tobacco').getByLabel('Currently').check();
    await riskRow(page, 'Smokes tobacco').locator('input[type=text]').first().fill('12');
    await riskRow(page, 'Drinks alcohol').getByLabel('Never').check();
    await page.locator('#hiv-test-checkbox input[type=checkbox]').check();
    await pickDate(page.locator('#hiv-test input[readonly]'), HIV_DATE);
    await page.locator('#hiv-test').getByLabel('Positive').check();
    await page.locator('#on-arv').getByLabel('Yes').check();
    await pickDate(page.locator('#art-startdate input[readonly]'), ARV_DATE);
    await page.locator('#art-startdate input[type=text]:not([readonly])').fill('TDF/3TC/DTG');
    await pmhRow(page, 'Diabetes').locator('input[type=checkbox]').check();
    await pmhRow(page, 'Other').locator('input[type=checkbox]').check();
    await pmhRow(page, 'Other').locator('input[type=text]').fill('Gout');
    await family(page, 'breastCancer', 'Mother').check();
    await family(page, 'familyOther', 'Sibling').check(); // before the text: typing first shows the error and shifts the layout under the click (V2)
    await page.locator('#familyOther input[type=text]').fill('Sickle cell');
    await page.locator('#gravidaInput input').fill('3');
    await page.locator('#paraInput input').fill('2');
    await page.locator('#obgyn-section').getByLabel('Condoms').check();
    await page.locator('#obgyn-section').getByLabel('Premenopausal').check();
    await pickDate(page.locator('#lastPeriodDate input[type=text]'), LMP);
    await page.locator('#chief-complaint textarea').fill('Breast lump');
    await page.locator('#presenting-history textarea').fill('Noticed three months ago');
    await page.locator('#chiefComplaint').getByLabel('Patient arrived of own volition').check();
    await page.locator('#chiefComplaint').getByLabel('Primary care').check();
    await save(page);

    expectObs(
      await obsDisplays(api, section.encounter.uuid),
      'Breast lump', 'Noticed three months ago', 'TDF/3TC/DTG', 'Gout', 'Sickle cell', 'Diabetes', 'condom',
    );

    // EDIT starts from the saved values (the when / toggle blocks are open)
    await reopen(page, section);
    await expect(riskRow(page, 'Smokes tobacco').getByLabel('Currently')).toBeChecked();
    await expect(riskRow(page, 'Smokes tobacco').locator('input[type=text]').first()).toHaveValue('12');
    await expect(riskRow(page, 'Drinks alcohol').getByLabel('Never')).toBeChecked();
    await expect(page.locator('#hiv-test')).toBeVisible();
    await expect(page.locator('#hiv-test input[readonly]')).toHaveValue(pickerDate(HIV_DATE));
    await expect(page.locator('#hiv-test').getByLabel('Positive')).toBeChecked();
    await expect(page.locator('#art-startdate')).toBeVisible();
    await expect(page.locator('#art-startdate input[type=text]:not([readonly])')).toHaveValue('TDF/3TC/DTG');
    await expect(pmhRow(page, 'Diabetes').locator('input[type=checkbox]')).toBeChecked();
    await expect(pmhRow(page, 'Asthma').locator('input[type=checkbox]')).not.toBeChecked();
    await expect(pmhRow(page, 'Other').locator('input[type=text]')).toHaveValue('Gout');
    await expect(family(page, 'breastCancer', 'Mother')).toBeChecked();
    await expect(family(page, 'breastCancer', 'Father')).not.toBeChecked();
    await expect(page.locator('#familyOther input[type=text]')).toHaveValue('Sickle cell');
    await expect(family(page, 'familyOther', 'Sibling')).toBeChecked();
    await expect(page.locator('#gravidaInput input')).toHaveValue('3');
    await expect(page.locator('#obgyn-section').getByLabel('Condoms')).toBeChecked();
    await expect(page.locator('#obgyn-section').getByLabel('Premenopausal')).toBeChecked();
    await expect(page.locator('#chief-complaint textarea')).toHaveValue('Breast lump');
    await expect(page.locator('#chiefComplaint').getByLabel('Primary care')).toBeChecked();

    // VIEW on the visit page (the page-load script :77 also runs there)
    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Menstrual status: Premenopausal patient': 'Premenopausal',
      'Type of referring service: Self-refer': 'Patient arrived of own volition',
      'Family history diagnosis: Malignant neoplasm of breast': '', // shown as the row label and the relatives (asserted below)
    });
    const shown = (await view.valueTexts()).join(' | ');
    for (const text of ['Breast lump', 'Noticed three months ago', 'TDF/3TC/DTG', 'Gout', 'Sickle cell', viewDate(HIV_DATE), viewDate(ARV_DATE)]) {
      expect(shown, text).toContain(text);
    }
    await expect(view.root.locator('#breastCancer')).toContainText(/\[X\]\s*Mother/);
    await expect(view.root.locator('#breastCancer')).toContainText(/\[\s*\]\s*Father/);
    await expect(view.root.locator('#buttons, #submit, #next')).toHaveCount(0);
  });
});
