import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { COVID19_INTAKE_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, isoDate, obsDisplays, pickDate, pickEncounterDiagnosis, pickerDate, programEnrollments, viewDate } from '../pages/form-widgets';
import { getLocationName } from '../rest';

// covid19Intake.xml: "COVID19 Admission", the admission note of the COVID-19 Admission encounter, the longest of the three COVID forms: demographic blocks that depend on the
// patient (health care worker, pregnancy and postpartum state, infant and child questions), home medications, allergies, signs and symptoms, comorbidities, the admission / transfer
// questions, vital signs, physical exam, treatment (medications, oxygen and IV fluids with details), the COVID-19 status and diagnoses, three specimen / test rows, other lab values,
// radiology, and the plan (disposition, plan, nursing note, mental health referral). Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit they created
// (EntryFormPage), which skips the visit action's gating (_availability.e2e.md: `covid19` or `covid19IntakeForm`, COVID-19 Location, `Task: emr.enterCOVID`, no COVID intake in the
// visit). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). HFE <submit> tag: the button is `#buttons input.submitButton`, there is no `#submit`. who / where / when is EPLD with the location widget overridden to the
// "COVID-19 Location" tag, which the session location Klinik Ekstèn carries: it is preselected and the form is shown (no auto-submit). The only required field is the COVID-19 status.
//
// Conditions in the form, from documentation inventory (covid19Intake.inv.md):
//   includeIf $patient.age > 16 :127      health care worker checkbox + type (adults: 17+)
//   includeIf $patient.gender == 'F' :144 pregnant Yes / No, LMP, EDD, calculated EDD / gestational age, postpartum state (NO age condition: V1)
//   includeIf $patient.age < 1 :223       gestational outcome (term / preterm) and breastfeeding (infants)
//   includeIf $patient.age < 14 :243      vaccinations up to date (children under 14)
//   includeIf !$config.isComponentEnabled('radiology') :887   the "At HUM, use Radiology order" note; zl-ci has the component, so only the other arm renders (not covered)
//   toggle CIEL:5619 :133 -> #worker; CIEL:162747 :200 -> #postpartum; CIEL:165995 oxygen :659 -> #o2therapy, IV fluid :697 -> #ivf; PIH:10745 antibody / antigen / PCR / GeneXpert
//   checkboxes :787-:808 -> #Ab{0} #Ag{0} #pcr{0} #xpert{0} for the rows 0, 1 and 3; PIH:Radiology procedure performed :902 -> #chestXRay #cardioUS #abUS; CIEL:1272 :955 -> #mh-referral
//   ifMode VIEW include=false  :48 script, :104 heading, :971 #buttons: absent in VIEW
// Scripts :49-89 (ENTER and EDIT): setUpEdd (mch.js): the LMP (#lastPeriodDate) drives the EDD (#edd) and the calculated EDD / gestational age block (LMP + 280 days; nothing when the LMP
//   is 305 days or more before the encounter); validateEstimatedDeliveryDate and eddCannotBeOlderThanTwoWeeks (zl.js / mch.js: _shared V1, V7); getBeforeValidation: a disposition
//   chosen while one of its visible fields is empty -> "fields associated with the disposition" error, save stopped.
// Side effects on save: enrollInProgram COVID-19 (:123, locationTag "Program Location"): every save enrols the patient (no checkbox); postSubmissionAction ApplyDispositionAction (the
//   tests save only Home quarantine; Transfer out is only used to hit the validation, Death is never saved).
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type 8d50b938: templateModelUrl with definitionUiResource=covid19Intake.xml,
//   longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md (section covid19Intake.xml, covid19Followup.xml, covid19Discharge.xml), and _shared V1 / V7 for the EDD scripts
//   V1 Low :144-222 the pregnancy block (pregnant, LMP, EDD, postpartum state) is shown to every female patient, including a newborn girl (tested)
//   V2 Low :93 (print stamp) `pih.form.created_on` etc. are not message codes: the hidden print block reads "pih.form.created_on: 12/May/2020" (checked on zl-ci)
// Not covered here: availability, the radiology "At HUM" arm, the EDD validators' messages (_shared V1, V7), the Death / Transfer dispositions, the physical-exam rows beyond one answer,
//   most of the 40 lab and 17 symptom fields (same markup as the ones tested), changing the encounter date.

