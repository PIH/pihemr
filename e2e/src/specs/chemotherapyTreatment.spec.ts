import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { CHEMOTHERAPY_TREATMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getPatientEncounters } from '../rest';
import { EntryFormPage, VISIT_PAGE_URL, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';
import { expectObs, obsDisplays } from '../pages/form-widgets';

// chemotherapyTreatment.xml: "Oncology Chemotherapy Treatment Session", one short full form of the Chemotherapy treatment session encounter: type of visit, the chemotherapy protocol
// (13 regimen checkboxes + Other with a comment), cycle number "N of M", treatment received (Yes / No, No asks for a reason), treatment tolerated (Yes / "no (please explain)"
// with a comment), side effects (15 checkboxes + Other with a comment), pain scale and details, the patient plan and important visit information. Top-level form: the specs open
// enterHtmlFormWithStandardUi inside a visit they created (EntryFormPage), which skips the visit action's gating (_availability.e2e.md: `programs` + `oncology`, Chemotherapy
// Location, `Task: emr.enterOncologyConsultNote`). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). who / where / when is EPLD with its default tag (Consult Note Location, NOT Chemotherapy Location), so the
// session location Klinik Ekstèn is preselected and the form is shown (no auto-submit). HFE <submit> tag: the button is `#buttons input.submitButton`, there is no `#submit`.
// Nothing but the provider and the location is required.
//
// Conditions in the form, from documentation inventory (chemotherapyTreatment.inv.md):
//   when CIEL:1066 (treatment received = No) :117  shows #no-treatment (the reason dropdown); Yes hides it. The inventory's "value not in answerConceptIds" lead is a false alarm
//                           (PIH:NO is CIEL:1066: the target toggles, tested)
//   ifMode VIEW include=false  :50 heading, :201 #buttons: absent in VIEW
// Scripts: none of its own (EPLD's: _shared.e2e.md).
// Side effects on save: enrollInProgram Oncology (:60, locationTag "Program Location"): the patient is enrolled in the Oncology program on every save, with no field for it (tested,
//   a blank save enrols too); no postSubmissionAction, no order.
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, encounter type 828964fa: templateModelUrl with no definitionUiResource, so the form the
//   encounter was saved with; longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#chemotherapyTreatment.xml
//   V1 Low :174 the pain scale dropdown (`answers="0,1,...,10"`) lists "0.0" ... "10.0" (the concept is numeric with a decimal precision): tested (the save test picks "4.0")
//   V2 Info :58 the form's who / where / when is EPLD with its default tag, so the location select offers the Consult Note Locations, not the 2 Chemotherapy Locations (zl-ci)
//   that the visit action requires of the session location: a session at a Chemotherapy Location can record the session at any consult location
// Not covered here: availability, the other 11 protocol and 13 side-effect checkboxes (same markup as the ones tested), the "Initial chemotherapy session" box beyond the save test,
//   changing the encounter date.

const FORM = 'chemotherapyTreatment.xml';
const SAVE = '#buttons input.submitButton';

// HFE control ids (the `wN` ids are numbered by position in the form; they are the only handle most of these inputs have).
const ID = {
  visitType: '#w8', // "Initial chemotherapy session"
  protocolOther: '#w36',
  protocolOtherComment: '#w37',
  cycle: '#w39',
  cycles: '#w41',
  receivedYes: '#w43_0',
  receivedNo: '#w43_1',
  noReason: '#w45', // inside #no-treatment
  toleratedYes: '#w47_0',
  toleratedNo: '#w47_1',
  toleratedComment: '#w48',
  none: '#w50', // side effect "None"
  fatigue: '#w52',
  nausea: '#w70',
  sideEffectOther: '#w80',
  sideEffectOtherComment: '#w81',
  pain: '#w83',
  painDetails: '#w85',
  planContinue: '#w87_0',
  planInterrupt: '#w87_1',
  info: '#w89',
};

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = 50) =>
  createEntryContext({ givenName: 'AutoChemo', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });
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
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([CHEMOTHERAPY_TREATMENT_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};
const enrollments = async (api: APIRequestContext, patientUuid: string) => {
  const res = await api.get(`programenrollment?patient=${patientUuid}&v=custom:(program:(name),dateCompleted)`);
  expect(res.ok(), `get enrollments: ${res.status()}`).toBeTruthy();
  return (await res.json()).results as Array<{ program: { name: string }; dateCompleted: string | null }>;
};
// The comment of the saved obs whose display starts with `prefix` (lower case).
const obsComments = async (api: APIRequestContext, encounterUuid: string): Promise<Array<{ display: string; comment: string | null }>> => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display,comment)&limit=100`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as Array<{ display: string; comment: string | null }>).map((o) => ({ display: o.display.toLowerCase(), comment: o.comment }));
};

test.describe('chemotherapyTreatment', () => {
  test('ENTER shows the heading, who / where / when with the session location, the Treatment fields and Save / Cancel; the reason for no treatment is hidden', async ({
    page,
    createEntryContext,
  }) => {
    // ifMode VIEW include=false :50, :201; when :117 (initial state)
    await open(page, createEntryContext);
    await expect(page.locator('h2')).toHaveText(/Chemotherapy/i);
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#where select option:checked')).toHaveCount(1);
    await expect(page.locator('#where select')).not.toHaveValue('');
    await expect(page.locator('legend')).toHaveText(['Treatment']);
    await expect(page.locator('input[type=checkbox]')).toHaveCount(1 + 13 + 1 + 16); // visit type, 13 protocols + Other, 16 side effects (None ... Other)
    await expect(page.locator('#no-treatment')).toBeHidden();
    await expect(page.locator(ID.noReason)).toBeHidden();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('.print-form-datestamps')).toBeHidden();
    await expect(page.locator('#submit'), 'the <submit> tag has no #submit').toHaveCount(0);
  });

  test('a blank Save is accepted: a form-linked encounter in the visit with no obs, and the patient is enrolled in the Oncology program (enrollInProgram :60)', async ({
    site,
    page,
    api,
    createEntryContext,
  }) => {
    const context = await open(page, createEntryContext);
    expect(await enrollments(api, context.patient.uuid)).toEqual([]);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    expect(new Date(header.encounterDatetime).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(await obsDisplays(api, encounterUuid)).toEqual([]);
    const enrolled = await enrollments(api, context.patient.uuid);
    expect(enrolled.map((e) => e.program.name.toLowerCase())).toEqual([expect.stringContaining('oncology')]);
    expect(enrolled[0].dateCompleted).toBeNull();
  });

  test('saving without a provider is refused with "Required" and creates nothing', async ({ page, api, createEntryContext }) => {
    // encounterProviderAndRole required (encounter-provider-location-date.xml)
    const context = await open(page, createEntryContext);
    await page.locator('#who select').first().selectOption({ index: 0 });
    await page.locator(SAVE).click();
    await expect(page.locator('#who span.field-error')).toContainText('Required');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    expect(await enrollments(api, context.patient.uuid), 'nothing is enrolled by a refused save').toEqual([]);
  });

  test('treatment received "No" shows the reason dropdown, "Yes" hides it again (when CIEL:1066 :117)', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('#no-treatment')).toBeHidden();
    await page.locator(ID.receivedNo).check();
    await expect(page.locator('#no-treatment')).toBeVisible();
    await expect(page.locator(ID.noReason)).toBeVisible();
    await expect(page.locator(`${ID.noReason} option`)).toHaveText(['', 'Missed visit', 'Too ill to take medication', 'Abnormal lab result', 'Drug not available - out of stock', 'Material, supply, or equipment unavailable']);
    await page.locator(ID.receivedYes).check();
    await expect(page.locator('#no-treatment')).toBeHidden();
  });

  test('saves the visit type, protocol (with the Other comment), cycle N of M, treatment received No with its reason, tolerated with a comment, side effects, pain, plan and information; VIEW shows them; EDIT starts from them and a changed answer replaces the old one', async ({
    page,
    api,
    createEntryContext,
  }) => {
    const context = await open(page, createEntryContext);
    await page.locator(ID.visitType).check();
    await page.getByLabel('Palliative Single Agent - Paclitaxel', { exact: true }).check();
    await page.locator(ID.protocolOther).check();
    await page.locator(ID.protocolOtherComment).fill('Investigational regimen');
    await page.locator(ID.cycle).fill('2');
    await page.locator(ID.cycles).fill('6');
    await page.locator(ID.receivedNo).check();
    await page.locator(ID.noReason).selectOption({ label: 'Abnormal lab result' });
    await page.locator(ID.toleratedNo).check();
    await page.locator(ID.toleratedComment).fill('Severe mucositis after day 3');
    await page.locator(ID.fatigue).check();
    await page.locator(ID.nausea).check();
    await page.locator(ID.sideEffectOther).check();
    await page.locator(ID.sideEffectOtherComment).fill('Hair loss');
    await page.locator(ID.pain).selectOption({ label: '4.0' });
    await page.locator(ID.painDetails).fill('Lower back, worse at night');
    await page.locator(ID.planInterrupt).check();
    await page.locator(ID.info).fill('Return with a blood count');
    await save(page);

    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(
      displays,
      'initial chemotherapy session',
      'palliative single agent - paclitaxel',
      'chemotherapy cycle number: 2',
      'total number of planned chemotherapy cycles: 6',
      'chemotherapy treatment received: no',
      'abnormal lab result',
      'chemotherapy treatment tolerated: no',
      'fatigue',
      'nausea',
      'pain scale: 4',
      'lower back, worse at night',
      'planned treatment interruption',
      'return with a blood count',
    );
    const comments = await obsComments(api, encounterUuid);
    expect(comments.find((c) => c.display.startsWith('chemotherapy treatment tolerated'))?.comment).toBe('Severe mucositis after day 3');
    expect(comments.filter((c) => c.comment === 'Investigational regimen' || c.comment === 'Hair loss'), 'the two Other comments').toHaveLength(2);
    expect((await enrollments(api, context.patient.uuid)).map((e) => e.program.name.toLowerCase())).toEqual([expect.stringContaining('oncology')]);

    // VIEW on the visit page
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid);
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('[X] Initial chemotherapy session');
    expect(shown).toContain('[X] Palliative Single Agent - Paclitaxel');
    expect(shown).toContain('[X] No');
    expect(shown).toContain('Abnormal lab result');
    expect(shown).toContain('Severe mucositis after day 3');
    expect(shown).toContain('Investigational regimen');
    expect(shown).toContain('Hair loss');
    expect(shown).toContain('[X] Fatigue');
    expect(shown).toContain('[X] Planned treatment interruption');
    expect(shown).toContain('Lower back, worse at night');
    expect(shown).toContain('Return with a blood count');
    // not saved: not shown as a value
    expect(shown).not.toContain('[X] Palliative Single Agent - Doxorubicin');
    expect(shown).not.toContain('[X] Vomiting');
    expect(shown).not.toContain('[X] Continue treatment');
    await expect(view.root.locator('#buttons, h2')).toHaveCount(0);
    await expect(view.page.locator(SAVE)).toHaveCount(0);

    // EDIT: the saved values and the script state (the reason is shown because "No" is saved)
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator(ID.visitType)).toBeChecked();
    await expect(page.locator(ID.protocolOtherComment)).toHaveValue('Investigational regimen');
    await expect(page.locator(ID.cycle)).toHaveValue('2');
    await expect(page.locator(ID.cycles)).toHaveValue('6');
    await expect(page.locator(ID.receivedNo)).toBeChecked();
    await expect(page.locator('#no-treatment')).toBeVisible();
    await expect(page.locator(ID.noReason)).toHaveValue(/.+/);
    await expect(page.locator(ID.toleratedNo)).toBeChecked();
    await expect(page.locator(ID.toleratedComment)).toHaveValue('Severe mucositis after day 3');
    await expect(page.locator(ID.sideEffectOtherComment)).toHaveValue('Hair loss');
    await expect(page.locator(ID.pain)).toHaveValue(/.+/);
    await expect(page.locator(ID.planInterrupt)).toBeChecked();
    // change the answers: treatment received Yes, plan Continue, drop the nausea
    await page.locator(ID.receivedYes).check();
    await expect(page.locator('#no-treatment')).toBeHidden();
    await page.locator(ID.planContinue).check();
    await page.locator(ID.nausea).uncheck();
    await save(page);

    expect(await getPatientEncounters(api, context.patient.uuid), 'EDIT keeps the one encounter').toHaveLength(1);
    const after = await obsDisplays(api, encounterUuid);
    expectObs(after, 'chemotherapy treatment received: yes', 'continue treatment', 'fatigue', 'palliative single agent - paclitaxel');
    expect(after.some((d) => d.includes('chemotherapy treatment received: no')), 'the old answer is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('planned treatment interruption')), 'the old plan is replaced').toBeFalsy();
    expect(after.some((d) => d.includes('nausea')), 'the unticked side effect is voided').toBeFalsy();
    expect(await enrollments(api, context.patient.uuid), 'EDIT does not enrol a second time').toHaveLength(1);
    const view2 = await ViewFormPage.open(page, FORM, encounterUuid);
    const shown2 = (await view2.valueTexts()).join(' | ');
    expect(shown2).toContain('[X] Continue treatment');
    expect(shown2).not.toContain('[X] Planned treatment interruption');
    expect(shown2).not.toContain('[X] Nausea');
  });
});
