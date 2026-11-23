import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { ADMISSION_ENCOUNTER_TYPE_UUID, CONSULT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, VisitPage, VISIT_PAGE_URL, visitPagePath } from '../pages';
import { isoDate, pickDate } from '../pages/form-widgets';
import { getLocationName } from '../rest';
import { specFacts } from '../spec-facts';

// admissionNote.xml: "Admission": admitting clinician, ward (Admission Location), admission date and the diagnoses (required). Users open it from the
// ADMISSION_NOTE_VISIT_ACTION visit action (Admission Note Location, `Task: emr.enterAdmissionNote`, active visit) or from the "Admit" action of the
// awaiting-admission list (`&returnProvider=pihcore&returnPage=adt/awaitingAdmission`). The specs open enterHtmlFormWithStandardUi directly inside a
// visit they created (EntryFormPage), with its returnUrl to the visit page: they never open the awaiting-admission list or return to it (it lists other
// patients of the shared server), so the list entry and the visit action's gating are not exercised. The form uses the HFE <submit> tag: there is no
// #submit, the button is `#buttons input.submitButton`. The ward select starts EMPTY (the session location does not carry the Admission Location
// tag) unless the visit holds an earlier admission request (see :132-151). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (admissionNote.inv.md):
//   ifMode ENTER + includeIf $visit.open  :49-50, :132-133, :181-182   the wristband script, the admit-to-ward script and the wristband dialog: only when entering the form in an open visit
//   ifMode VIEW include=false             :171   the Save / Cancel buttons
//   js (:132-151, ENTER, open visit)      the ward is preselected with the "Admission location in hospital" obs of the latest admission request of THE SAME visit
//   encounterDiagnosesByObs :165 includePriorDiagnosesFromMostRecentEncounterWithDispositionOfType=ADMIT: a "Previous Diagnoses" button (only when such an
//   encounter exists) brings the diagnoses of the most recent encounter whose disposition is an ADMIT type (an Admission request)
//   includeIf :201 / :211  the wristband dialog's button order depends on the visit's most recent check-in location (six hard-coded locations)
// Scripts :19-45 validateForm() (document change/click): Save is enabled only when the ward, provider and date are set and a diagnosis chip exists.
//   :51-127 wristband (ENTER, open visit): when the chosen ward is one with a wristband printer, Save is held back by a "Print wristband?" dialog; No saves without
//   printing, Yes calls the pihcore wristband printer (a real printer: NEVER clicked by the specs).
// Side effects on save: postSubmissionAction ReopenVisitAction :17 (ENTER): a closed visit that is the patient's most recent visit at its location is reopened.
//   No disposition or location change of the patient is made by the form itself.
// Visit-page display: the visit page does NOT show this form's VIEW. The admission entry of encounterTypeConfig.js (encounter type 260566e1-...) has no
//   templateModelUrl and `showOnVisitList` is unset: it renders the encounter's obs with templates/encounters/admissionLong.page (a "Diagnoses:" block under
//   the default header). The VIEW test asserts that block, and the form's own VIEW is therefore not tested.
// Not covered here: the "Yes, print a wristband" path (it prints on a real printer), the awaiting-admission list and the retro / this-provider-only privilege
//   variants of the visit action, the second wristband `includeIf` (the check-in location rules, below), provider/location/date behaviour (_shared.e2e.md).
//
// Findings: see pihemr _findings.e2e.md#admissionNote

const FORM = 'admissionNote.xml';
const SAVE = '#buttons input.submitButton';
// The wards of the site (its facts), set before each test: `WARD` has a wristband printer.
let WARD = '';
let OTHER_WARD = '';
const newPatient = (createEntryContext: PihemrFixtures['createEntryContext']) =>
  createEntryContext({ givenName: 'AutoAdmission', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(30) });
type Context = Awaited<ReturnType<typeof newPatient>>;

const ward = (page: Page) => page.locator('#where select');
const pickDiagnosis = async (page: Page) => {
  await page.locator('#diagnosis-search').fill('mal');
  await page.locator('ul.ui-autocomplete li').first().click();
  await expect(page.locator('#encounter-diagnoses-target .diagnosis')).toHaveCount(1);
};
const diagnosisName = (page: Page) => page.locator('#encounter-diagnoses-target .diagnosis .matched-name').first().innerText();

