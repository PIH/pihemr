import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { ONCOLOGY_TREATMENT_PLAN_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, obsDisplays } from '../pages/form-widgets';

// oncologyTreatment.xml: "Oncology Treatment Plan", a short full form of the Oncology Treatment Plan encounter: up to three confirmed diagnoses (autocomplete, each with
// primary / secondary checkboxes and a hidden "confirmed" box), the cancer stage (radio), the treatment intent (a program workflow state of the Oncology program: curatif /
// palliatif) and the plan details (text). Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit they created (EntryFormPage), which skips the visit
// action's gating (_availability.e2e.md: `programs` + `oncology`, Oncology Consult Location, `Task: emr.enterOncologyConsultNote`, no treatment-plan or consult encounter
// in the visit). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). HFE <submit> tag: the button is `#buttons input.submitButton`, there is no `#submit`. who / where / when is EPLD (default tag Consult Note
// Location: the session location Klinik Ekstèn is preselected), so the form is shown (no auto-submit). Nothing is required.
//
// Conditions in the form (read by hand: 214 lines, no <when>, toggle or includeIf):
//   ifMode VIEW include=false  :48-100 the diagnosis script, :114-120 the <h2>, :205-212 the #buttons row: absent in VIEW
// Scripts :49-98 (ENTER and EDIT), on the three `.diagnosis-construct` blocks:
//   focusout of `.diagnosis input`: with text -> tick the hidden "confirmed" box, and tick "primary" when neither primary nor secondary is ticked; empty -> untick all three
//   change of primary / secondary: ticking one unticks the other; with no diagnosis text neither can be ticked
// Side effects on save: the workflowState widget (:189, workflow 45ffa97a-..., states curatif / palliatif): choosing one enrols the patient in the Oncology program with that
//   state when not yet enrolled (tested); no enrollInProgram tag, no postSubmissionAction, no order.
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type f9cfdf8b: templateModelUrl with no definitionUiResource, so the form the
//   encounter was saved with; longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs. The helper skips the diagnosis obs (the widget prints them
//   as plain text): they are asserted by text below.
// Findings: see pihemr _findings.e2e.md#oncologyTreatment.xml
//   V1 Low :192 stateLabels are the French words "curatif, palliatif" (tested, test.fixme), V2 Low :15 id="oncology-intake" on the treatment plan form (tested)
// Not covered here: availability, the French labels (the harness user's locale is English), the third diagnosis block (same markup as the first two), changing the encounter date.

