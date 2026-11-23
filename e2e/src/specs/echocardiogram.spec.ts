import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { ECHOCARDIOGRAM_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, obsDisplays } from '../pages/form-widgets';

// echocardiogram.xml: "Echocardiogram" (title "Echocardiogram consultation"), a full form of the Echocardiogram encounter: vital signs (BP, heart rate, murmur, NYHA class),
// the echo study (left / right ventricle, mitral valve, pericardium, inferior vena cava, left ventricle dimension, sPAP), the heart-failure diagnosis category with two extra
// diagnosis checkboxes, "study changed the plan" + comments, and the heart-failure protocol image. Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit
// they created (EntryFormPage), which skips the visit action's gating (_availability.e2e.md: `programs` + `ncd` + `echocardiogram`, Echocardiogram Location, `Task:
// emr.enterNCDConsultNote`). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). It uses the HFE <submit> tag: the button is `#buttons input.submitButton`, there is no `#submit`. who / where / when is EPLD
// (default tag Consult Note Location: the session location Klinik Ekstèn is preselected), so the form is shown (no auto-submit in this form).
//
// Conditions in the form (read by hand: 427 lines, no <when>, toggle, includeIf on data):
//   ifMode VIEW include=false  :45-97 the diagnosis-construct script, :111-117 the <h2> heading, :397-425 the heart-failure protocol section (an image per locale: includeIf
//                              $locale == 'fr' :401 / 'en' :412) and the #buttons row: all absent in VIEW
//   required="true" on the BP (systolic and diastolic), heart rate, murmur, NYHA class, left ventricle systolic function, right ventricle dimension, mitral valve findings,
//                              pericardium, inferior vena cava and NCD category radios, and "study changed the plan": 12 required answers. Left ventricle dimension, sPAP, the
//                              "other" diagnosis text, the two additional diagnoses and the comments are optional
// Scripts :46-95: the focusout / change handlers of `.diagnosis`, `.diagnosis-primary`, `.diagnosis-secondary` (copied from the oncology forms): this form has none of those elements, so
//   the script does nothing here (V3). No validation of the values (BP / heart rate ranges are not checked), no derived value.
// Side effects on save: none (no program, order or postSubmissionAction). The two additional diagnoses are obsgroups of PIH:Visit Diagnoses with showIfEmpty="false".
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type fdee591e: templateModelUrl with no definitionUiResource, so the form the
//   encounter was saved with; longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#echocardiogram.xml
//   V1 Low :287 "Dilitation" (tested, test.fixme), V2 Low :15/:190 duplicate id "echo" (tested), V3 Low :45-97 dead script (not tested), V4 Info :245 empty answer in a list (not tested)
// Not covered here: the French protocol images (the harness user's locale is English), availability, changing the encounter date, the unchecked-diagnosis cleanup.

const FORM = 'echocardiogram.xml';
const SAVE = '#buttons input.submitButton';
const PATIENT_AGE = 50;

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = PATIENT_AGE) =>
  createEntryContext({ givenName: 'AutoEcho', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });
const open = async (page: Page, createEntryContext: PihemrFixtures['createEntryContext']) => {
  const context = await newPatient(createEntryContext);
  await EntryFormPage.open(page, FORM, context);
  await expect(page.locator(SAVE)).toBeVisible();
  return context;
};

// The rows of the vitals table and of the echo study table, by position (the labels are message codes; the radios inside a row are found by their label text).
const vitalsRow = (page: Page, n: number) => page.locator('#vitals table tr').nth(n);
const studyRow = (page: Page, n: number) => page.locator('#echo-study table tr').nth(n);
const VITALS = { bp: 0, heartRate: 1, murmur: 2, nyha: 3 };
const STUDY = { ltVentSystolic: 0, rtVentDim: 1, mitral: 2, pericardium: 3, venaCava: 4, ltVentDim: 5, sPAP: 6 };
const pick = (row: ReturnType<typeof vitalsRow>, label: string) => row.getByLabel(label, { exact: true }).check();

