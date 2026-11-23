import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { NCD_FOLLOWUP_ENCOUNTER_TYPE_UUID, NCD_INITIAL_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { expectObs, isoDate, obsDisplays, pickDate, viewDate } from '../pages/form-widgets';

// section-ncd.xml (pihemr, v2.0): "NCD": NCD information (program enrolment + clinical status workflow state, awareness / prior treatment / control
// questions for the initial visit, disease categories), waist/hip vitals with a computed ratio, one block per category (hypertension, diabetes,
// respiratory, epilepsy, heart failure, other), the plan questions and the return visit date. On the visit page it is the `pihcore-ncd` section of
// NCD initial and NCD followup (also of the 0.5 form versions, not tested); the specs create the parent encounter over REST and open the section's edit
// URL directly (skips the gating of _availability.e2e.md). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-ncd.inv.md). INITIAL = NCD Initial Consult (ae06d311), FOLLOWUP = NCD Followup Consult (5cbfd6a2):
//   includeIf INITIAL :153   the awareness / prior-treatment / controlled-at-initial-visit radios;   includeIf INITIAL :667   the comorbidities rows of the
//                            respiratory block (rhinitis, GERD, other)
//   includeIf FOLLOWUP :435  hypoglycemia symptoms (diabetes);  :884  "Adherence to appointment day" (plan);  :913  hospitalized since last visit + reason
//   toggle PIH:NCD category :195-:228  the category checkboxes show #htn, #diabetes, #respire, #epilepsy, #heart_failure, #sickle-msg and #other
//                            (toggle matches `#id, .id`); the other three categories (stroke, renal, liver, rehabilitation) have no block
//   includeIf patient.gender == 'F' :358 / != 'F' :379   the diabetes diagnosis radio: females also get "Gestational diabetes" and the gestational treatment text
//   toggle PIH:Fasting :417  shows #fasting-glucose;   when DIAGNOSIS = CIEL:5016 (Cardiomyopathy) :742  shows #cardiomyo (the etiology radio)
//   ifMode VIEW include=false :65, :943  the script and the button rows (Plan, Dx, Sickle, NCD, Next, Save, Cancel);  ifMode VIEW :98  the VIEW-only script
// Scripts: :55 calculateWaistHipRatio(waist, hip) = waist / hip or null;  :66 on ENTER/EDIT load and on change of waist_cm / hip_cm: `#calculated-waist-hip-ratio`
//   = ratio to 2 decimals, blank when either is missing;  :99 the same on VIEW from the rendered values;  setUpNextAndSubmitButtons() (see _shared.e2e.md).
//   `apptDate` (return visit date) is required="true" :938 for both encounter types.
// Side effects on save: enrollInProgram NCD :139 (always, no checkbox) and the clinical-status workflowState (tested); postSubmissionActions
//   CleanDiagnosisConstructAction and CleanPrescriptionConstructAction (pihcore; not exercised beyond saving diagnoses).
// VIEW is tested on the visit page, which shows the section's own VIEW (`pihcore-ncd` has an active templateModelUrl in encounterTypeConfig.js,
//   longTemplate viewSectionWithHtmlFormLong.page): expectViewShowsSavedObs. The VIEW-only ratio script is checked there too.
// Findings: see pihemr _findings.e2e.md#section-ncd
//   V1 Medium :358-:395 the "Type 2 Diabetes requiring insulin" answer is CIEL:165207 ("Insulin dependent type 2 diabetes mellitus") for a female and
//          PIH:12251 ("Type 2 Diabetes requiring insulin") for a male: the same label saves two different concepts by sex (TESTED, test.fixme).
//          Fix: the same answer concept in both lists.
// Not covered here: #next and the four nextSection buttons (navigation of the visit page), the 0.5 form versions' reduced section list, every
//   individual checkbox of the category blocks (one or two per block are saved), the print-only datestamps block (:122).

const FORM = 'section-ncd.xml';
const SAVE = '#submit';
// The program workflow state "Non contrôlé" ("Not controlled") of section-ncd.xml's workflowState dropdown; the option's value is the state uuid.
const NOT_CONTROLLED_STATE_UUID = '51579fde-bf3a-11e7-abc4-cec278b6b50a';

const open = async (
  page: Page,
  create: (o: { encounterTypeUuid: string; patient: { givenName: string; familyName: string; gender: 'M' | 'F'; birthdate: string } }) => Promise<SectionEncounter>,
  type = NCD_INITIAL_ENCOUNTER_TYPE_UUID,
  gender: 'M' | 'F' = 'F',
) => {
  const section = await create({ encounterTypeUuid: type, patient: { givenName: 'AutoNcd', familyName: 'Tester', gender, birthdate: birthdateYearsAgo(50) } });
  await SectionFormPage.openEdit(page, FORM, section);
  return section;
};
const save = async (page: Page) => {
  await new SectionFormPage(page, FORM).save();
  await new SectionFormPage(page, FORM).expectSaved();
};
const category = (page: Page, label: string) => page.locator('#ncd_info').getByLabel(label, { exact: true });
// a yes / no radio question, found by a part of its text
const question = (page: Page, text: string) => page.locator('p.radio, div', { hasText: text }).last();

test.describe('section-ncd', () => {
  test('under NCD initial: the awareness questions and the comorbidities are offered, the follow-up questions are not', async ({ page, createSectionEncounter }) => {
    // includeIf INITIAL :153, :667; FOLLOWUP :435, :884, :913 (state "initial")
    await open(page, createSectionEncounter);
    await expect(page.locator('#ncd_info')).toContainText('was the patient aware of their chronic disease');
    await expect(page.locator('#ncd_info')).toContainText('was the patient treated for their chronic disease');
    await expect(page.locator('#ncd_info')).toContainText('controlled during the initial NCD clinic visit');
    await expect(page.locator('#respire')).toContainText('Comorbidities');
    await expect(page.locator('#diabetes')).not.toContainText('Hypoglycemia');
    await expect(page.locator('#ncd_plan')).not.toContainText('Adherence to appointment day');
    await expect(page.locator('#ncd_plan')).not.toContainText('Hospitalized since last visit');
    await expect(page.locator('#apptDate')).toHaveCount(1);
  });

  test('under NCD followup: the follow-up questions are offered, the awareness questions and the comorbidities are not', async ({ page, createSectionEncounter }) => {
    // includeIf FOLLOWUP :435, :884, :913 and INITIAL :153, :667 (state "followup")
    await open(page, createSectionEncounter, NCD_FOLLOWUP_ENCOUNTER_TYPE_UUID);
    await expect(page.locator('#diabetes')).toContainText('Hypoglycemia');
    await expect(page.locator('#ncd_plan')).toContainText('Adherence to appointment day');
    await expect(page.locator('#ncd_plan')).toContainText('Hospitalized since last visit');
    await expect(page.locator('#ncd_info')).not.toContainText('was the patient aware of their chronic disease');
    await expect(page.locator('#respire')).not.toContainText('Comorbidities');
    await expect(page.locator('#apptDate')).toHaveCount(1);
  });

  test('ENTER/EDIT shows the section buttons, Next, Save and Cancel', async ({ page, createSectionEncounter }) => {
    // ifMode VIEW include=false :943
    await open(page, createSectionEncounter);
    for (const id of ['pihcore-plan', 'pihcore-diagnosis', 'pihcore-sickle-cell', 'pihcore-ncd']) {
      await expect(page.locator(`#${id}.nextSection`)).toBeVisible();
    }
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
  });

  test('each disease category shows its own block', async ({ page, createSectionEncounter }) => {
    // toggle PIH:NCD category :195-:228 (every block starts hidden)
    await open(page, createSectionEncounter);
    for (const [label, target] of [
      ['Hypertension', '#htn'],
      ['Diabetes', '#diabetes'],
      ['Respiratory', '#respire'],
      ['Epilepsy', '#epilepsy'],
      ['Heart Failure', '#heart_failure'],
      ['Sickle cell disease', '#sickle-msg'],
      ['Other', '#other'],
    ] as const) {
      await expect(page.locator(target), `${target} starts hidden`).toBeHidden();
      await category(page, label).check();
      await expect(page.locator(target), `${target} after ticking ${label}`).toBeVisible();
      await category(page, label).uncheck();
      await expect(page.locator(target), `${target} after unticking ${label}`).toBeHidden();
    }
    // the categories with no block change nothing
    await category(page, 'Renal failure').check();
    await expect(page.locator('#htn')).toBeHidden();
  });

  test('the cardiomyopathy etiology shows only while Cardiomyopathy is ticked; the fasting glucose only while the fasting box is ticked', async ({ page, createSectionEncounter }) => {
    // when :742, toggle :417
    await open(page, createSectionEncounter);
    await category(page, 'Heart Failure').check();
    await category(page, 'Diabetes').check();
    await expect(page.locator('#cardiomyo')).toBeHidden();
    await page.locator('#heart_failure').getByLabel('Cardiomyopathy', { exact: true }).check();
    await expect(page.locator('#cardiomyo')).toBeVisible();
    await page.locator('#heart_failure').getByLabel('Cardiomyopathy', { exact: true }).uncheck();
    await expect(page.locator('#cardiomyo')).toBeHidden();
    await expect(page.locator('#fasting-glucose')).toBeHidden();
    await page.locator('#diabetes').getByLabel('(no food in last 8 hours)').check();
    await expect(page.locator('#fasting-glucose')).toBeVisible();
    await page.locator('#diabetes').getByLabel('(no food in last 8 hours)').uncheck();
    await expect(page.locator('#fasting-glucose')).toBeHidden();
  });

  test('the waist/hip ratio is computed from the two measurements', async ({ page, createSectionEncounter }) => {
    // script :66-:90
    await open(page, createSectionEncounter);
    const ratio = page.locator('#calculated-waist-hip-ratio');
    await expect(ratio).toHaveText('');
    await page.locator('#waist_cm input').fill('90');
    await page.locator('#waist_cm input').press('Tab');
    await expect(ratio, 'one measurement is not enough').toHaveText('');
    await page.locator('#hip_cm input').fill('100');
    await page.locator('#hip_cm input').press('Tab');
    await expect(ratio).toHaveText('0.90');
    await page.locator('#hip_cm input').fill('');
    await page.locator('#hip_cm input').press('Tab');
    await expect(ratio).toHaveText('');
  });

  test('the diabetes diagnoses offer gestational diabetes to a female patient only', async ({ page, createSectionEncounter }) => {
    // includeIf :358 (F) and :379 (not F)
    await open(page, createSectionEncounter, NCD_INITIAL_ENCOUNTER_TYPE_UUID, 'F');
    await expect(page.locator('#diabetes').getByLabel('Gestational diabetes')).toHaveCount(1);
    await expect(page.locator('#diabetes').getByLabel('Type 2 Diabetes requiring insulin')).toHaveCount(1);
    await open(page, createSectionEncounter, NCD_INITIAL_ENCOUNTER_TYPE_UUID, 'M');
    await expect(page.locator('#diabetes').getByLabel('Gestational diabetes')).toHaveCount(0);
    await expect(page.locator('#diabetes').getByLabel('Type 2 Diabetes requiring insulin')).toHaveCount(1);
  });

  test('saving without the return visit date is refused with "Required"', async ({ page, createSectionEncounter }) => {
    // required="true" on #apptDate
    await open(page, createSectionEncounter);
    await page.locator(SAVE).click();
    await expect(page.locator('#apptDate .field-error')).toHaveText('Required');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
  });

  test.fixme('V1: "Type 2 Diabetes requiring insulin" saves the same concept for a female and a male patient', async ({ page, api, createSectionEncounter }) => {
    // remove test.fixme() when fixed. :358 uses CIEL:165207, :379 uses PIH:12251 for the same label
    const concepts: string[] = [];
    for (const gender of ['F', 'M'] as const) {
      const section = await open(page, createSectionEncounter, NCD_INITIAL_ENCOUNTER_TYPE_UUID, gender);
      await category(page, 'Diabetes').check();
      await page.locator('#diabetes').getByLabel('Type 2 Diabetes requiring insulin').check();
      await pickDate(page.locator('#apptDate input[readonly]'), isoDate(14));
      await save(page);
      const res = await api.get(`obs?encounter=${section.encounter.uuid}&v=custom:(display,concept:(display),value:(uuid,display))&limit=100`);
      const obs = (await res.json()).results as Array<{ concept: { display: string }; value: { uuid: string } | null }>;
      const dx = obs.find((o) => o.concept.display === 'Diagnosis' && o.value && typeof o.value === 'object');
      expect(dx, 'a diagnosis obs was saved').toBeTruthy();
      concepts.push(dx!.value!.uuid);
    }
    expect(concepts[0]).toBe(concepts[1]);
  });

  test('saves under NCD initial: information, categories and their blocks, plan; enrols in NCD with the chosen state; EDIT and VIEW show them', async ({ page, api, createSectionEncounter }) => {
    test.slow();
    const APPT = isoDate(30);
    const section = await open(page, createSectionEncounter);
    await page.locator('#ncd_info select').first().selectOption(NOT_CONTROLLED_STATE_UUID); // workflowState: the form's own labels are French in every locale, so select by the state's uuid (the option value)
    await page.locator('#ncd_info p.radio').nth(0).getByLabel('yes').check(); // aware
    await page.locator('#ncd_info p.radio').nth(1).getByLabel('no').check(); // prior treatment
    for (const label of ['Hypertension', 'Diabetes', 'Respiratory', 'Epilepsy', 'Heart Failure', 'Other']) {
      await category(page, label).check();
    }
    await page.locator('#waist_cm input').fill('90');
    await page.locator('#hip_cm input').fill('100');
    await page.locator('#hip_cm input').press('Tab');
    await page.locator('#htn').getByLabel('Stage 1 Hypertension (High risk)').check();
    await page.locator('#htn input[type=text]').fill('Check BP monthly');
    await page.locator('#diabetes').getByLabel('Type 2 Diabetes on oral hypoglycemic agents only').check();
    await page.locator('#glucose input').fill('180');
    await page.locator('#diabetes').getByLabel('(no food in last 8 hours)').check();
    await page.locator('#glucose-fasting input').fill('130');
    await page.locator('#respire').getByLabel('Less than once a week').check();
    await page.locator('#respire').getByLabel('Intermittent asthma').check();
    await page.locator('#epilepsy input').fill('3');
    await page.locator('#heart_failure').getByLabel('Cardiomyopathy', { exact: true }).check();
    await page.locator('#cardiomyo').getByLabel('Alcoholic cardiomyopathy').check();
    await page.locator('#heart_failure').getByRole('checkbox', { name: 'Mitral valve stenosis' }).check();
    await page.locator('#heart_failure').getByLabel('NYHA Class II', { exact: true }).check();
    await page.locator('#other').getByLabel('Deep vein thrombosis').check();
    await page.locator('#ncd_plan').getByLabel('yes - good compliance').check();
    await pickDate(page.locator('#apptDate input[readonly]'), APPT);
    await save(page);

    expectObs(
      await obsDisplays(api, section.encounter.uuid),
      'Check BP monthly', 'hypertension', 'diabetes', 'asthma', 'cardiomyopathy', 'mitral', 'deep vein thrombosis', '180', '130', 'nyha',
    );
    const enrolments = await api.get(`programenrollment?patient=${section.patient.uuid}&v=custom:(program:(name),states:(state:(uuid)))`);
    expect(enrolments.ok()).toBeTruthy();
    const enrolled = (await enrolments.json()).results as Array<{ program: { name: string }; states: Array<{ state: { uuid: string } }> }>;
    expect(enrolled.map((e) => e.program.name)).toContain('NCD');
    // workflowState: the chosen state is the program state
    expect(enrolled.flatMap((e) => e.states.map((st) => st.state.uuid))).toContain(NOT_CONTROLLED_STATE_UUID);

    // EDIT starts from the saved values; the diagnoses are back in their own controls (many obsgroups of Visit Diagnoses)
    await SectionFormPage.openEdit(page, FORM, section);
    for (const [label, target] of [['Hypertension', '#htn'], ['Diabetes', '#diabetes'], ['Respiratory', '#respire'], ['Epilepsy', '#epilepsy'], ['Heart Failure', '#heart_failure'], ['Other', '#other']] as const) {
      await expect(category(page, label)).toBeChecked();
      await expect(page.locator(target)).toBeVisible();
    }
    await expect(page.locator('#ncd_info p.radio').nth(0).getByLabel('yes')).toBeChecked();
    await expect(page.locator('#ncd_info p.radio').nth(1).getByLabel('no')).toBeChecked();
    await expect(page.locator('#calculated-waist-hip-ratio')).toHaveText('0.90');
    await expect(page.locator('#htn').getByLabel('Stage 1 Hypertension (High risk)')).toBeChecked();
    await expect(page.locator('#htn').getByLabel('Stage 1 Hypertension (Low risk)')).not.toBeChecked();
    await expect(page.locator('#htn input[type=text]')).toHaveValue('Check BP monthly');
    await expect(page.locator('#diabetes').getByLabel('Type 2 Diabetes on oral hypoglycemic agents only')).toBeChecked();
    await expect(page.locator('#diabetes').getByLabel('Type 1 Diabetes (insulin dependent)')).not.toBeChecked();
    await expect(page.locator('#glucose input')).toHaveValue('180');
    await expect(page.locator('#fasting-glucose')).toBeVisible(); // toggle :417 from the saved value
    await expect(page.locator('#glucose-fasting input')).toHaveValue('130');
    await expect(page.locator('#respire').getByLabel('Less than once a week')).toBeChecked();
    await expect(page.locator('#respire').getByLabel('Intermittent asthma')).toBeChecked();
    await expect(page.locator('#epilepsy input')).toHaveValue('3');
    await expect(page.locator('#cardiomyo')).toBeVisible(); // when :742 from the saved value
    await expect(page.locator('#cardiomyo').getByLabel('Alcoholic cardiomyopathy')).toBeChecked();
    await expect(page.locator('#heart_failure').getByRole('checkbox', { name: 'Mitral valve stenosis' })).toBeChecked();
    await expect(page.locator('#heart_failure').getByLabel('NYHA Class II', { exact: true })).toBeChecked();
    await expect(page.locator('#other').getByLabel('Deep vein thrombosis')).toBeChecked();
    await expect(page.locator('#other').getByLabel('Pulmonary embolism')).not.toBeChecked();
    await expect(page.locator('#ncd_plan').getByLabel('yes - good compliance')).toBeChecked();
    await expect(page.locator('#apptDate input[readonly]')).toHaveValue(viewDate(APPT).replace(/^(\d) /, '0$1 '));

    // VIEW on the visit page
    await page.goto('about:blank');
    // the form labels some answers differently from the concept names (answerCode, the NCD category list), and the diagnosis order is set by
    // CleanDiagnosisConstructAction
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'NCD category: Chronic respiratory disease program': 'Respiratory',
      'Diagnosis order: Secondary': '',
      'Diagnosis: Alcohol-related cardiomyopathy': 'Alcoholic cardiomyopathy',
      'Type of hypertension diagnosis: High risk hypertension': 'Stage 1 Hypertension (High risk)',
    });
    const shown = (await view.valueTexts()).join(' | ');
    for (const text of ['Check BP monthly', '180', '130', viewDate(APPT)]) {
      expect(shown, text).toContain(text);
    }
    await expect(view.root.locator('#calculated-waist-hip-ratio'), 'the VIEW script :98 computes the ratio from the shown values').toHaveText('0.90');
    await expect(view.root.locator('#buttonsTopRow, #buttons, #submit, #next')).toHaveCount(0);
  });

  test('saves under NCD followup: the follow-up questions; EDIT and VIEW show them', async ({ page, api, createSectionEncounter }) => {
    const APPT = isoDate(21);
    const section = await open(page, createSectionEncounter, NCD_FOLLOWUP_ENCOUNTER_TYPE_UUID, 'M');
    await category(page, 'Diabetes').check();
    await page.locator('#diabetes').getByLabel('Type 1 Diabetes (insulin dependent)').check();
    await page.locator('#diabetes p.radio', { hasText: 'Hypoglycemia' }).getByLabel('yes').check();
    await page.locator('#ncd_plan').getByLabel('no - 1-7 days late').check();
    await page.locator('#ncd_plan p.radio', { hasText: 'Hospitalized since last visit' }).getByLabel('yes').check();
    await page.locator('#ncd_plan p.radio', { hasText: 'Hospitalized since last visit' }).locator('input[type=text]').fill('Diabetic ketoacidosis');
    await pickDate(page.locator('#apptDate input[readonly]'), APPT);
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'Diabetic ketoacidosis', 'hypoglycemia', 'type 1');
    const enrolments = await api.get(`programenrollment?patient=${section.patient.uuid}&v=custom:(program:(name))`);
    expect(((await enrolments.json()).results as Array<{ program: { name: string } }>).map((e) => e.program.name)).toContain('NCD');

    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#diabetes')).toBeVisible();
    await expect(page.locator('#diabetes').getByLabel('Type 1 Diabetes (insulin dependent)')).toBeChecked();
    await expect(page.locator('#diabetes p.radio', { hasText: 'Hypoglycemia' }).getByLabel('yes')).toBeChecked();
    await expect(page.locator('#ncd_plan').getByLabel('no - 1-7 days late')).toBeChecked();
    await expect(page.locator('#ncd_plan p.radio', { hasText: 'Hospitalized since last visit' }).locator('input[type=text]')).toHaveValue('Diabetic ketoacidosis');

    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'NCD category: Diabetes': 'Diabetes',
      'Diagnosis: Type 1 diabetes mellitus': 'Type 1 Diabetes (insulin dependent)',
      'Diagnosis order: Secondary': '',
      'Appearance at appointment time: Between one and seven days': 'no - 1-7 days late',
    });
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('Diabetic ketoacidosis');
    expect(shown).toContain(viewDate(APPT));
    await expect(view.root.locator('#ncd_info .value', { hasText: 'aware' }), 'no initial-only answers under followup').toHaveCount(0);
  });
});
