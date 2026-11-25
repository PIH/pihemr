import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { CONSULT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, VisitPage, VISIT_PAGE_URL, visitPagePath } from '../pages';
import { isoDate, pickDate, viewDate } from '../pages/form-widgets';
import { specFacts } from '../spec-facts';

// edNote.xml: "ED Note": coded diagnoses (+ an optional non-coded diagnosis text), disposition, occurrence and type of trauma, return visit
// date and comments. Reached with a synthetic adult patient who has an active visit, through enterHtmlFormWithStandardUi (EntryFormPage). Who
// offers it: the ED_CONSULT_NOTE_VISIT_ACTION visit action (_availability.e2e.md: `edConsult`, ED Note Location, `Task: emr.enterEDNote`);
// availability is not exercised. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). The form has its own Save button (`#buttons button.submitButton`, no #submit). The location
// select starts EMPTY (the session location Klinik Ekstèn does not carry the ED Note Location tag; Ijans is the only option) and is required.
//
// Conditions in the form, from documentation inventory (edNote.inv.md):
//   ifMode EDIT                          :7-30  CSS for #disposition and .check-inline (EDIT only)
//   ifMode VIEW include=false            :33-99, :101, :155   the validation script, the <h2>, the Save / Cancel buttons (the form's own VIEW is not shown on the visit page)
//   toggle PIH:20580 (checkbox)          :116  shows #nonCodedDiagnosis (textarea PIH:7416)
//   js updateTraumaQuestions             :72-78  "Occurrence of trauma" = Yes shows #trauma-type-container (type of trauma); anything else hides it and clears it
// Scripts: :37-66 validateForm(), run on load and on every document click/change: Save is disabled unless a provider, location and date are set, a
//   diagnosis chip (`.diagnosis`) exists (the non-coded text does NOT count, unlike outpatientConsult), "Occurrence of trauma" is answered, a type is
//   chosen when it is Yes, and no visible select or input in #disposition is empty (needsDisposition is hard-coded true). radioClicked is
//   overridden so that a radio cannot be unticked (:68). :88-89 moves the "No" radio and its label out of `#trauma` into `#no-goes-here` (a layout hack).
//   The disposition widget (coreapps) adds a ward select for Admission, a site select for Transfer out and a location select for Transfer within
//   hospital, and a date of death for Death: each becomes required through the same rule.
// Side effects on save: ApplyDispositionAction (:3) runs the configured actions of the chosen disposition (pih-dispositions-haiti.json); the tests use
//   "ED Observation" (no actions, keeps the visit open) and assert the visit stays open and the patient is not marked dead. Not saved by any test:
//   Admission, Transfer, Discharge, Death (they change visits, locations or the patient). The merged directory of 2026-10-30 still has a
//   RedirectToDeathNoteIfMissing post-submission action (UHM-9646 removed it from master); it is not triggered by ED Observation either way.
// Visit-page display: the visit page does NOT show this form's VIEW. The consultation entry of encounterTypeConfig.js (encounter type 92fd09b4-...,
//   shared with outpatientConsult) has no templateModelUrl: it renders the encounter's obs with templates/encounters/clinicConsultLong.page (rows
//   Diagnoses, Non-Coded Diagnoses, Disposition, Procedure performed, Return visit date, Clinical Note), so the VIEW test asserts those rows. The
//   trauma answers have no row there (not a finding: the template is shared with outpatientConsult) and the form's own VIEW (ifMode VIEW, :101-160)
//   is therefore not tested.
// Not covered here: the Death / Admission / Transfer / Discharge dispositions' actions, the other trauma types, provider/location/date behaviour
//   (see _shared.e2e.md).
//
// Findings: see pihemr _findings.e2e.md#edNote