// Clicks Save. At a ward with a wristband printer the form first asks "Print wristband?": answer No (never Yes: it prints on a real printer).
const saveAdmission = async (page: Page): Promise<boolean> => {
  await page.locator(SAVE).click();
  const dialog = page.locator('#print-wristband-dialog');
  await expect.poll(async () => (await dialog.isVisible()) || VISIT_PAGE_URL.test(page.url())).toBeTruthy();
  const asked = await dialog.isVisible();
  if (asked) {
    await dialog.locator('button.cancel').click();
  }
  await expect(page).toHaveURL(VISIT_PAGE_URL);
  return asked;
};

// A consult in the context's visit whose disposition is Admission to the given ward: the "admission request" that the admission note reads.
const saveAdmissionRequest = async (page: Page, context: Context, wardName: string) => {
  await EntryFormPage.open(page, 'outpatientConsult.xml', context);
  await page.locator('#diagnosis-search').fill('mal');
  await page.locator('ul.ui-autocomplete li').first().click();
  await page.locator('#disposition select').first().selectOption({ label: 'Admission' });
  await page.locator('#admissionLocation select').selectOption({ label: wardName });
  await page.locator('#buttons button.submitButton').click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};

const editUrl = (patientUuid: string, encounterUuid: string, visitUuid: string) =>
  `htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?${new URLSearchParams({
    patientId: patientUuid,
    encounterId: encounterUuid,
    definitionUiResource: `file:configuration/pih/htmlforms/${FORM}`,
    returnUrl: visitPagePath(visitUuid),
  })}`;

const admissionEncounter = async (api: APIRequestContext, patientUuid: string) => {
  const encounters = (await getPatientEncounters(api, patientUuid)).filter((e) => e.encounterType.uuid === ADMISSION_ENCOUNTER_TYPE_UUID);
  expect(encounters).toHaveLength(1);
  return encounters[0];
};

