import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { CANCEL_ADMISSION_ENCOUNTER_TYPE_UUID, CONSULT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, expectViewShowsSavedObs, VISIT_PAGE_URL, visitPagePath } from '../pages';

// cancelAdmission.xml: "Cancel Admission": removes a patient from the awaiting-admission queue by recording an encounter of type Cancel Admission with the
// reason, a clinical note and a hidden "Admission decision = Deny admission" obs. Users open it from the awaiting-admission list (a "Cancel" action;
// ADT module, `&returnProvider=pihcore&returnPage=adt/awaitingAdmission`). The specs open the same enterHtmlFormWithStandardUi URL directly inside a visit
// they created (EntryFormPage) and keep its returnUrl to the visit page: they never open the awaiting-admission list or return to it, because that
// list shows other patients of the shared server. So the list entry and the list's own wiring are not exercised; the form itself saves and is
// reachable (no @unreachable). The form uses the HFE <submit> tag: there is no #submit, the button is `#buttons input.submitButton`. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (cancelAdmission.inv.md):
//   ifMode VIEW include=false :80, :85, :117   the <h2>, the hidden #encounter-details (date, provider; both default, `class="hidden"`) and the Save / Cancel
//                                              buttons (the script is not inside an ifMode, yet it throws nothing in the visit-page VIEW: tested)
// Scripts :4-78: validateForm() enables Save only when the reason select (#cancel-reason) has a value (run on load, on every change and click).
//   A mapping reason -> expected disposition (Patient died -> Death, Left without completion of treatment -> Departed without medical discharge,
//   Transfer to another hospital -> Transfer out of hospital, Health condition improved -> Discharge) is compared in beforeSubmit with the visit's most
//   recent disposition; when they differ (including no disposition at all) the confirm dialog #confirm-cancel-admission is shown instead of saving.
//   "Admission error" is not in the map and never asks. Confirm sets skipConfirmCancel and then calls `('.submitButton').click()` (:37, see V1).
// Side effects on save: none beyond the encounter (no disposition action, no postSubmissionAction); the "Deny admission" obs is what the ADT list reads.
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, edbb857b: templateModelUrl without definitionUiResource, so it
//   renders the form the encounter was saved with; longTemplate viewEncounterWithHtmlFormLong.page): expectViewShowsSavedObs.
// Not covered here: the awaiting-admission list; a prior Death / Transfer / Left-without-treatment disposition (saving them marks the patient dead or
//   transfers the visit); the date and provider widgets (hidden, defaults).
//
// Findings: see pihemr _findings.e2e.md#cancelAdmission

const FORM = 'cancelAdmission.xml';
const SAVE = '#buttons input.submitButton';
const reason = (page: Page) => page.locator('#cancel-reason select');
const dialog = (page: Page) => page.locator('#confirm-cancel-admission');
const newPatient = (createEntryContext: PihemrFixtures['createEntryContext']) =>
  createEntryContext({ givenName: 'AutoCancelAdm', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(30) });

const editUrl = (patientUuid: string, encounterUuid: string, visitUuid: string) =>
  `htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?${new URLSearchParams({
    patientId: patientUuid,
    encounterId: encounterUuid,
    definitionUiResource: `file:configuration/pih/htmlforms/${FORM}`,
    returnUrl: visitPagePath(visitUuid),
  })}`;

// Counts the form submissions the browser sends.
const watchSubmits = (page: Page): string[] => {
  const submits: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/submit.action')) {
      submits.push(r.url());
    }
  });
  return submits;
};

// A consult with the Discharge disposition in the visit (the "most recent consultation note" the form compares the reason with). Discharge leaves
// the visit open and changes nothing else.
const saveConsultWithDischarge = async (page: Page, context: Awaited<ReturnType<typeof newPatient>>) => {
  await EntryFormPage.open(page, 'outpatientConsult.xml', context);
  await page.locator('#diagnosis-search').fill('mal');
  await page.locator('ul.ui-autocomplete li').first().click();
  await page.locator('#disposition select').first().selectOption({ label: 'Discharge' });
  await page.locator('#buttons button.submitButton').click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};