const FORM = 'edNote.xml';
const save = (page: Page) => page.locator('#buttons button.submitButton');
const disposition = (page: Page) => page.locator('#disposition select').first();
const traumaYes = (page: Page) => page.locator('#trauma input[type=radio]').first();
const traumaNo = (page: Page) => page.locator('#no-goes-here input[type=radio]');
const traumaType = (page: Page) => page.locator('#trauma-type-container select');
const nonCodedToggle = (page: Page) => page.locator('p.check-inline input[type=checkbox]').first();

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext']) =>
  createEntryContext({ givenName: 'AutoEdNote', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(30) });

// The location select starts empty: one location has the ED Note Location tag (the site's fact, set before each test).
let ED_LOCATION = '';
const open = async (page: Page, context: Awaited<ReturnType<typeof newPatient>>) => {
  const form = await EntryFormPage.open(page, FORM, context);
  await expect(page.locator('#where select')).toBeVisible();
  await page.locator('#where select').selectOption({ label: ED_LOCATION });
  return form;
};
const pickDiagnosis = async (page: Page) => {
  await page.locator('#diagnosis-search').fill('mal');
  await page.locator('ul.ui-autocomplete li').first().click();
  await expect(page.locator('.diagnosis')).toHaveCount(1);
};

const editUrl = (patientUuid: string, encounterUuid: string, visitUuid: string) =>
  `htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?${new URLSearchParams({
    patientId: patientUuid,
    encounterId: encounterUuid,
    definitionUiResource: `file:configuration/pih/htmlforms/${FORM}`,
    returnUrl: visitPagePath(visitUuid),
  })}`;

