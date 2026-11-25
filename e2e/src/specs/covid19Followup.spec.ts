import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { COVID19_FOLLOWUP_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, obsDisplays, pickEncounterDiagnosis, programEnrollments } from '../pages/form-widgets';
import { getLocationName } from '../rest';

// covid19Followup.xml: "COVID19 Progress Note", the progress note of the COVID-19 Progress encounter: health condition, signs and symptoms (17 with new / improved / unchanged /
// worse), vital signs, physical exam, treatment (medications, supportive care, IV fluids), the COVID-19 status and diagnoses, lab tests (a specimen row and 23 values), radiology and
// the plan (disposition, clinical management plan, nursing note, mental health referral). Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit they created
// (EntryFormPage), which skips the visit action's gating (_availability.e2e.md: `covid19`, COVID-19 Location, `Task: emr.enterCOVID`, the visit HAS a COVID intake: the specs do not create
// it, a direct URL does not need it). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). HFE <submit> tag: the button is `#buttons input.submitButton`, there is no `#submit`. who / where / when is EPLD with the location
// widget overridden to the "COVID-19 Location" tag, which the session location Klinik Ekstèn carries: it is preselected and the form is shown (no auto-submit). The only required field is
// the COVID-19 status (the disposition is not required here, unlike the discharge form).
//
// Conditions in the form, from documentation inventory (covid19Followup.inv.md):
//   toggle CIEL:165995 oxygen :420 -> #o2therapy; IV fluid :458 -> #ivf; PIH:10745 antibody / antigen / PCR / GeneXpert checkboxes :517-:539 -> #AbTest #AgTest #pcrTest #xpert;
//   PIH:Radiology procedure performed :629 -> #chestXRay #cardioUS #abUS; CIEL:1272 :683 -> #mh-referral
//   includeIf !$config.isComponentEnabled('radiology') :614   the "At HUM, use Radiology order" note; zl-ci has the component, so only the other arm renders (not covered)
//   ifMode VIEW include=false  :43 script, :82 heading, :699 #buttons: absent in VIEW
// Scripts :44-67 (ENTER and EDIT): getBeforeValidation: a disposition chosen while one of its visible fields is empty -> "fields associated with the disposition" error under the
//   disposition, save stopped; the error is cleared when the disposition changes.
// Side effects on save: enrollInProgram COVID-19 (:100, locationTag "Program Location"; its comment says "if the patient hasn't already been enrolled"): the patient is enrolled once, a
//   save for an enrolled patient adds no second enrolment (both tested); postSubmissionAction ApplyDispositionAction (the tests save only Facility quarantine; Transfer out is only used
//   to hit the validation, Death is never saved).
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type ca65f5d3: templateModelUrl with definitionUiResource=covid19Followup.xml,
//   longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md (section covid19Intake.xml, covid19Followup.xml, covid19Discharge.xml)
//   V2 Low :71 (print stamp) `pih.form.created_on` etc. are not message codes: the hidden print block reads "pih.form.created_on: ..." (checked on zl-ci with the discharge form)
// Not covered here: availability (including the "visit holds an intake" rule), the radiology "At HUM" arm, the Death / Transfer dispositions, the 16 other symptom rows and 22 other lab
//   values (same markup as the ones tested), changing the encounter date.