const FORM = 'oncologyTreatment.xml';
const SAVE = '#buttons input.submitButton';

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = 50) =>
  createEntryContext({ givenName: 'AutoOncTreat', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });
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
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([ONCOLOGY_TREATMENT_PLAN_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};

const construct = (page: Page, n: number) => page.locator('.diagnosis-construct').nth(n);
const diagnosisText = (c: Locator) => c.locator('.diagnosis input[type=text]');
const primary = (c: Locator) => c.locator('.diagnosis-primary input[type=checkbox]');
const secondary = (c: Locator) => c.locator('.diagnosis-secondary input[type=checkbox]');
const confirmed = (c: Locator) => c.locator('.diagnosis-confirmed input[type=checkbox]');
const stage = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const intent = (page: Page) => page.locator('select', { has: page.locator('option', { hasText: 'curatif' }) });
const planDetails = (page: Page) => page.locator('textarea');

// Types a search text in the diagnosis box, picks the nth suggestion and returns its text; the box then loses focus (the script reacts to focusout).
const pickDiagnosis = async (page: Page, c: Locator, search: string, nth = 0): Promise<string> => {
  await diagnosisText(c).pressSequentially(search, { delay: 60 });
  const item = page.locator('ul.ui-autocomplete:visible li').nth(nth);
  await expect(item).toBeVisible();
  const text = (await item.innerText()).trim();
  await item.click();
  await page.locator('h2').click(); // blur
  return text;
};

const enrollment = async (api: APIRequestContext, patientUuid: string) => {
  const res = await api.get(`programenrollment?patient=${patientUuid}&v=custom:(program:(name),states:(state:(concept:(display)),endDate))`);
  expect(res.ok(), `get enrollments: ${res.status()}`).toBeTruthy();
  return (await res.json()).results as Array<{ program: { name: string }; states: Array<{ state: { concept: { display: string } }; endDate: string | null }> }>;
};

test.describe('oncologyTreatment', () => {
  test('ENTER shows the heading, who / where / when with the session location, the diagnosis block, stage, intent and plan fields, and Save / Cancel', async ({
    page,
    createEntryContext,
  }) => {
    // ifMode VIEW include=false :114, :205
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText(/Oncology Treatment Plan/);
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#where select option:checked')).toHaveCount(1);
    await expect(page.locator('#where select')).not.toHaveValue('');
    await expect(page.locator('legend')).toHaveText(['Diagnosis']);
    await expect(page.locator('.diagnosis-construct')).toHaveCount(3);
    await expect(page.locator('.diagnosis-construct .diagnosis input[type=text]')).toHaveCount(3);
    await expect(page.locator('input[type=radio]')).toHaveCount(6); // the cancer stages: I, II, III, IV, unknown, N/A
    await expect(intent(page).locator('option')).toHaveText(['', 'curatif', 'palliatif']);
    await expect(planDetails(page)).toHaveCount(1);
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
  });

  test('nothing is required: a blank Save creates an empty encounter and enrols nobody', async ({ site, page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(await obsDisplays(api, encounterUuid)).toEqual([]);
    expect(await enrollment(api, context.patient.uuid)).toEqual([]);
  });

  test('a diagnosis ticks "primary" and the hidden "confirmed" box when its box loses focus; clearing the text unticks them (focusout :51)', async ({
    page,
    createEntryContext,
  }) => {
    await open(page, createEntryContext);
    const c = construct(page, 0);
    await expect(primary(c)).not.toBeChecked();
    await pickDiagnosis(page, c, 'cancer');
    await expect(primary(c)).toBeChecked();
    await expect(secondary(c)).not.toBeChecked();
    await expect(confirmed(c)).toBeChecked();
    // the second block is not touched
    await expect(primary(construct(page, 1))).not.toBeChecked();
    await expect(confirmed(construct(page, 1))).not.toBeChecked();
    // clear the text: all three are unticked
    await diagnosisText(c).fill('');
    await page.locator('h2').click();
    await expect(primary(c)).not.toBeChecked();
    await expect(secondary(c)).not.toBeChecked();
    await expect(confirmed(c)).not.toBeChecked();
  });

  test('primary and secondary exclude each other, and neither can be ticked without a diagnosis (change handlers :69, :83)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    const c = construct(page, 0);
    // no diagnosis text: the boxes cannot be ticked
    await primary(c).check({ force: true }).catch(() => undefined);
    await expect(primary(c)).not.toBeChecked();
    await secondary(c).check({ force: true }).catch(() => undefined);
    await expect(secondary(c)).not.toBeChecked();

    await pickDiagnosis(page, c, 'cancer');
    await secondary(c).check();
    await expect(secondary(c)).toBeChecked();
    await expect(primary(c)).not.toBeChecked();
    await primary(c).check();
    await expect(primary(c)).toBeChecked();
    await expect(secondary(c)).not.toBeChecked();
  });

  test('saves two diagnoses (primary and secondary), the stage, the intent and the plan; the patient is enrolled with that state; EDIT starts from the values; VIEW shows them', async ({
    page,
    api,
    createEntryContext,
  }) => {
    const context = await open(page, createEntryContext);
    const first = await pickDiagnosis(page, construct(page, 0), 'cancer', 0);
    const second = await pickDiagnosis(page, construct(page, 1), 'cancer', 1);
    expect(second).not.toBe(first);
    await secondary(construct(page, 1)).check();
    await stage(page, 'Stage II').check();
    await intent(page).selectOption({ label: 'curatif' });
    await planDetails(page).fill('Neoadjuvant chemotherapy, then surgery');
    await save(page);

    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(displays, first, second, 'stage ii', 'neoadjuvant chemotherapy, then surgery');
    expect(displays.filter((d) => d.startsWith('visit diagnoses')), 'two diagnosis groups').toHaveLength(2);
    // primary on the first diagnosis, secondary on the second; both confirmed
    expect(displays.filter((d) => d.includes('diagnosis order: primary'))).toHaveLength(1);
    expect(displays.filter((d) => d.includes('diagnosis order: secondary'))).toHaveLength(1);
    expect(displays.filter((d) => d.startsWith('diagnosis certainty: confirmed')), 'the hidden confirmed box of both').toHaveLength(2);
    // the workflow state enrols the patient in Oncology with that state
    const enrolled = await enrollment(api, context.patient.uuid);
    expect(enrolled.map((e) => e.program.name.toLowerCase())).toEqual([expect.stringContaining('oncology')]);
    expect(enrolled[0].states.filter((s) => s.endDate === null).map((s) => s.state.concept.display)).toEqual([expect.stringMatching(/curat/i)]);

    // VIEW on the visit page
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid);
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown.toLowerCase()).toContain(first.toLowerCase());
    expect(shown.toLowerCase()).toContain(second.toLowerCase());
    expect(shown).toContain('[X] Stage II');
    expect(shown).toContain('Neoadjuvant chemotherapy, then surgery');
    await expect(view.root.locator('.value', { hasText: '[X] Stage III' })).toHaveCount(0);
    await expect(view.root.locator('#buttons, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: the saved values are shown, the script state matches (primary on the first diagnosis, secondary on the second). HFE does not keep the order of the two obs groups
    // when it fills the blocks, so the blocks are found by their text.
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    const texts = await Promise.all([0, 1, 2].map(async (n) => (await diagnosisText(construct(page, n)).inputValue()).toLowerCase()));
    expect(texts.filter((t) => t !== '').sort()).toEqual([first.toLowerCase(), second.toLowerCase()].sort());
    expect(texts.filter((t) => t === ''), 'the third block is empty').toHaveLength(1);
    const blockOf = (text: string) => construct(page, texts.indexOf(text.toLowerCase()));
    await expect(primary(blockOf(first))).toBeChecked();
    await expect(secondary(blockOf(first))).not.toBeChecked();
    await expect(secondary(blockOf(second))).toBeChecked();
    await expect(primary(blockOf(second))).not.toBeChecked();
    await expect(stage(page, 'Stage II')).toBeChecked();
    await expect(planDetails(page)).toHaveValue('Neoadjuvant chemotherapy, then surgery');
    await stage(page, 'Stage III').check();
    await planDetails(page).fill('Palliative radiotherapy');
    await save(page);
    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, 'stage iii', 'palliative radiotherapy', first, second);
    expect(after.some((d) => d.includes('stage ii') && !d.includes('stage iii')), 'the old stage is replaced').toBeFalsy();
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    const shown2 = (await view2.valueTexts()).join(' | ');
    expect(shown2).toContain('[X] Stage III');
    expect(shown2).toContain('Palliative radiotherapy');
    expect(shown2).not.toContain('Neoadjuvant');
  });

  // Intended: the intent labels follow the user's locale like every other label of the form. They are the hard-coded French words "curatif, palliatif" (stateLabels), so an
  // English user sees French. V1 of pihemr _findings.e2e.md#oncologyTreatment.xml.
  test.fixme('oncologyTreatment V1: the treatment intent options are translated for an English user', async ({ page, createEntryContext }) => {
    // remove test.fixme() when the stateLabels are message codes
    await open(page, createEntryContext);
    await expect(page.locator('select option', { hasText: /^curative$/i })).toHaveCount(1);
  });

  test('V2: the id "oncology-intake" (copied from the intake form) is on the treatment plan form', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('[id="oncology-intake"]')).toHaveCount(1);
  });
});
