import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { COVID19_DISCHARGE_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, isoDate, obsDisplays, pickDate, pickEncounterDiagnosis, programEnrollments, viewDate } from '../pages/form-widgets';
import { getLocationName } from '../rest';

// covid19Discharge.xml: "COVID19 Discharge", the discharge note of the COVID-19 Discharge encounter: COVID-19 status (confirmed / suspected / no) and the encounter diagnoses,
// the therapy received (four Yes / No questions and free text), the ICU / isolation stay (days and dates), the discharge plan (antibiotics and other medications as "Prescription
// construct" groups), the disposition, the condition at discharge, a follow-up plan, comments and a return visit date. Top-level form: the specs open
// enterHtmlFormWithStandardUi inside a visit they created (EntryFormPage), which skips the visit action's gating (_availability.e2e.md: `covid19`, COVID-19 Location,
// `Task: emr.enterCOVID`, the visit has a COVID intake and no COVID discharge: the specs do not create the intake, a direct URL does not need it). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). HFE <submit> tag:
// the button is `#buttons input.submitButton`, there is no `#submit`. who / where / when is EPLD with the location widget overridden to the "COVID-19 Location" tag, which the session
// location Klinik Ekstèn carries: it is preselected and the form is shown (no auto-submit). Required: COVID-19 status (:105), the disposition (:244), the discharge condition (:249).
//
// Conditions in the form, from documentation inventory (covid19Discharge.inv.md):
//   toggle CIEL:165644 (ICU or HDU admission checkbox) :158  shows #icuDetails (days in ICU, admission and discharge dates)
//   ifMode VIEW include=false  :46 script, :86 heading, :286 #buttons: absent in VIEW
// Scripts :47-72 (ENTER and EDIT): getBeforeValidation: a disposition chosen while one of its visible fields (the transfer type, the ward / site, the death date) is still empty ->
//   "fields associated with the disposition" error under the disposition, save stopped; the error is cleared when the disposition changes. (The shared disposition widget's own
//   fields: _shared.e2e.md.)
// Side effects on save: postSubmissionAction ApplyDispositionAction (the tests save only Discharge; Transfer out is only used to hit the validation, Death is never saved) and
//   ExitPatientFromCovidProgramAction: the patient's active COVID-19 enrolment gets a completion date and the outcome of the disposition (tested with an enrolment created over REST and with the enrolment
//   a same-day COVID intake made; without an enrolment nothing happens).
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type 5e82bea0: templateModelUrl with definitionUiResource=covid19Discharge.xml,
//   longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md (section covid19Intake.xml, covid19Followup.xml, covid19Discharge.xml)
//   V2 Low :75 (print stamp) `pih.form.created_on` etc. are not message codes: the hidden print block reads "pih.form.created_on: 12/May/2020" (checked on zl-ci)
// Not covered here: availability (including the "visit holds an intake" and "no discharge yet" rules), the Death and Transfer dispositions (marks the patient dead / transferred),
//   the Admission disposition's ward, changing the encounter date, the diagnosis widget's own behaviour (outpatientConsult / edNote specs).

const FORM = 'covid19Discharge.xml';
const SAVE = '#buttons input.submitButton';

// HFE control ids (`wN` is numbered by position in the form; the form has no demographic conditions, so they are the same for every patient).
const ID = {
  covidConfirmed: '#w8_0',
  covidNo: '#w8_2',
  o2Yes: '#w12_0',
  o2No: '#w12_1',
  nonInvYes: '#w14_0',
  vasopressorNo: '#w16_1',
  antibioticsYes: '#w18_0',
  otherIntervention: '#w20',
  icu: '#w22',
  icuDays: '#w24',
  icuAdmitDate: '#w26-display',
  icuDischargeDate: '#w28-display',
  amoxicillin: '#w30',
  otherAntibiotic: '#w34',
  otherAntibioticComment: '#w35',
  paracetamol: '#w41',
  medsComments: '#w43',
  disposition: '#w45',
  conditionGood: '#w53_0',
  conditionPoor: '#w53_2',
  followupPlan: '#w55',
  comments: '#w57',
  returnDate: '#w59-display',
};

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = 45) =>
  createEntryContext({ givenName: 'AutoCovidDischarge', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });
const open = async (page: Page, createEntryContext: PihemrFixtures['createEntryContext']) => {
  const context = await newPatient(createEntryContext);
  await EntryFormPage.open(page, FORM, context);
  await expect(page.locator(SAVE)).toBeVisible();
  return context;
};
const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};
const onlyEncounter = async (api: APIRequestContext, patientUuid: string) => {
  const encounters = await getPatientEncounters(api, patientUuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([COVID19_DISCHARGE_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};
// An active COVID-19 enrolment that started three days ago, as a COVID intake of an earlier day leaves it (the intake's enrollInProgram); created over REST so the discharge has
// something to exit (the action only closes an enrolment that started on or before the encounter's DAY: see the same-day test).
const enrolInCovid = async (api: APIRequestContext, patientUuid: string, locationUuid: string): Promise<void> => {
  const programs = await api.get('program?q=COVID&v=custom:(uuid,name)');
  expect(programs.ok(), `get program: ${programs.status()}`).toBeTruthy();
  const covid = ((await programs.json()).results as Array<{ uuid: string; name: string }>).find((p) => p.name === 'COVID-19');
  expect(covid, 'the COVID-19 program exists').toBeTruthy();
  const res = await api.post('programenrollment', {
    data: { patient: patientUuid, program: covid!.uuid, dateEnrolled: new Date(Date.now() - 3 * 86_400_000).toISOString(), location: locationUuid },
  });
  expect(res.ok(), `enrol in COVID-19: ${res.status()}`).toBeTruthy();
};
// The comments of the saved obs that have one.
const obsComments = async (api: APIRequestContext, encounterUuid: string): Promise<string[]> => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(comment)&limit=100`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as Array<{ comment: string | null }>).flatMap((o) => (o.comment ? [o.comment] : []));
};
// The required fields of the form, filled with the least: COVID-19 status, a diagnosis, Discharge, the condition.
const fillRequired = async (page: Page) => {
  await page.locator(ID.covidConfirmed).check();
  await pickEncounterDiagnosis(page);
  await page.locator(ID.disposition).selectOption({ label: 'Discharge' });
  await page.locator(ID.conditionGood).check();
};

test.describe('covid19Discharge', () => {
  test('ENTER shows the heading, who / where / when with the session location, the four sections and Save / Cancel; the ICU details are hidden', async ({ api, site, page, createEntryContext }) => {
    // ifMode VIEW include=false :86, :286; toggle :158 (initial state)
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText('COVID-19 Discharge');
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#where select option:checked')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    await expect(page.locator('legend')).toHaveText(['Diagnosis', 'Therapy', 'ICU/Isolation', 'Plan']);
    await expect(page.locator('#icuDetails')).toBeHidden();
    await expect(page.locator(`${ID.disposition} option`)).toHaveText(['', 'Discharge', 'Transfer out of hospital', 'Death']);
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
  });

  test('the location select offers only COVID-19 Locations (the widget override :74)', async ({ page, api, createEntryContext }) => {
    await open(page, createEntryContext);
    const tagged = await (await api.get('location?tag=COVID-19%20Location&v=custom:(uuid)&limit=100')).json();
    const options = await page.locator('#where select option').count();
    expect(options).toBeGreaterThan(1);
    expect(options - 1, 'every option is a tagged location').toBeLessThanOrEqual(tagged.results.length);
  });

  test('a blank Save is refused: COVID-19 status, disposition and discharge condition are "Required", nothing is created', async ({ page, api, createEntryContext }) => {
    // obs CIEL:165793 required :105; encounterDisposition required :244; obs CIEL:159640 required :249
    const context = await open(page, createEntryContext);
    await page.locator(SAVE).click();
    await expect(page.locator('#diagnosis span.field-error').first()).toBeVisible();
    await expect(page.locator('#disposition span.field-error').first()).toBeVisible();
    await expect(page.locator('#plan').getByText(/required/i).first()).toBeVisible();
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
  });

  test('the ICU / HDU box shows the days and the admission and discharge dates, and unticking hides them (toggle :158)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('#icuDetails')).toBeHidden();
    await page.locator(ID.icu).check();
    await expect(page.locator('#icuDetails')).toBeVisible();
    await expect(page.locator(ID.icuDays)).toBeVisible();
    await expect(page.locator(ID.icuAdmitDate)).toBeVisible();
    await expect(page.locator(ID.icuDischargeDate)).toBeVisible();
    await page.locator(ID.icu).uncheck();
    await expect(page.locator('#icuDetails')).toBeHidden();
  });

  test('a disposition whose own field is empty (Transfer out of hospital) is refused with the "fields associated with the disposition" message, and the message goes when the disposition changes', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // getBeforeValidation :47-72; Transfer is only used to hit the validation: nothing is saved
    const context = await open(page, createEntryContext);
    await fillRequired(page);
    await page.locator(ID.disposition).selectOption({ label: 'Transfer out of hospital' });
    await expect(page.locator('#w47')).toBeVisible();
    await page.locator(SAVE).click();
    await expect(page.locator('#disposition .field-error').first()).toContainText(/fill out all fields/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    await page.locator(ID.disposition).selectOption({ label: 'Discharge' });
    await expect(page.locator('#disposition .field-error').first()).toBeHidden();
  });

  test('a minimal Save (the required fields) creates a form-linked encounter and, with no COVID-19 enrolment, enrols nobody', async ({ site, page, api, createEntryContext }) => {
    // ExitPatientFromCovidProgramAction with nothing to exit; ApplyDispositionAction (Discharge)
    const context = await open(page, createEntryContext);
    await fillRequired(page);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    expectObs(await obsDisplays(api, encounterUuid), 'confirmed', 'discharge', 'good');
    expect(await programEnrollments(api, context.patient.uuid), 'the discharge does not enrol').toEqual([]);
  });

  // The real flow, both forms in the same visit: the COVID intake (its enrollInProgram enrols the patient) and then the discharge, which completes that enrolment. (The action only
  // looks at enrolments that started on or before the start of the encounter's day: a same-day enrolment made through the intake form qualifies.)
  test('a discharge on the day of the COVID intake completes the enrolment the intake made', async ({ page, api, createEntryContext }) => {
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, 'covid19Intake.xml', context);
    await expect(page.locator(SAVE)).toBeVisible();
    await page.getByRole('radio', { name: 'Confirmed', exact: true }).check();
    await save(page);
    expect((await programEnrollments(api, context.patient.uuid)).map((e) => e.dateCompleted)).toEqual([null]);

    await EntryFormPage.open(page, FORM, context);
    await expect(page.locator(SAVE)).toBeVisible();
    await fillRequired(page);
    await save(page);
    const enrolled = await programEnrollments(api, context.patient.uuid);
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0].dateCompleted, 'the enrolment of the same day is completed').not.toBeNull();
  });

  test('saves therapy, ICU stay, medications, plan and a return date; the active COVID-19 enrolment is completed; VIEW shows them; EDIT starts from them and a changed answer replaces the old one', async ({
    site,
    page,
    api,
    createEntryContext,
  }) => {
    const context = await open(page, createEntryContext);
    await enrolInCovid(api, context.patient.uuid, site.sessionLocationUuid);
    expect((await programEnrollments(api, context.patient.uuid)).map((e) => e.dateCompleted)).toEqual([null]);

    const returnDate = isoDate(14);
    const admitted = isoDate(-6);
    const left = isoDate(-2);
    await page.locator(ID.covidConfirmed).check();
    // the suggestion reads "<ICD code> <name>": the obs and the VIEW carry the name
    const diagnosis = (await pickEncounterDiagnosis(page)).replace(/^[A-Z]\d[\w.]*\s+/, '');
    await page.locator(ID.o2Yes).check();
    await page.locator(ID.vasopressorNo).check();
    await page.locator(ID.antibioticsYes).check();
    await page.locator(ID.otherIntervention).fill('Prone positioning twice a day');
    await page.locator(ID.icu).check();
    await page.locator(ID.icuDays).fill('4');
    await pickDate(page.locator(ID.icuAdmitDate), admitted);
    await pickDate(page.locator(ID.icuDischargeDate), left);
    await page.locator(ID.amoxicillin).check();
    await page.locator(ID.otherAntibiotic).check();
    await page.locator(ID.otherAntibioticComment).fill('Azithromycin 500 mg');
    await page.locator(ID.paracetamol).check();
    await page.locator(ID.medsComments).fill('Take with food');
    await page.locator(ID.disposition).selectOption({ label: 'Discharge' });
    await page.locator(ID.conditionPoor).check();
    await page.locator(ID.followupPlan).fill('Clinic review in two weeks');
    await page.locator(ID.comments).fill('Family counselled on isolation');
    await pickDate(page.locator(ID.returnDate), returnDate);
    await save(page);

    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(displays, 'confirmed', diagnosis, 'amoxicillin', 'paracetamol', 'other antibiotic', 'take with food', 'discharge', 'poor', 'clinic review in two weeks', 'family counselled on isolation', 'prone positioning twice a day');
    expect((await obsComments(api, encounterUuid)).filter((c) => c === 'Azithromycin 500 mg'), 'the Other antibiotic comment is saved on its obs').toHaveLength(1);
    const therapy = displays.filter((d) => d.includes(': yes') || d.includes(': no'));
    expect(therapy.length, 'the three answered therapy questions (and the ICU box) are saved').toBeGreaterThanOrEqual(3);
    // the discharge completes the active enrolment (ExitPatientFromCovidProgramAction)
    const enrolled = await programEnrollments(api, context.patient.uuid);
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0].dateCompleted, 'the enrolment is completed').not.toBeNull();
    const outcome = await (await api.get(`programenrollment/${enrolled[0].uuid}?v=custom:(outcome:(display))`)).json();
    expect(outcome.outcome?.display, 'the program outcome follows the disposition (Discharge: "Treatment stopped")').toMatch(/stopped/i);

    // VIEW on the visit page
    // the diagnosis widget prints the diagnosis as plain text, not as span.value: its three obs are not looked for among the values (empty label), the text is asserted below
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, {
      'Disposition categories: Discharged': 'Discharge',
      'Diagnosis order: Primary': '',
      'Diagnosis certainty: Presumed': '',
      [`Diagnosis: ${diagnosis}`]: '',
    });
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('[X] Confirmed');
    await expect(view.root).toContainText(diagnosis);
    expect(shown).toContain('[X] Amoxicillin');
    expect(shown).toContain('[X] Paracetamol');
    expect(shown).toContain('[X] Poor');
    expect(shown).toContain('Azithromycin 500 mg');
    expect(shown).toContain('Clinic review in two weeks');
    expect(shown).toContain('Prone positioning twice a day');
    expect(shown).toContain(viewDate(returnDate));
    expect(shown).toContain(viewDate(admitted));
    expect(shown).toContain(viewDate(left));
    // not saved: not shown as a value
    expect(shown).not.toContain('[X] Doxycycline');
    expect(shown).not.toContain('[X] Good');
    await expect(view.root.locator('#buttons, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: the saved values; the ICU block is shown because the box is saved. The `wN` ids after the "Other antibiotic" box are numbered differently in EDIT (the box carries a
    // comment obs there), so the fields below it are found by label / position.
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator(ID.covidConfirmed)).toBeChecked();
    await expect(page.locator(ID.o2Yes)).toBeChecked();
    await expect(page.locator(ID.icu)).toBeChecked();
    await expect(page.locator('#icuDetails')).toBeVisible();
    await expect(page.locator(ID.icuDays)).toHaveValue('4');
    await expect(page.locator(ID.amoxicillin)).toBeChecked();
    await expect(page.getByLabel('Other antibiotic', { exact: true }).locator('xpath=following::input[@type="text"][1]')).toHaveValue('Azithromycin 500 mg');
    await expect(page.getByLabel('Poor', { exact: true })).toBeChecked();
    await expect(page.locator('.two-columns textarea').nth(0)).toHaveValue('Clinic review in two weeks');
    await expect(page.locator('.two-columns textarea').nth(1)).toHaveValue('Family counselled on isolation');
    await page.getByLabel('Good', { exact: true }).check();
    await page.locator(ID.o2No).check();
    await page.locator(ID.amoxicillin).uncheck();
    await save(page);

    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, 'good', 'paracetamol', 'clinic review in two weeks');
    expect(after.some((d) => d.includes('poor')), 'the old condition is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('amoxicillin')), 'the unticked medication is voided').toBeFalsy();
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    const shown2 = (await view2.valueTexts()).join(' | ');
    expect(shown2).toContain('[X] Good');
    expect(shown2).not.toContain('[X] Poor');
    expect(shown2).not.toContain('[X] Amoxicillin');
  });
});