const FORM = 'covid19Followup.xml';
const SAVE = '#buttons input.submitButton';

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = 45) =>
  createEntryContext({ givenName: 'AutoCovidFollowup', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });
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
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([COVID19_FOLLOWUP_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};
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

// The `wN` ids are numbered by position and shift between ENTER and EDIT (the diagnosis widget), so fields are found by label, by their own ids or by position.
const box = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const status = (page: Page, label: string) => page.getByRole('radio', { name: label, exact: true }); // the diagnosis widget adds a "Confirmed" checkbox of its own
// The row (<tr>) of the sign / symptom with this label: its checkbox and its new / improved / unchanged / worse radios.
const symptom = (page: Page, label: string): Locator => page.locator('#history tr', { has: page.getByLabel(label, { exact: true }) });
// The checkbox that precedes the caption of the lab test (the caption has no label of its own: answerCode="").
const testBox = (page: Page, caption: RegExp): Locator => page.locator('#lab strong', { hasText: caption }).first().locator('xpath=preceding::input[@type="checkbox"][1]');
const labValue = (page: Page, label: string): Locator => page.locator('#lab label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().locator('xpath=following::input[1]');
const disposition = (page: Page) => page.locator('#disposition select').first();

test.describe('covid19Followup layout, required field and enrolment', () => {
  test('ENTER shows the heading, who / where / when with the session location, the 8 sections and Save / Cancel; the conditional blocks start hidden', async ({ api, site, page, createEntryContext }) => {
    // ifMode VIEW include=false :82, :699; toggles (initial state)
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText(/COVID-19 Daily Progress/);
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#where select option:checked')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    await expect(page.locator('legend')).toHaveText(['Signs and symptoms', 'Vital signs', 'Physical exam', 'Treatment', 'Diagnosis', 'Lab Tests', 'Radiology order', 'Plan']);
    for (const id of ['#o2therapy', '#ivf', '#mh-referral', '#AbTest', '#AgTest', '#pcrTest', '#xpert', '#chestXRay', '#cardioUS', '#abUS']) {
      await expect(page.locator(id), id).toBeHidden();
    }
    await expect(page.locator('#radiology-orders')).not.toContainText('At HUM'); // includeIf :614: the radiology component is on
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
  });

  test('a blank Save is refused: the COVID-19 status is "Required", nothing is created and the patient is not enrolled', async ({ page, api, createEntryContext }) => {
    // obs CIEL:165793 required="true" :497
    const context = await open(page, createEntryContext);
    await page.locator(SAVE).click();
    await expect(page.locator('#diagnosis span.field-error').first()).toBeVisible();
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    expect(await programEnrollments(api, context.patient.uuid), 'a refused save enrols nobody').toEqual([]);
  });

  test('a minimal Save (COVID-19 status only, no disposition) creates a form-linked encounter in the visit and enrols a patient who is not enrolled (enrollInProgram :100)', async ({
    site,
    page,
    api,
    createEntryContext,
  }) => {
    const context = await open(page, createEntryContext);
    await status(page, 'Confirmed').check();
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    expect(new Date(header.encounterDatetime).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expectObs(await obsDisplays(api, encounterUuid), 'confirmed');
    const enrolled = await programEnrollments(api, context.patient.uuid);
    expect(enrolled.map((e) => e.program.name)).toEqual(['COVID-19']);
    expect(enrolled[0].dateCompleted).toBeNull();
  });

  test('a patient who is already enrolled in COVID-19 is not enrolled a second time', async ({ site, page, api, createEntryContext }) => {
    // enrollInProgram :100 ("if the patient hasn't already been enrolled")
    const context = await open(page, createEntryContext);
    await enrolInCovid(api, context.patient.uuid, site.sessionLocationUuid);
    await status(page, 'Suspected').check();
    await save(page);
    await onlyEncounter(api, context.patient.uuid);
    expect((await programEnrollments(api, context.patient.uuid)).map((e) => e.program.name)).toEqual(['COVID-19']);
  });

  test('a disposition whose own field is empty (Transfer out of hospital) is refused with the "fields associated with the disposition" message, and the message goes when the disposition changes', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // getBeforeValidation :44-67; Transfer is only used to hit the validation: nothing is saved
    const context = await open(page, createEntryContext);
    await status(page, 'Confirmed').check();
    await disposition(page).selectOption({ label: 'Transfer out of hospital' });
    await page.locator(SAVE).click();
    await expect(page.locator('#disposition .field-error').first()).toContainText(/fill out all fields/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    await disposition(page).selectOption({ label: 'Facility quarantine' });
    await expect(page.locator('#disposition .field-error').first()).toBeHidden();
  });
});

test.describe('covid19Followup toggles', () => {
  test('oxygen shows its amount and IV fluid shows the three fluid rows, and unticking hides them (toggles :420, :458)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await box(page, 'Oxygen').check();
    await expect(page.locator('#o2therapy')).toBeVisible();
    await box(page, 'Oxygen').uncheck();
    await expect(page.locator('#o2therapy')).toBeHidden();
    await box(page, 'IV fluid').check();
    await expect(page.locator('#ivf')).toBeVisible();
    await expect(page.locator('#ivf').getByLabel('Normal saline')).toHaveCount(3);
    await box(page, 'IV fluid').uncheck();
    await expect(page.locator('#ivf')).toBeHidden();
  });

  test('each lab test shows its own results, and unticking hides them (toggles :517-:539)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    const tests: Array<[RegExp, string]> = [
      [/antibody/i, '#AbTest'],
      [/antigen/i, '#AgTest'],
      [/PCR/i, '#pcrTest'],
      [/GeneXpert/i, '#xpert'],
    ];
    for (const [caption, target] of tests) {
      await expect(page.locator(target), `${target} starts hidden`).toBeHidden();
      await testBox(page, caption).check();
      await expect(page.locator(target)).toBeVisible();
      for (const [, other] of tests.filter(([, t]) => t !== target)) {
        await expect(page.locator(other), `${other} stays hidden`).toBeHidden();
      }
      await testBox(page, caption).uncheck();
      await expect(page.locator(target)).toBeHidden();
    }
  });

  test('each radiology procedure shows its findings box, and the mental health referral shows its notes (toggles :629, :683)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    for (const [label, id] of [
      ['Chest X-ray', '#chestXRay'],
      ['Cardiac Ultrasound', '#cardioUS'],
      ['Abdominal Ultrasound', '#abUS'],
    ]) {
      await expect(page.locator(id)).toBeHidden();
      await box(page, label).check();
      await expect(page.locator(id)).toBeVisible();
      await box(page, label).uncheck();
      await expect(page.locator(id)).toBeHidden();
    }
    await expect(page.locator('#mh-referral')).toBeHidden();
    await box(page, 'Mental health referral').check();
    await expect(page.locator('#mh-referral')).toBeVisible();
    await box(page, 'Mental health referral').uncheck();
    await expect(page.locator('#mh-referral')).toBeHidden();
  });
});