interface Answers {
  systolic: string;
  diastolic: string;
  heartRate: string;
  murmur: string;
  nyha: string;
  ltVentSystolic: string;
  rtVentDim: string;
  mitral: string;
  pericardium: string;
  venaCava: string;
  ltVentDim: string | null;
  sPAP: string;
  category: string;
  other: string;
  ischemic: boolean;
  changedPlan: string;
  comments: string;
}
const FULL: Answers = {
  systolic: '128',
  diastolic: '84',
  heartRate: '76',
  murmur: 'Yes',
  nyha: 'II',
  ltVentSystolic: 'Mildly depressed (40-50%)',
  rtVentDim: 'Mildly dilated',
  mitral: 'Suspected stenosis',
  pericardium: 'No pericardial effusion',
  venaCava: 'Moderately dilated',
  ltVentDim: 'Dilitation',
  sPAP: '35',
  category: 'Hypertensive heart disease',
  other: 'Rheumatic fever history',
  ischemic: true,
  changedPlan: 'No',
  comments: 'Repeat the study in six months',
};
const MINIMAL: Answers = { ...FULL, ltVentDim: null, sPAP: '', other: '', ischemic: false, comments: '' };

const fill = async (page: Page, a: Answers) => {
  await page.locator('#bp_systolic input').fill(a.systolic);
  await page.locator('#bp_diastolic input').fill(a.diastolic);
  await page.locator('#heart_rate input').fill(a.heartRate);
  await pick(vitalsRow(page, VITALS.murmur), a.murmur);
  await pick(vitalsRow(page, VITALS.nyha), a.nyha);
  await pick(studyRow(page, STUDY.ltVentSystolic), a.ltVentSystolic);
  await pick(studyRow(page, STUDY.rtVentDim), a.rtVentDim);
  await pick(studyRow(page, STUDY.mitral), a.mitral);
  await pick(studyRow(page, STUDY.pericardium), a.pericardium);
  await pick(studyRow(page, STUDY.venaCava), a.venaCava);
  if (a.ltVentDim) {
    await pick(studyRow(page, STUDY.ltVentDim), a.ltVentDim);
  }
  if (a.sPAP) {
    await studyRow(page, STUDY.sPAP).locator('input[type=text]').fill(a.sPAP);
  }
  await page.locator('#heart_failure').getByLabel(a.category, { exact: true }).check();
  if (a.other) {
    await page.locator('#heart_failure p.side-by-side input[type=text]').fill(a.other);
  }
  if (a.ischemic) {
    await page.locator('#heart_failure').getByLabel('Ischemic cardiomyopathy', { exact: true }).check();
  }
  await pick(page.locator('#final p.side-by-side'), a.changedPlan);
  if (a.comments) {
    await page.locator('#final textarea').fill(a.comments);
  }
};
const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};
const onlyEncounter = async (api: APIRequestContext, patientUuid: string) => {
  const encounters = await getPatientEncounters(api, patientUuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([ECHOCARDIOGRAM_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};
// what the VIEW prints for answers the form labels differently from the concept name (answerCodes): obs display -> text shown
const VIEW_LABELS: Record<string, string> = {
  'Left ventricle dimension: Left ventricular dilatation': 'Dilitation', // answerCodes="Dilitation" (V1)
  'Left ventricle systolic function: Mildly depressed ejection fraction': 'Mildly depressed (40-50%)',
  'NYHA Class: NYHA Class II': 'II',
};

test.describe('echocardiogram', () => {
  test('ENTER shows the heading, who / where / when, the five sections, the protocol image and Save / Cancel; the session location is preselected', async ({
    page,
    createEntryContext,
  }) => {
    // ifMode VIEW include=false :111, :397, :419; includeIf $locale == 'en' :412
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText(/Echocardiogram/);
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#who select option:checked')).toHaveCount(1);
    await expect(page.locator('#where select option:checked')).toHaveCount(1);
    await expect(page.locator('#when input.hasDatepicker')).not.toHaveValue('');
    await expect(page.locator('legend')).toHaveText(['Vital signs', 'Result', 'Diagnosis', 'Other', 'Heart failure protocol']);
    await expect(page.locator('#protocol img')).toHaveCount(1);
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
    // the answers of the pericardium row: the empty entry of its answerConceptIds is not rendered
    await expect(studyRow(page, STUDY.pericardium).locator('input[type=radio]')).toHaveCount(4);
    await expect(studyRow(page, STUDY.ltVentDim).locator('input[type=radio]')).toHaveCount(3);
  });

  test('a blank Save reports the twelve required answers and saves nothing; the optional ones are not flagged', async ({ page, api, createEntryContext }) => {
    // required="true" on twelve obs (header)
    const context = await open(page, createEntryContext);
    await page.locator(SAVE).click();
    await expect(page.locator('span.field-error:visible')).toHaveCount(12);
    await expect(page.locator('span.field-error:visible')).toHaveText(Array(12).fill('Required'));
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    // none of the errors is on an optional field
    for (const id of ['#who', '#where', '#when']) {
      await expect(page.locator(`${id} span.field-error:visible`)).toHaveCount(0);
    }
    await expect(studyRow(page, STUDY.ltVentDim).locator('span.field-error:visible')).toHaveCount(0);
    await expect(studyRow(page, STUDY.sPAP).locator('span.field-error:visible')).toHaveCount(0);
  });

  test('with every required answer filled the minimal encounter is saved: no optional obs, no extra diagnosis', async ({ site, page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext);
    await fill(page, MINIMAL);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders).toHaveLength(1);
    const displays = await obsDisplays(api, encounterUuid);
    expect(displays).toHaveLength(12);
    expect(displays.some((d) => d.includes('visit diagnoses')), 'no diagnosis group without a ticked diagnosis (showIfEmpty=false)').toBeFalsy();
    expect(displays.some((d) => d.includes('left ventricle dimension')), 'the optional radio stays unanswered').toBeFalsy();
  });

  test('saves every answer; EDIT starts from the saved values and a changed answer replaces the old one; VIEW shows them', async ({ page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext);
    await fill(page, FULL);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    expectObs(
      await obsDisplays(api, encounterUuid),
      '128',
      '84',
      '76',
      'mildly depressed',
      'suspected',
      'no pericardial effusion',
      'moderately dilated',
      'left ventricular dilatation',
      '35',
      'hypertensive heart disease',
      'rheumatic fever history',
      'ischemic cardiomyopathy',
      'repeat the study in six months',
    );

    // VIEW on the visit page (the entry has a templateModelUrl without definitionUiResource: the encounter's own form)
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, VIEW_LABELS);
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('128');
    expect(shown).toContain('[X] II');
    expect(shown).toContain('[X] Yes');
    expect(shown).toContain('[X] Mildly depressed (40-50%)');
    expect(shown).toContain('[X] Moderately dilated');
    expect(shown).toContain('[X] Hypertensive heart disease');
    expect(shown).toContain('Rheumatic fever history');
    expect(shown).toContain('Repeat the study in six months');
    // an unselected answer is shown as such, not as a value
    await expect(view.root.locator('.value', { hasText: '[X] Very low' })).toHaveCount(0);
    await expect(view.root.locator('.value', { hasText: '[X] Severe pericardial effusion' })).toHaveCount(0);
    // ifMode VIEW include=false: no buttons, no protocol, no heading of the entry form
    await expect(view.root.locator('#buttons, #protocol, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: saved values are selected / filled
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#bp_systolic input')).toHaveValue(FULL.systolic);
    await expect(vitalsRow(page, VITALS.nyha).getByLabel('II', { exact: true })).toBeChecked();
    await expect(studyRow(page, STUDY.venaCava).getByLabel('Moderately dilated', { exact: true })).toBeChecked();
    await expect(studyRow(page, STUDY.sPAP).locator('input[type=text]')).toHaveValue(FULL.sPAP);
    await expect(page.locator('#heart_failure').getByLabel('Ischemic cardiomyopathy', { exact: true })).toBeChecked();
    await expect(page.locator('#heart_failure p.side-by-side input[type=text]')).toHaveValue(FULL.other);
    await expect(page.locator('#final textarea')).toHaveValue(FULL.comments);
    // change an answer and a number, untick the extra diagnosis
    await vitalsRow(page, VITALS.nyha).getByLabel('III', { exact: true }).check();
    await studyRow(page, STUDY.sPAP).locator('input[type=text]').fill('42');
    await page.locator('#heart_failure').getByLabel('Ischemic cardiomyopathy', { exact: true }).uncheck();
    await save(page);
    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, '42', 'nyha class iii');
    expect(after.some((d) => d.includes('nyha class ii') && !d.includes('nyha class iii')), 'the old NYHA answer is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('ischemic cardiomyopathy')), 'the unticked diagnosis is gone').toBeFalsy();
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    expect((await view2.valueTexts()).join(' | ')).toContain('[X] III');
  });

  // Dilitation: V1 of pihemr _findings.e2e.md#echocardiogram.xml. Intended: the left ventricle dimension answer reads "Dilatation" (or its message code), like the other rows' "dilated".
  test.fixme('echocardiogram V1: the left ventricle dimension answer is spelled "Dilatation"', async ({ page, createEntryContext }) => {
    // remove test.fixme() when the label is fixed (answerCodes="Dilitation,..." is shown literally)
    await open(page, createEntryContext);
    await expect(studyRow(page, STUDY.ltVentDim).getByLabel('Dilatation', { exact: true })).toHaveCount(1);
  });

  test('V2: the id "echo" is on both the <htmlform> and the study table container (duplicate id in the rendered form)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('[id="echo"]')).toHaveCount(2);
  });
});