test.describe('cancelAdmission', () => {
  test('ENTER shows the heading, the location (preselected), the reason and note; Save starts disabled; the dialog and the details are hidden', async ({ page, createEntryContext }) => {
    // ifMode VIEW include=false :80, :85, :117 (present in ENTER); validateForm :8-17
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await expect(page.locator('h2')).toHaveText('Cancel Admission');
    await expect(page.locator('#encounter-details')).toBeHidden();
    await expect(page.locator('select:visible').first(), 'location is preselected with the session location').not.toHaveValue('');
    await expect(reason(page)).toHaveValue('');
    await expect(reason(page).locator('option:not([value=""])')).toHaveText([
      'Admission error',
      'Health condition improved',
      'Left without completion of treatment',
      'Patient died',
      'Transfer to another hospital',
    ]);
    await expect(page.locator('textarea')).toHaveCount(1);
    await expect(page.locator(SAVE)).toBeDisabled();
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('#submit')).toHaveCount(0);
    await expect(page.locator('#buttons .cancel')).toBeVisible();
  });

  test('Save is enabled only while a reason is chosen', async ({ page, createEntryContext }) => {
    // validateForm :8-17 on change and click
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await reason(page).selectOption({ label: 'Admission error' });
    await expect(page.locator(SAVE)).toBeEnabled();
    await reason(page).selectOption('');
    await expect(page.locator(SAVE)).toBeDisabled();
  });

  // Saves "Admission error" (not in the reason -> disposition map, so no question is asked) with a note.
  const saveAdmissionError = async (page: Page, api: APIRequestContext, createEntryContext: PihemrFixtures['createEntryContext']) => {
    const context = await newPatient(createEntryContext);
    const form = await EntryFormPage.open(page, FORM, context);
    await reason(page).selectOption({ label: 'Admission error' });
    await page.locator('textarea').fill('Entered on the wrong patient');
    await page.locator(SAVE).click();
    await form.expectSaved();
    const encounters = await getPatientEncounters(api, context.patient.uuid);
    expect(encounters.map((e) => e.encounterType.uuid)).toEqual([CANCEL_ADMISSION_ENCOUNTER_TYPE_UUID]);
    const displays = (await getEncounterObs(api, encounters[0].uuid)).map((o) => o.display);
    expect(displays.sort()).toEqual(['Admission decision: Deny', 'Clinical impression comments: Entered on the wrong patient', 'Reason not admitted: Admission error']);
    return { context, encounter: encounters[0] };
  };

  test('"Admission error" saves without a question: reason, note and the hidden "Deny admission" decision', async ({ page, api, createEntryContext }) => {
    // the hidden obs :99 (defaultValue Deny Admission, in a display:none span)
    await saveAdmissionError(page, api, createEntryContext);
  });

  test('a reason that does not match the visit\'s disposition asks first: Cancel closes the dialog (V2), the form stays and nothing is saved', async ({ page, api, createEntryContext }) => {
    // beforeSubmit :60-77; no disposition in the visit, so every reason in the map mismatches
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    const submits = watchSubmits(page);
    await reason(page).selectOption({ label: 'Patient died' });
    await page.locator(SAVE).click();
    await expect(dialog(page)).toBeVisible();
    // V3: with no disposition in the visit the message ends in empty parentheses "()"
    await expect(dialog(page).locator('.dialog-instructions')).toContainText('The reason for removal (Patient died) does not match the disposition in the most recent consultation note ()');
    await dialog(page).locator('button.cancel').click();
    await expect(dialog(page)).toBeHidden();
    await expect(reason(page)).toHaveValue(/.+/);
    await page.waitForTimeout(500);
    expect(submits).toEqual([]);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
  });

  // V1: the intended behaviour. Today Confirm throws "'.submitButton'.click is not a function" (the handler calls ('.submitButton').click()
  // without jq); the encounter is still saved only because the Confirm <button> is itself a submit button of the form. failOnJsError reports the throw.
  // remove test.fixme() when fixed
  test.fixme('V1: Confirm in the dialog saves the encounter without a JavaScript error', async ({ page, api, createEntryContext }) => {
    const context = await newPatient(createEntryContext);
    const form = await EntryFormPage.open(page, FORM, context);
    await reason(page).selectOption({ label: 'Patient died' });
    await page.locator(SAVE).click();
    await expect(dialog(page)).toBeVisible();
    await page.locator('#confirm-cancel-admission-button').click();
    await form.expectSaved();
    const [encounter] = await getPatientEncounters(api, context.patient.uuid);
    expect((await getEncounterObs(api, encounter.uuid)).map((o) => o.display)).toContain('Reason not admitted: Patient died');
  });

  test('with a Discharge in the visit: "Patient died" asks (naming Discharge); "Health condition improved" matches and saves without asking', async ({ page, api, createEntryContext }) => {
    // cancelReasonToDispositionMap :47-52 against visit.mostRecentDisposition
    const context = await newPatient(createEntryContext);
    await saveConsultWithDischarge(page, context);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.encounterType.uuid)).toEqual([CONSULT_ENCOUNTER_TYPE_UUID]);

    await EntryFormPage.open(page, FORM, context);
    const submits = watchSubmits(page);
    await reason(page).selectOption({ label: 'Patient died' });
    await page.locator(SAVE).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.dialog-instructions')).toContainText('(Patient died)');
    await expect(dialog(page).locator('.dialog-instructions')).toContainText('(Discharge)');
    await dialog(page).locator('button.cancel').click();
    expect(submits).toEqual([]);

    await reason(page).selectOption({ label: 'Health condition improved' });
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    await expect(dialog(page)).toHaveCount(0);
    const types = (await getPatientEncounters(api, context.patient.uuid)).map((e) => e.encounterType.uuid).sort();
    expect(types).toEqual([CANCEL_ADMISSION_ENCOUNTER_TYPE_UUID, CONSULT_ENCOUNTER_TYPE_UUID].sort());
  });

  test('EDIT starts from the saved reason and note; changing the note and saving keeps the reason', async ({ page, api, createEntryContext }) => {
    const { context, encounter } = await saveAdmissionError(page, api, createEntryContext);
    await page.goto(editUrl(context.patient.uuid, encounter.uuid, context.visitUuid));
    await expect(reason(page).locator('option:checked')).toHaveText('Admission error');
    await expect(page.locator('textarea')).toHaveValue('Entered on the wrong patient');
    await expect(page.locator(SAVE)).toBeEnabled();
    await page.locator('textarea').fill('Wrong patient; re-registered');
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    const displays = (await getEncounterObs(api, encounter.uuid)).map((o) => o.display).sort();
    expect(displays).toEqual(['Admission decision: Deny', 'Clinical impression comments: Wrong patient; re-registered', 'Reason not admitted: Admission error']);
  });

  // The script (:4-78) is not inside ifMode VIEW include=false and uses htmlForm / beforeSubmit / getValue, which the visit page does not load
  // (HAI-1278), but opening the VIEW throws nothing here (failOnJsError would fail this test): the inserted script does not run or has nothing to act on.
  test('the visit page shows the form VIEW of the saved cancellation: reason, note, no heading or buttons', async ({ page, api, createEntryContext }) => {
    const { encounter } = await saveAdmissionError(page, api, createEntryContext);
    // the hidden decision obs is in a display:none span, so it has no text to find
    const view = await expectViewShowsSavedObs(page, api, FORM, encounter.uuid, { 'Admission decision: Deny': '' });
    await expect(view.root.locator('#cancel-reason .value')).toHaveText(['Admission error']);
    await expect(view.root.locator('.value').filter({ hasText: 'Entered on the wrong patient' })).toHaveCount(1);
    // ifMode VIEW include=false: no heading, no Save / Cancel
    await expect(view.root.locator('h2, #buttons, input.submitButton')).toHaveCount(0);
  });
});