test.describe('covid19Followup saved data', () => {
  test('saves condition, symptoms with their course, vitals, treatment, diagnosis, a lab test, radiology and the plan; VIEW shows them; EDIT starts from them and a changed answer replaces the old one', async ({
    page,
    api,
    createEntryContext,
  }) => {
    test.setTimeout(90_000);
    const context = await open(page, createEntryContext);
    await page.locator('#intro').getByLabel('Moderate', { exact: true }).check();
    // symptoms: a checkbox with the course of the symptom
    await box(page, 'Fever').check();
    await symptom(page, 'Fever').getByLabel('Worse', { exact: true }).check();
    await box(page, 'Cough').check();
    await symptom(page, 'Cough').getByLabel('Improved', { exact: true }).check();
    // vitals
    await page.locator('#temperature_c input').fill('38.1');
    await page.locator('#heart_rate input').fill('101');
    await page.locator('#respiratory_rate input').fill('24');
    await page.locator('#bp_systolic input').fill('118');
    await page.locator('#bp_diastolic input').fill('76');
    await page.locator('#o2_sat input').fill('92');
    // exam and treatment
    await box(page, 'Awake').check();
    await box(page, 'Dexamethasone').check();
    await box(page, 'Oxygen').check();
    await page.locator('#o2therapy input').first().fill('3');
    // diagnosis
    await status(page, 'Confirmed').check();
    const diagnosis = (await pickEncounterDiagnosis(page)).replace(/^[A-Z]\d[\w.]*\s+/, '');
    // lab: a PCR result and one value
    await testBox(page, /PCR/i).check();
    await page.locator('#pcrTest').getByLabel('Positive', { exact: true }).check();
    await labValue(page, 'CRP').fill('48');
    // radiology and plan
    await box(page, 'Abdominal Ultrasound').check();
    await page.locator('#abUS input').first().fill('Free fluid in the pelvis');
    await disposition(page).selectOption({ label: 'Facility quarantine' });
    await page.locator('#plan textarea').nth(0).fill('Continue steroids, review in 48 hours');
    await page.locator('#plan textarea').nth(1).fill('Patient tolerating oral intake');
    await box(page, 'Mental health referral').check();
    await page.locator('#mh-referral textarea').fill('Panic symptoms at night');
    await save(page);

    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(
      displays,
      'moderate',
      'fever',
      'cough',
      'temperature (c): 38.1',
      'systolic: 118',
      'diastolic: 76',
      'blood oxygen saturation: 92',
      'dexamethasone',
      'confirmed',
      diagnosis,
      'positive',
      'free fluid in the pelvis',
      'continue steroids, review in 48 hours',
      'patient tolerating oral intake',
      'panic symptoms at night',
    );
    expect((await programEnrollments(api, context.patient.uuid)).map((e) => e.program.name)).toEqual(['COVID-19']);

    // VIEW on the visit page
    // answers the form labels with answerCode: the radiology box, the test box (empty label, answerCode="": named by the <strong> next to it) and the disposition
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, {
      'Laboratory test ordered, coded: SARS-CoV-2 RT-PCR': '',
      'Radiology procedure performed: Abdomen (US)': 'Abdominal Ultrasound',
      'Disposition categories: Quarantine institution': 'Facility quarantine',
      'Diagnosis order: Primary': '',
      'Diagnosis certainty: Presumed': '',
      [`Diagnosis: ${diagnosis}`]: '',
    });
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('[X] Moderate');
    expect(shown).toContain('[X] Fever');
    expect(shown).toContain('[X] Worse');
    expect(shown).toContain('[X] Improved');
    expect(shown).toContain('[X] Confirmed');
    expect(shown).toContain('[X] Dexamethasone');
    expect(shown).toContain('Free fluid in the pelvis');
    expect(shown).toContain('Continue steroids, review in 48 hours');
    expect(shown).toContain('Panic symptoms at night');
    await expect(view.root).toContainText(diagnosis);
    // not saved: not shown as a value
    expect(shown).not.toContain('[X] Headache');
    expect(shown).not.toContain('[X] Tocilizumab');
    expect(shown).not.toContain('[X] Severe');
    await expect(view.root.locator('#buttons, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: the saved values, the toggled blocks open because their box is saved
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#intro').getByLabel('Moderate', { exact: true })).toBeChecked();
    await expect(box(page, 'Fever')).toBeChecked();
    await expect(symptom(page, 'Fever').getByLabel('Worse', { exact: true })).toBeChecked();
    await expect(box(page, 'Headache')).not.toBeChecked();
    await expect(page.locator('#temperature_c input')).toHaveValue('38.1');
    await expect(page.locator('#o2therapy')).toBeVisible();
    await expect(page.locator('#pcrTest')).toBeVisible();
    await expect(page.locator('#pcrTest').getByLabel('Positive', { exact: true })).toBeChecked();
    await expect(page.locator('#abUS')).toBeVisible();
    await expect(page.locator('#mh-referral')).toBeVisible();
    await expect(page.locator('#plan textarea').nth(0)).toHaveValue('Continue steroids, review in 48 hours');
    await expect(status(page, 'Confirmed')).toBeChecked();
    // change: Severe instead of Moderate, Suspected instead of Confirmed, drop the cough, new temperature
    await page.locator('#intro').getByLabel('Severe', { exact: true }).check();
    await status(page, 'Suspected').check();
    await box(page, 'Cough').uncheck();
    await page.locator('#temperature_c input').fill('37.0');
    await save(page);

    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, 'severe', 'suspected', 'fever', 'temperature (c): 37', 'free fluid in the pelvis');
    expect(after.some((d) => d.includes('moderate')), 'the old condition is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('confirmed') && !d.includes('diagnosis')), 'the old status is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('cough')), 'the unticked symptom is voided').toBeFalsy();
    expect(await programEnrollments(api, context.patient.uuid), 'EDIT does not enrol a second time').toHaveLength(1);
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    const shown2 = (await view2.valueTexts()).join(' | ');
    expect(shown2).toContain('[X] Severe');
    expect(shown2).toContain('[X] Suspected');
    expect(shown2).not.toContain('[X] Moderate');
    expect(shown2).not.toContain('[X] Cough');
  });
});