test.describe('edNote', () => {
  test.beforeEach(({ site }) => {
    ED_LOCATION = specFacts(site, 'edNote').location;
  });
  test('ENTER: heading, who/where/when, the location starts empty with the ED Note location as its only option, Save starts disabled', async ({ page, createEntryContext }) => {
    // ifMode VIEW include=false :101, :155; encounterLocation tags="ED Note Location"
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('#where select')).toHaveValue('');
    await expect(page.locator('#where select option:not([value=""])')).toHaveText([ED_LOCATION]);
    await expect(page.locator('#when input.hasDatepicker')).toHaveValue(/\d{2} \w{3} \d{4}/);
    await expect(save(page)).toBeDisabled();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('#submit')).toHaveCount(0);
  });

  test('Save stays disabled until location, diagnosis, disposition and the trauma question are all answered', async ({ page, createEntryContext }) => {
    // validateForm :37-66
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await pickDiagnosis(page);
    await disposition(page).selectOption({ label: 'ED Observation' });
    await traumaNo(page).check();
    await expect(save(page), 'location still empty').toBeDisabled();
    await page.locator('#where select').selectOption({ label: ED_LOCATION });
    await expect(save(page)).toBeEnabled();

    await disposition(page).selectOption({ index: 0 });
    await expect(save(page), 'disposition cleared').toBeDisabled();
    await disposition(page).selectOption({ label: 'ED Observation' });
    await expect(save(page)).toBeEnabled();

    await page.locator('#encounter-diagnoses-target i.icon-remove').first().click();
    await expect(page.locator('.diagnosis')).toHaveCount(0);
    await expect(save(page), 'diagnosis removed').toBeDisabled();
  });

  test('the trauma question is required: without an answer Save stays disabled', async ({ page, createEntryContext }) => {
    // validateForm: getValue("trauma.value") must be set
    await open(page, await newPatient(createEntryContext));
    await pickDiagnosis(page);
    await disposition(page).selectOption({ label: 'ED Observation' });
    await expect(save(page)).toBeDisabled();
    await traumaNo(page).check();
    await expect(save(page)).toBeEnabled();
  });

  test('"Occurrence of trauma" Yes shows the type of trauma and makes it required; No hides and clears it', async ({ page, createEntryContext }) => {
    // updateTraumaQuestions :72-78 and validateForm
    await open(page, await newPatient(createEntryContext));
    await pickDiagnosis(page);
    await disposition(page).selectOption({ label: 'ED Observation' });
    await expect(page.locator('#trauma-type-container')).toBeHidden();

    await traumaYes(page).check();
    await expect(page.locator('#trauma-type-container')).toBeVisible();
    await expect(save(page), 'Yes without a type').toBeDisabled();
    await traumaType(page).selectOption({ label: 'Transport accident' });
    await expect(save(page)).toBeEnabled();

    await traumaNo(page).check();
    await expect(page.locator('#trauma-type-container')).toBeHidden();
    await expect(traumaType(page)).toHaveValue('');
    await expect(save(page)).toBeEnabled();

    // a radio cannot be unticked (radioClicked is overridden to do nothing)
    await traumaNo(page).click();
    await expect(traumaNo(page)).toBeChecked();
  });

  test('"Non-coded diagnosis" shows its text, but the text alone does not satisfy the diagnosis rule (V1)', async ({ page, createEntryContext }) => {
    // toggle :116; validateForm needs a `.diagnosis` chip (outpatientConsult also accepts the non-coded text)
    await open(page, await newPatient(createEntryContext));
    const div = page.locator('#nonCodedDiagnosis');
    await expect(div).toBeHidden();
    await nonCodedToggle(page).check();
    await expect(div).toBeVisible();
    await div.locator('textarea').fill('unclear abdominal pain');
    await disposition(page).selectOption({ label: 'ED Observation' });
    await traumaNo(page).check();
    await expect(save(page)).toBeDisabled();
    await pickDiagnosis(page);
    await expect(save(page)).toBeEnabled();
    await nonCodedToggle(page).uncheck();
    await expect(div).toBeHidden();
  });

  test('dispositions with an extra field make that field required (no save)', async ({ page, createEntryContext }) => {
    // validateForm: a visible empty select / input inside #disposition keeps Save disabled
    await open(page, await newPatient(createEntryContext));
    await pickDiagnosis(page);
    await traumaNo(page).check();

    await disposition(page).selectOption({ label: 'Admission' });
    await expect(page.locator('#disposition select:visible')).toHaveCount(2);
    await expect(save(page)).toBeDisabled();
    await page.locator('#disposition select:visible').nth(1).selectOption({ index: 1 });
    await expect(save(page)).toBeEnabled();

    await disposition(page).selectOption({ label: 'Death' });
    await expect(page.locator('#dateOfDeath input.hasDatepicker')).toBeVisible();
    await expect(save(page)).toBeDisabled();

    await disposition(page).selectOption({ label: 'ED Observation' });
    await expect(page.locator('#dateOfDeath input.hasDatepicker')).toBeHidden();
    await expect(page.locator('#disposition select:visible')).toHaveCount(1);
    await expect(save(page)).toBeEnabled();
  });

  const RETURN = isoDate(14);
  // the consult template prints dates as "Nov 23, 2026"
  const visitPageDate = (iso: string) => viewDate(iso).replace(/^(\d+) (\w+) (\d+)$/, '$2 $1, $3');
  // Saves a full ED note: diagnosis, non-coded text, ED Observation, trauma Yes + type, return visit date, comment.
  const saveFull = async (page: Page, api: APIRequestContext, createEntryContext: PihemrFixtures['createEntryContext']) => {
    const context = await newPatient(createEntryContext);
    const form = await open(page, context);
    await pickDiagnosis(page);
    await nonCodedToggle(page).check();
    await page.locator('#nonCodedDiagnosis textarea').fill('also unclear abdominal pain');
    await disposition(page).selectOption({ label: 'ED Observation' });
    await traumaYes(page).check();
    await traumaType(page).selectOption({ label: 'Transport accident' });
    await pickDate(page.locator('p.narrow input.hasDatepicker'), RETURN);
    await page.locator('textarea').last().fill('seen in the ED');
    await save(page).click();
    await form.expectSaved();

    const encounters = await getPatientEncounters(api, context.patient.uuid);
    expect(encounters.map((e) => e.encounterType.uuid)).toEqual([CONSULT_ENCOUNTER_TYPE_UUID]);
    const displays = (await getEncounterObs(api, encounters[0].uuid)).map((o) => o.display);
    expect(displays).toEqual(
      expect.arrayContaining([
        'Clinical impression comments: seen in the ED',
        'Disposition categories: Emergency Department observation',
        'Diagnosis order: Primary',
        'Occurrence of trauma: Yes',
        'Type of trauma: Transport accident',
      ]),
    );
    expect(displays.some((d) => d.startsWith('Diagnosis: '))).toBe(true);
    expect(displays.some((d) => d.includes('also unclear abdominal pain'))).toBe(true);
    expect(displays.some((d) => d.startsWith('Return visit date: ') && d.includes(RETURN))).toBe(true);

    const visit = await (await api.get(`visit/${context.visitUuid}?v=custom:(stopDatetime)`)).json();
    expect(visit.stopDatetime).toBeNull();
    const patient = await (await api.get(`patient/${context.patient.uuid}?v=custom:(person:(dead))`)).json();
    expect(patient.person.dead).toBe(false);
    return { context, encounters, displays };
  };

  test('saves a full ED note with ED Observation; the visit stays open and the patient is not marked dead', async ({ page, api, createEntryContext }) => {
    await saveFull(page, api, createEntryContext);
  });

  test('the visit page shows the saved note in the consult template: diagnosis, non-coded diagnosis, disposition, return date and comment', async ({
    page,
    api,
    createEntryContext,
  }) => {
    const { context, displays } = await saveFull(page, api, createEntryContext);
    const visit = await VisitPage.open(page, context.visitUuid);
    const long = await visit.expand(visit.encounterOfType(CONSULT_ENCOUNTER_TYPE_UUID));
    const row = (heading: string) => long.locator(`div:has(> .left-column > h3:text-is("${heading}")) > .right-column`);
    const diagnosis = (displays.find((d) => d.startsWith('Diagnosis: ')) ?? '').replace('Diagnosis: ', '');
    await expect(row('Diagnoses').locator('p.diagnosis')).toHaveCount(1);
    await expect(row('Diagnoses')).toContainText(diagnosis);
    await expect(row('Diagnoses')).toContainText('Primary');
    await expect(row('Non-Coded Diagnoses')).toContainText('also unclear abdominal pain');
    await expect(row('Disposition')).toContainText('Emergency Department observation');
    await expect(row('Return visit date')).toContainText(visitPageDate(RETURN));
    await expect(row('Clinical Note')).toHaveText('seen in the ED');
    // not filled in
    await expect(row('Procedure performed'), 'Procedure performed is empty').toHaveText('');
  });

  test('EDIT starts from the saved values (trauma Yes shows its type) and moving to No clears the type', async ({ page, api, createEntryContext }) => {
    // updateTraumaQuestions runs on load; validateForm runs on load
    const { context, encounters } = await saveFull(page, api, createEntryContext);
    await page.goto(editUrl(context.patient.uuid, encounters[0].uuid, context.visitUuid));
    await expect(page.locator('.diagnosis')).toHaveCount(1);
    await expect(disposition(page).locator('option:checked')).toHaveText('ED Observation');
    await expect(traumaYes(page)).toBeChecked();
    await expect(page.locator('#trauma-type-container')).toBeVisible();
    await expect(traumaType(page).locator('option:checked')).toHaveText('Transport accident');
    await expect(page.locator('#nonCodedDiagnosis textarea')).toHaveValue('also unclear abdominal pain');
    await expect(page.locator('p.narrow input.hasDatepicker')).toHaveValue(new RegExp(`^${viewDate(RETURN).replace(/^(\d) /, '0$1 ')}$`));
    await expect(save(page)).toBeEnabled();

    await traumaNo(page).check();
    await expect(page.locator('#trauma-type-container')).toBeHidden();
    await save(page).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    const displays = (await getEncounterObs(api, encounters[0].uuid)).map((o) => o.display);
    expect(displays).toContain('Occurrence of trauma: No');
    expect(displays.some((d) => d.startsWith('Type of trauma'))).toBe(false);
  });
});