test.describe('admissionNote', () => {
  test.beforeEach(({ site }) => {
    ({ ward: WARD, otherWard: OTHER_WARD } = specFacts(site, 'admissionNote'));
  });
  test('ENTER: heading, who/where/when, an empty ward select with the Admission Location wards, the diagnosis search, Save disabled', async ({ api, site, page, createEntryContext }) => {
    // ifMode VIEW include=false :171 (present in ENTER); encounterLocation tags="Admission Location"
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await expect(page.locator('h2')).toHaveText('Admission Note');
    await expect(page.locator('#who select')).not.toHaveValue('');
    await expect(ward(page)).toHaveValue('');
    await expect(ward(page).locator('option', { hasText: WARD })).toHaveCount(1);
    await expect(ward(page).locator('option', { hasText: await getLocationName(api, site.sessionLocationUuid) }), 'only wards, not the outpatient clinic').toHaveCount(0);
    await expect(page.locator('#when input.hasDatepicker')).toHaveValue(/\d{2} \w{3} \d{4}/);
    await expect(page.locator('#diagnosis-search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous Diagnoses' }), 'no earlier admission request in the visit').toHaveCount(0);
    await expect(page.locator(SAVE)).toBeDisabled();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('#print-wristband-dialog')).toBeHidden();
    await expect(page.locator('#submit')).toHaveCount(0);
  });

  test('Save is enabled only with a ward and a diagnosis', async ({ page, createEntryContext }) => {
    // validateForm :19-45
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await pickDiagnosis(page);
    await expect(page.locator(SAVE), 'no ward yet').toBeDisabled();
    await ward(page).selectOption({ label: WARD });
    await expect(page.locator(SAVE)).toBeEnabled();
    await page.locator('#encounter-diagnoses-target i.icon-remove').first().click();
    await expect(page.locator('#encounter-diagnoses-target .diagnosis')).toHaveCount(0);
    await expect(page.locator(SAVE), 'diagnosis removed').toBeDisabled();
    await pickDiagnosis(page);
    await ward(page).selectOption('');
    await expect(page.locator(SAVE), 'ward cleared').toBeDisabled();
  });

  test('at a ward with a wristband printer Save asks "Print wristband?": No saves the admission without printing', async ({ page, api, createEntryContext }) => {
    // wristband dialog :51-127, :183: the dialog and its Yes / No buttons (Yes is never clicked)
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await pickDiagnosis(page);
    await ward(page).selectOption({ label: WARD });
    await page.locator(SAVE).click();
    const dialog = page.locator('#print-wristband-dialog');
    await expect(dialog, `${WARD} has a wristband printer (the site's fact)`).toBeVisible();
    await expect(dialog).toContainText('Do you want to print a wristband for this patient?');
    await expect(dialog.locator('button:visible')).toHaveText(['Yes', 'No']);
    expect(await getPatientEncounters(api, context.patient.uuid), 'nothing is saved while the dialog is open').toEqual([]);
    await dialog.locator('button.cancel').click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    expect(await admissionEncounter(api, context.patient.uuid)).toBeTruthy();
  });

  // Saves an admission with the ward and one diagnosis; the visit stays open.
  const saveAdmissionNote = async (page: Page, api: APIRequestContext, createEntryContext: PihemrFixtures['createEntryContext']) => {
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await pickDiagnosis(page);
    const diagnosis = await diagnosisName(page);
    await ward(page).selectOption({ label: WARD });
    await saveAdmission(page);

    const encounter = await admissionEncounter(api, context.patient.uuid);
    const e = await (await api.get(`encounter/${encounter.uuid}?v=custom:(location:(display),form:(display),visit:(uuid))`)).json();
    expect(e.location.display).toBe(WARD);
    expect(e.form.display).toBe('Admission');
    expect(e.visit.uuid).toBe(context.visitUuid);
    const displays = (await getEncounterObs(api, encounter.uuid)).map((o) => o.display);
    expect(displays).toEqual(expect.arrayContaining([`Diagnosis: ${diagnosis}`, 'Diagnosis order: Primary', 'Diagnosis certainty: Presumed']));
    const visit = await (await api.get(`visit/${context.visitUuid}?v=custom:(stopDatetime)`)).json();
    expect(visit.stopDatetime).toBeNull();
    const patient = await (await api.get(`patient/${context.patient.uuid}?v=custom:(person:(dead))`)).json();
    expect(patient.person.dead).toBe(false);
    return { context, encounter, diagnosis };
  };

  test('saves the admission at the chosen ward with the primary diagnosis; the visit stays open', async ({ page, api, createEntryContext }) => {
    await saveAdmissionNote(page, api, createEntryContext);
  });

  test('the visit page shows the admission with its own template: ward in the header and a Diagnoses block (admissionLong)', async ({ page, api, createEntryContext }) => {
    const { context, diagnosis } = await saveAdmissionNote(page, api, createEntryContext);
    const visit = await VisitPage.open(page, context.visitUuid);
    const entry = visit.encounterOfType(ADMISSION_ENCOUNTER_TYPE_UUID);
    await expect(entry).toContainText('Admission');
    await expect(entry).toContainText(WARD);
    await expect(entry).not.toContainText('Diagnoses:'); // collapsed
    await visit.expand(entry);
    // admissionLong.page has no .encounter-summary-long: its body is `.content`
    const content = entry.locator(':scope > .visit-element .content');
    await expect(content).toContainText('Diagnoses:');
    await expect(content).toContainText(diagnosis);
    await expect(content).toContainText('Primary');
  });

  test('an admission request in the same visit preselects its ward, and "Previous Diagnoses" brings its diagnosis in', async ({ page, api, createEntryContext }) => {
    // js :132-151 (latest "Admission location in hospital" obs of the visit) and encounterDiagnosesByObs includePriorDiagnosesFromMostRecentEncounterWithDispositionOfType=ADMIT
    const context = await newPatient(createEntryContext);
    await saveAdmissionRequest(page, context, WARD);
    const [consult] = await getPatientEncounters(api, context.patient.uuid);
    expect(consult.encounterType.uuid).toBe(CONSULT_ENCOUNTER_TYPE_UUID);
    const requested = (await getEncounterObs(api, consult.uuid)).find((o) => o.display.startsWith('Diagnosis: '))!.display.replace('Diagnosis: ', '');

    await EntryFormPage.open(page, FORM, context);
    await expect(ward(page).locator('option:checked')).toHaveText(WARD);
    await expect(page.locator('#encounter-diagnoses-target .diagnosis')).toHaveCount(0);
    await expect(page.locator(SAVE), 'no diagnosis yet').toBeDisabled();
    await page.getByRole('button', { name: 'Previous Diagnoses' }).click();
    await expect(page.locator('#encounter-diagnoses-target .diagnosis .matched-name')).toHaveText([requested]);
    await expect(page.locator(SAVE)).toBeEnabled();
    await saveAdmission(page);
    const admission = await admissionEncounter(api, context.patient.uuid);
    expect((await getEncounterObs(api, admission.uuid)).map((o) => o.display)).toContain(`Diagnosis: ${requested}`);
  });

  test('a request of ANOTHER visit does not preselect the ward', async ({ page, api, createEntryContext }) => {
    // js :132-151 compares the visit of the obs with the active visit
    const context = await newPatient(createEntryContext);
    await saveAdmissionRequest(page, context, WARD);
    // a second, later visit of the same patient (the first one is closed first, as only one visit can be open)
    await api.post(`visit/${context.visitUuid}`, { data: { stopDatetime: new Date(Date.now() - 30_000).toISOString() } });
    const res = await api.post('visit', {
      data: {
        patient: context.patient.uuid,
        visitType: 'f01c54cb-2225-471a-9cd5-d348552c337c',
        location: 'a084f714-a536-473b-94e6-ec317b152b43',
        startDatetime: new Date(Date.now() - 20_000).toISOString(),
      },
    });
    expect(res.ok(), `create second visit: ${res.status()}`).toBeTruthy();
    const second = (await res.json()).uuid as string;
    await EntryFormPage.open(page, FORM, { patient: context.patient, visitUuid: second });
    await expect(ward(page)).toHaveValue('');
  });

  test('entering the admission in a closed visit reopens it (ReopenVisitAction)', async ({ page, api, createEntryContext }) => {
    // postSubmissionAction :17, ENTER only; a closed visit that is the most recent one at its location. The visit is moved two days back and closed;
    // $visit.open is false so the wristband script and dialog are not rendered.
    const context = await newPatient(createEntryContext);
    const moved = await api.post(`visit/${context.visitUuid}`, {
      data: { startDatetime: new Date(Date.now() - 3 * 86_400_000).toISOString(), stopDatetime: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    });
    expect(moved.ok(), `move visit: ${moved.status()}`).toBeTruthy();
    await EntryFormPage.open(page, FORM, context);
    await expect(page.locator('#print-wristband-dialog')).toHaveCount(0);
    await pickDate(page.locator('#when input.hasDatepicker'), isoDate(-2));
    await pickDiagnosis(page);
    await ward(page).selectOption({ label: WARD });
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    await admissionEncounter(api, context.patient.uuid);
    const visit = await (await api.get(`visit/${context.visitUuid}?v=custom:(stopDatetime)`)).json();
    expect(visit.stopDatetime, 'the visit is open again').toBeNull();
  });

  test('EDIT starts from the saved ward and diagnosis, shows no wristband dialog, and a re-save keeps the diagnosis', async ({ page, api, createEntryContext }) => {
    const { context, encounter, diagnosis } = await saveAdmissionNote(page, api, createEntryContext);
    await page.goto(editUrl(context.patient.uuid, encounter.uuid, context.visitUuid));
    await expect(ward(page).locator('option:checked')).toHaveText(WARD);
    await expect(page.locator('#encounter-diagnoses-target .diagnosis .matched-name')).toHaveText([diagnosis]);
    await expect(page.locator(SAVE)).toBeEnabled();
    await expect(page.locator('#print-wristband-dialog'), 'ifMode ENTER').toHaveCount(0);

    await ward(page).selectOption({ label: OTHER_WARD });
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    const e = await (await api.get(`encounter/${encounter.uuid}?v=custom:(location:(display))`)).json();
    expect(e.location.display).toBe(OTHER_WARD);
    const displays = (await getEncounterObs(api, encounter.uuid)).map((o) => o.display);
    expect(displays.filter((d) => d.startsWith('Diagnosis: '))).toEqual([`Diagnosis: ${diagnosis}`]);
  });
});