const FORM = 'covid19Intake.xml';
const SAVE = '#buttons input.submitButton';

type Gender = 'M' | 'F';
const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], gender: Gender = 'F', years = 40) =>
  createEntryContext({ givenName: 'AutoCovidIntake', familyName: 'Tester', gender, birthdate: birthdateYearsAgo(years) });
const open = async (page: Page, createEntryContext: PihemrFixtures['createEntryContext'], gender: Gender = 'F', years = 40) => {
  const context = await newPatient(createEntryContext, gender, years);
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
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([COVID19_INTAKE_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};

// The `wN` ids depend on the patient (the includeIf blocks add and remove fields), so fields are found by label, by their own ids or by position.
const demographics = (page: Page) => page.locator('#demographics');
const box = (page: Page, label: string) => page.getByLabel(label, { exact: true });
// The COVID-19 status radio (the diagnosis widget adds a "Confirmed" checkbox of its own once a diagnosis is picked, so the role matters).
const status = (page: Page, label: string) => page.getByRole('radio', { name: label, exact: true });
// The text input that follows the label with this text.
const inputAfter = (page: Page, label: string): Locator => page.locator('label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().locator('xpath=following::input[1]');
// The checkbox that precedes the "<test> test" caption of the nth specimen row (the caption has no label of its own: answerCode="").
const testBox = (page: Page, caption: RegExp, row: number): Locator => page.locator('strong', { hasText: caption }).nth(row).locator('xpath=preceding::input[@type="checkbox"][1]');
const disposition = (page: Page) => page.locator('#disposition select').first();

test.describe('covid19Intake layout, required field and enrolment', () => {
  test('ENTER shows the heading, who / where / when with the session location, the 13 sections and Save / Cancel; the conditional blocks start hidden', async ({ api, site, page, createEntryContext }) => {
    // ifMode VIEW include=false :104, :971; toggles (initial state)
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText('COVID-19 Admission');
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#where select option:checked')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    await expect(page.locator('legend')).toHaveText([
      'Demographics', 'Home medications', 'Allergies', 'Signs and symptoms', 'Comorbidities', 'Admission', 'Vital signs', 'Physical exam', 'Treatment', 'Diagnosis', 'Lab Tests', 'Radiology order', 'Plan',
    ]);
    for (const id of ['#worker', '#postpartum', '#o2therapy', '#ivf', '#mh-referral', '#Ab0', '#Ag0', '#pcr0', '#xpert0', '#chestXRay', '#cardioUS', '#abUS', '#calculated-edd-and-gestational']) {
      await expect(page.locator(id), id).toBeHidden();
    }
    await expect(page.locator('#radiology-orders')).not.toContainText('At HUM'); // includeIf :887: the radiology component is on
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
  });

  test('a blank Save is refused: the COVID-19 status is "Required", nothing is created and the patient is not enrolled', async ({ page, api, createEntryContext }) => {
    // obs CIEL:165793 required="true" :736
    const context = await open(page, createEntryContext);
    await page.locator(SAVE).click();
    await expect(page.locator('#diagnosis span.field-error').first()).toBeVisible();
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    expect(await programEnrollments(api, context.patient.uuid), 'a refused save enrols nobody').toEqual([]);
  });

  test('a minimal Save (COVID-19 status only) creates a form-linked encounter in the visit and enrols the patient in the COVID-19 program (enrollInProgram :123)', async ({
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

  test('a disposition whose own field is empty (Transfer out of hospital) is refused with the "fields associated with the disposition" message, and the message goes when the disposition changes', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // getBeforeValidation :49-89; Transfer is only used to hit the validation: nothing is saved
    const context = await open(page, createEntryContext);
    await status(page, 'Confirmed').check();
    await disposition(page).selectOption({ label: 'Transfer out of hospital' });
    await page.locator(SAVE).click();
    await expect(page.locator('#disposition .field-error').first()).toContainText(/fill out all fields/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    await disposition(page).selectOption({ label: 'Home quarantine' });
    await expect(page.locator('#disposition .field-error').first()).toBeHidden();
  });
});

test.describe('covid19Intake conditional blocks by patient', () => {
  // each case opens a form: allow for it
  test.describe.configure({ timeout: 90_000 });

  test('health care worker is for patients over 16 (17 yes, 16 no), pregnancy for every female, whatever her age (V1)', async ({ page, createEntryContext }) => {
    // includeIf age > 16 :127, gender F :144: the worker block shows for F40, M40 and F17 and not for F16; the pregnancy block shows for F40, F17, F16 and not for M40
    const cases: Array<[Gender, number, boolean, boolean]> = [
      ['F', 40, true, true],
      ['M', 40, true, false],
      ['F', 17, true, true],
      ['F', 16, false, true],
    ];
    for (const [gender, years, worker, pregnancy] of cases) {
      await open(page, createEntryContext, gender, years);
      const text = await demographics(page).innerText();
      expect(text.includes('Health care worker'), `${gender}${years} worker block`).toBe(worker);
      expect(text.includes('Pregnant'), `${gender}${years} pregnancy block`).toBe(pregnancy);
      expect(text.includes('Postpartum state'), `${gender}${years} postpartum`).toBe(pregnancy);
      expect(text.includes('Vaccinations up to date?') || text.includes('Gestational outcome'), `${gender}${years} no child block`).toBe(false);
    }
  });

  test('vaccinations up to date shows for patients under 14 (13 yes, 14 no); the infant block (gestational outcome, breastfeeding) only under 1 year', async ({ page, createEntryContext }) => {
    // includeIf age < 14 :243, age < 1 :223
    const cases: Array<[Gender, number, boolean, boolean]> = [
      ['M', 13, true, false],
      ['M', 14, false, false],
      ['M', 0, true, true],
    ];
    for (const [gender, years, child, infant] of cases) {
      await open(page, createEntryContext, gender, years);
      const text = await demographics(page).innerText();
      expect(text.includes('Vaccinations up to date?'), `${gender}${years} child block`).toBe(child);
      expect(text.includes('Gestational outcome') && text.includes('Breastfeed'), `${gender}${years} infant block`).toBe(infant);
      expect(text.includes('Health care worker') || text.includes('Pregnant'), `${gender}${years} no adult block`).toBe(false);
    }
  });

  test('V1: a newborn girl gets the infant block and ALSO the pregnancy block (pregnant, LMP, EDD, postpartum state)', async ({ page, createEntryContext }) => {
    // includeIf gender F :144 has no age condition (the care worker block has one)
    await open(page, createEntryContext, 'F', 0);
    const text = await demographics(page).innerText();
    expect(text).toContain('Gestational outcome');
    expect(text).toContain('Pregnant');
    expect(text).toContain('Postpartum state');
  });
});

test.describe('covid19Intake toggles and scripts', () => {
  test('the health care worker box shows the worker type, and unticking hides it (toggle :133)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('#worker')).toBeHidden();
    await demographics(page).getByLabel('Yes', { exact: true }).first().check();
    await expect(page.locator('#worker')).toBeVisible();
    await expect(page.locator('#worker select option')).not.toHaveCount(0);
    await demographics(page).getByLabel('Yes', { exact: true }).first().uncheck();
    await expect(page.locator('#worker')).toBeHidden();
  });

  test('the postpartum state shows the outcome and the delivery date, and unticking hides them (toggle :200)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('#postpartum')).toBeHidden();
    await box(page, 'Postpartum state').check();
    await expect(page.locator('#postpartum')).toBeVisible();
    await expect(page.locator('#postpartum').getByLabel('Livebirth')).toBeVisible();
    await expect(page.locator('#postpartum').getByLabel('Stillbirth')).toBeVisible();
    await box(page, 'Postpartum state').uncheck();
    await expect(page.locator('#postpartum')).toBeHidden();
  });

  test('oxygen shows its amount and IV fluid shows the three fluid rows, and unticking hides them (toggles :659, :697)', async ({ page, createEntryContext }) => {
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

  test('each test of a specimen row shows its own results, row by row (toggles :787-:808: the three rows are numbered 0, 1 and 3)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    const tests: Array<[RegExp, string]> = [
      [/antibody/i, 'Ab'],
      [/antigen/i, 'Ag'],
      [/PCR/i, 'pcr'],
      [/GeneXpert/i, 'xpert'],
    ];
    for (const [caption, prefix] of tests) {
      for (const row of [0, 1, 3]) {
        await expect(page.locator(`#${prefix}${row}`), `#${prefix}${row} starts hidden`).toBeHidden();
      }
      await testBox(page, caption, 1).check(); // the second row (index 1)
      await expect(page.locator(`#${prefix}1`)).toBeVisible();
      await expect(page.locator(`#${prefix}0`)).toBeHidden();
      await expect(page.locator(`#${prefix}3`)).toBeHidden();
      await testBox(page, caption, 1).uncheck();
      await expect(page.locator(`#${prefix}1`)).toBeHidden();
    }
    await expect(page.locator('#Ab2'), 'there is no row 2').toHaveCount(0);
  });

  test('each radiology procedure shows its findings box, and the mental health referral shows its notes (toggles :902, :955)', async ({ page, createEntryContext }) => {
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

  test('the LMP sets the EDD (LMP + 280 days) and shows the calculated EDD and gestational age; an LMP 305 days or more back, or none, shows nothing (setUpEdd)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    const lmp = demographics(page).locator('#lastPeriodDate input[readonly]');
    const edd = demographics(page).locator('#edd input[readonly]');
    await expect(page.locator('#calculated-edd-and-gestational')).toBeHidden();
    await pickDate(lmp, isoDate(-70));
    await expect(page.locator('#calculated-edd-and-gestational')).toBeVisible();
    await expect(page.locator('#calculated-gestational-age-value')).toContainText('10 weeks');
    await expect(edd).toHaveValue(pickerDate(isoDate(210))); // -70 + 280 days
    await expect(page.locator('#calculated-edd')).not.toHaveText('');
    // 305 days or more before the encounter: no calculation, the EDD is cleared
    await pickDate(lmp, isoDate(-320));
    await expect(page.locator('#calculated-edd-and-gestational')).toBeHidden();
    await expect(edd).toHaveValue('');
  });
});

test.describe('covid19Intake saved data', () => {
  test('saves demographics, symptoms, comorbidities, vitals, treatment, diagnosis, a test row, radiology and the plan; VIEW shows them; EDIT starts from them and a changed answer replaces the old one', async ({
    page,
    api,
    createEntryContext,
  }) => {
    test.setTimeout(90_000);
    const context = await open(page, createEntryContext);
    const lmpDate = isoDate(-70);
    const specimenDate = isoDate(-1);
    // demographics: pregnant Yes with the LMP (the EDD follows), worker
    await demographics(page).getByLabel('Yes', { exact: true }).first().check(); // health care worker
    await demographics(page).getByLabel('Yes', { exact: true }).nth(1).check(); // pregnant
    await pickDate(demographics(page).locator('#lastPeriodDate input[readonly]'), lmpDate);
    // home medications, allergies, symptoms, comorbidities
    await page.locator('#current-medications textarea').fill('Metformin 500 mg twice daily');
    await page.locator('#allergies textarea').fill('Penicillin rash');
    await box(page, 'Fever').check();
    await box(page, 'Cough').check();
    await box(page, 'Hypertension').check();
    // vitals
    await page.locator('#temperature_c input').fill('38.5');
    await page.locator('#heart_rate input').fill('96');
    await page.locator('#respiratory_rate input').fill('22');
    await page.locator('#bp_systolic input').fill('128');
    await page.locator('#bp_diastolic input').fill('82');
    await page.locator('#o2_sat input').fill('93');
    // treatment
    await box(page, 'Dexamethasone').check();
    await box(page, 'Oxygen').check();
    await page.locator('#o2therapy input').first().fill('4');
    // diagnosis
    await status(page, 'Confirmed').check();
    const diagnosis = (await pickEncounterDiagnosis(page)).replace(/^[A-Z]\d[\w.]*\s+/, '');
    // first specimen row: date, nasal swab, antibody test: positive IgG
    await pickDate(page.locator('#lab input[readonly]').first(), specimenDate);
    await box(page, 'Nasal swab').first().check();
    await testBox(page, /antibody/i, 0).check();
    await page.locator('#Ab0').getByLabel('Positive IgG+IgM', { exact: true }).check();
    // radiology and plan
    await box(page, 'Chest X-ray').check();
    await page.locator('#chestXRay input').first().fill('Bilateral infiltrates');
    await disposition(page).selectOption({ label: 'Home quarantine' });
    await box(page, 'Mental health referral').check();
    await page.locator('#mh-referral textarea').fill('Anxiety about isolation');
    await save(page);

    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(
      displays,
      'metformin 500 mg twice daily',
      'penicillin rash',
      'fever',
      'cough',
      'hypertension',
      'temperature (c): 38.5',
      'systolic: 128',
      'diastolic: 82',
      'dexamethasone',
      'confirmed',
      diagnosis,
      'bilateral infiltrates',
      'self-quarantine',
      'anxiety about isolation',
    );
    expect((await programEnrollments(api, context.patient.uuid)).map((e) => e.program.name)).toEqual(['COVID-19']);

    // VIEW on the visit page
    // answers the form labels with answerCode: the radiology and specimen boxes, and the test boxes, which have an empty label (answerCode="") and are named by the <strong> next to them
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, {
      'Radiology procedure performed: Chest, 1 view (X-ray)': 'Chest X-ray',
      'Specimen source: Nasal swab specimen': 'Nasal swab',
      'Laboratory test ordered, coded: SARS-CoV-2 Antibody RDT (IgM/IgG)': '',
      'Disposition categories: Self-quarantine': 'Home quarantine',
      'Diagnosis order: Primary': '',
      'Diagnosis certainty: Presumed': '',
      [`Diagnosis: ${diagnosis}`]: '',
    });
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('Metformin 500 mg twice daily');
    expect(shown).toContain('Penicillin rash');
    expect(shown).toContain('[X] Fever');
    expect(shown).toContain('[X] Confirmed');
    expect(shown).toContain('[X] Dexamethasone');
    expect(shown).toContain('Bilateral infiltrates');
    expect(shown).toContain('Anxiety about isolation');
    expect(shown).toContain(viewDate(specimenDate));
    expect(shown).toContain(viewDate(lmpDate));
    await expect(view.root).toContainText(diagnosis);
    // not saved: not shown as a value
    expect(shown).not.toContain('[X] Headache');
    expect(shown).not.toContain('[X] Doxycycline');
    expect(shown).not.toContain('[X] Suspected');
    await expect(view.root.locator('#buttons, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: the saved values, the toggled blocks open because their box is saved
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#current-medications textarea')).toHaveValue('Metformin 500 mg twice daily');
    await expect(page.locator('#allergies textarea')).toHaveValue('Penicillin rash');
    await expect(box(page, 'Fever')).toBeChecked();
    await expect(box(page, 'Headache')).not.toBeChecked();
    await expect(page.locator('#temperature_c input')).toHaveValue('38.5');
    await expect(page.locator('#o2therapy')).toBeVisible();
    await expect(page.locator('#chestXRay')).toBeVisible();
    await expect(page.locator('#mh-referral')).toBeVisible();
    await expect(page.locator('#Ab0')).toBeVisible();
    await expect(page.locator('#Ab0').getByLabel('Positive IgG+IgM', { exact: true })).toBeChecked();
    await expect(status(page, 'Confirmed')).toBeChecked();
    // change: Suspected instead of Confirmed, drop the cough, new temperature
    await status(page, 'Suspected').check();
    await box(page, 'Cough').uncheck();
    await page.locator('#temperature_c input').fill('37.2');
    await save(page);

    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, 'suspected', 'fever', 'temperature (c): 37.2', 'metformin 500 mg twice daily', 'bilateral infiltrates');
    expect(after.some((d) => d.includes('confirmed')), 'the old status is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('cough')), 'the unticked symptom is voided').toBeFalsy();
    expect(await programEnrollments(api, context.patient.uuid), 'EDIT does not enrol a second time').toHaveLength(1);
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    const shown2 = (await view2.valueTexts()).join(' | ');
    expect(shown2).toContain('[X] Suspected');
    expect(shown2).not.toContain('[X] Confirmed');
    expect(shown2).not.toContain('[X] Cough');
  });
});
