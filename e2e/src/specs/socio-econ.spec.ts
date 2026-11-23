import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures, type EntryContext } from '../contract';
import { SOCIO_ECONOMICS_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { expectObs, isoDate, obsDisplays, pickerDate } from '../pages/form-widgets';
import { getLocationName } from '../rest';

// socio-econ.xml: "Socioeconomics Note", the patient's education, housing, transport, daily activity, (women) prenatal support, assistance and the
// 10-question MPI poverty index, in one page. Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit they created (EntryFormPage), so
// the visit action's gating (_availability.e2e.md: `socioEconomics`, Consult Note Location, `Task: emr.enterSocioEconomics`, one per visit) is
// not exercised. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). The form uses <submit>: there is no #submit, the button is `#buttons input.submitButton`. The encounter date
// (default now) and the provider (default current user, role 4f10ad1a, required) are in a div with class "hidden" (:492) and cannot be edited.
//
// Conditions in the form, from documentation inventory (socio-econ.inv.md):
//   when CIEL:159549=CIEL:1065 :307  #which-healer  (checkboxes: traditional healer, houngan, manbo, church, other) shown when "care from an
//                                                  alternative source" is Yes; hidden at load, in EDIT it follows the saved value (tested)
//   includeIf $patient.gender == 'F' :295   the PRENATAL section (alternative-source care, who supports financially / otherwise)
//   includeIf $patient.gender == 'F' :415   "Support from family" and "Spouse/Partner/Household supports antenatal care" in ASSISTANCE
//   ifMode VIEW include=false :7, :22, :35, :512   style, the location select (`div#where`), the h2 and the Save / Cancel buttons (ENTER and EDIT only)
//   Required (HFE): the location (`Consult Note Location` tag; defaults to the session location) and the provider.
// Scripts: none in the file. Side effects on save: none (no program, no order). Encounter type Socioeconomics (de844e58).
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, de844e58: templateModelUrl with
//   definitionUiResource=socio-econ.xml, longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage / expectViewShowsSavedObs. The assistance
//   checkboxes have answerLabel="" so the VIEW prints "[X]" with no text (the row label is in the first cell): the helper's `labels` skip them.
// Not covered here: the provider-required error (the provider widget is in the hidden div and the harness user has a provider account), a
//   retrospective encounter date, the Cancel button, the "housing expenses" aid row.
//
// Findings: see pihemr _findings.e2e.md#socio-econ

const FORM = 'socio-econ.xml';
const SAVE = '#buttons input.submitButton';
const ENCOUNTER_ROLE_UUID = '4f10ad1a-ec49-48df-98c7-1391c6ac7f05';

// The <p> that holds the label with this exact text (the form's questions are `<p><label>..</label> <obs/></p>`).
const q = (scope: Page | Locator, label: string): Locator => scope.locator('p', { has: scope.locator(`label:text-is("${label}")`) }).last();
// HFE radios keep their own click handlers (radioDown / radioClicked toggle a ticked radio off), so click once and verify.
const pick = async (scope: Locator, answer: string) => {
  const radio = scope.getByLabel(answer, { exact: true });
  await radio.click();
  await expect(radio).toBeChecked();
};
const aid = (page: Page, label: string) => page.locator('#assistance tr', { has: page.locator(`label:text-is("${label}")`) }).locator('input[type=checkbox]');
const otherAidRow = (page: Page) => page.locator('#assistance tr', { hasText: 'if other, specify' });
const mpi = (page: Page) => page.locator('#mpi table tr').filter({ has: page.locator('input[type=radio]') });
const MPI_ANSWERS = ['Yes', 'No', 'unknown'];
const healer = (page: Page, label: string) => page.locator('#which-healer').getByLabel(label, { exact: true });

const open = async (page: Page, createEntryContext: PihemrFixtures['createEntryContext'], gender: 'F' | 'M') => {
  const context = await createEntryContext({ givenName: 'AutoSocio', familyName: 'Tester', gender, birthdate: birthdateYearsAgo(30) });
  await EntryFormPage.open(page, FORM, context);
  await expect(page.locator('#where select')).toBeVisible();
  return context;
};
const editUrl = (context: EntryContext, encounterUuid: string) =>
  SectionFormPage.editUrl(FORM, { patient: context.patient, encounter: { uuid: encounterUuid, visitUuid: context.visitUuid } });

// Fills every field of the form once (the prenatal and family-support ones only for a woman). "Housing expenses" is left unticked.
const fillAll = async (page: Page, female: boolean) => {
  await pick(q(page, 'Level of education'), 'University');
  await pick(q(page, 'Able to read and write'), 'No');
  await q(page, 'Number of people living in house').locator('input').fill('6');
  await q(page, 'Number of living children').locator('input').fill('2');
  await q(page, 'Number of rooms').locator('input').fill('3');
  await pick(q(page, 'Radio'), 'Yes');
  await pick(q(page, 'Television'), 'No');
  await pick(q(page, 'Refrigerator'), 'Yes');
  await pick(q(page, 'Bank account'), 'No');
  await q(page, 'Number of months residing in Haiti').locator('input').fill('14');
  await pick(q(page, 'Toilet'), 'No');
  await pick(q(page, 'Latrine'), 'Yes');
  await pick(q(page, 'Floor'), 'Ceramic tile');
  await pick(q(page, 'Roof'), 'Thatch');
  await pick(q(page, 'Walls'), 'Bamboo');
  await pick(q(page, 'Money available for transport'), 'Yes');
  await pick(q(page, 'Transport method to clinic?'), 'Donkey');
  await q(page, 'Cost of transport').locator('input').fill('250');
  await pick(q(page, 'Travel time to clinic?'), '1 to 2 hours');
  await q(page, 'Comment').locator('input').fill('AutoTransport comment');
  await page.locator('p', { hasText: 'Ki pi gwo aktivite' }).locator('input').fill('AutoMain activity');
  await page.locator('p', { hasText: 'Eske kounye a jan w santi w la' }).locator('input').fill('AutoLimited');
  await pick(q(page, 'Currently employed'), 'Yes');
  if (female) {
    await pick(q(page, 'Received care from an alternative source'), 'Yes');
    await healer(page, 'Traditional healer').check();
    await healer(page, 'Manbo').check();
    await healer(page, 'Other').check();
    const support = q(page, 'Provides financial support').locator('input[type=radio]'); // both questions are in one <p>: 4 financial, then 4 non-financial
    await support.nth(0).click(); // financial: Partner or Spouse
    await support.nth(4 + 2).click(); // non-financial: Aunt / Uncle
  }
  await aid(page, 'Transport assistance').nth(0).check(); // received
  await aid(page, 'Transport assistance').nth(1).check(); // recommended
  await aid(page, 'Nutritional assistance').nth(0).check();
  await aid(page, 'Food package').nth(1).check();
  await aid(page, 'School assistance').nth(0).check();
  await aid(page, 'Home-care kit').nth(0).check();
  await aid(page, 'Cash transfer').nth(1).check();
  await otherAidRow(page).locator('input[type=text]').fill('AutoOther aid');
  await otherAidRow(page).locator('input[type=checkbox]').nth(0).check();
  if (female) {
    await q(page, 'Support from family').getByLabel('Received').check();
    await pick(q(page, 'Spouse/Partner/Household supports antenatal care'), 'Yes');
  }
  await q(page, 'Comments:').locator('input').fill('AutoRemark');
  for (let i = 0; i < 10; i++) {
    await pick(mpi(page).nth(i), MPI_ANSWERS[i % 3]);
  }
};

// What fillAll saves (lower-cased obs displays; the "house", "transport" ... concept names come from the server's dictionary).
const COMMON_OBS = [
  'highest education level: university', 'able to read and write: no', 'number of people living in house: 6', 'total number of living children: 2',
  'number of rooms (in house): 3', 'radio (coded): yes', 'television: no', 'refrigerator: yes', 'banking account: no', 'months residing in country: 14',
  'toilet: no', 'pit latrine: yes', 'floor: ceramic tile', 'roofing material: thatch', 'wall material: bamboo', 'money available for transportation: yes',
  'method of transportation: donkey', 'transportation cost: 250', 'clinic travel time (coded): 1 to 2 hours', 'transportation comment: autotransport comment',
  'main daily activities before illness: automain activity', 'ability to perform main daily activity since illness: autolimited', 'current employment status: yes',
  'socio-economic assistance received: transport assistance', 'socio-economic assistance recommended: transport assistance',
  'socio-economic assistance received: nutritional assistance', 'socio-economic assistance recommended: food package',
  'socio-economic assistance received: school assistance', 'socio-economic assistance received: home-care kit',
  'socio-economic assistance recommended: cash transfer', 'socio-economic assistance received: other', 'other socioeconomic assistance (text): autoother aid',
  'socio-economic assistance comment: autoremark',
  // MPI: yes, no, unknown repeating, in the order of the form
  'undernourished in the household: yes', 'any child has died in the family in the five-year period preceding the survey: no',
  'no household member aged 10 years or older has completed six years of schooling: unknown', 'is not attending school up to the age at which he/she would complete class 8: yes',
  'the household cooks with dung, wood, charcoal or coal: no', 'sanitation facility is not improved (according to sdg guidelines) or it is improved but shared with other households: unknown',
  'does not have access to improved drinking water (according to sdg guidelines) or safe drinking water is at least a 30-minute walk from home, round trip: yes',
  'the household has no electricity: no', 'housing materials for at least one of roof, walls and floor are inadequate: unknown',
  'the household does not own more than one of these assets (radio, tv, telephone, computer, animal cart, bicycle, motorbike or refrigerator) and does not own a car or truck: yes',
];
const FEMALE_OBS = [
  'seen by traditional practitioner: yes', 'non-clinical antenatal care provider: traditional healer', 'non-clinical antenatal care provider: manbo',
  'non-clinical antenatal care provider: other', 'provider of financial support: partner or spouse', 'provider of non-financial support: aunt / uncle',
  'socio-economic assistance received: family support', 'partner supports prenatal care: yes',
];

// The assistance checkboxes have answerLabel="": their VIEW is "[X]" without text, so the generic check must not look for the answer's name.
const assistanceLabels = async (api: APIRequestContext, encounterUuid: string): Promise<Record<string, string>> => {
  const labels: Record<string, string> = {};
  for (const o of await getEncounterObs(api, encounterUuid)) {
    if (/^Socio-economic assistance (received|recommended)/.test(o.display)) {
      labels[o.display] = '';
    }
  }
  return labels;
};

const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};
const onlyEncounter = async (api: APIRequestContext, patientUuid: string) => {
  const encounters = await getPatientEncounters(api, patientUuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([SOCIO_ECONOMICS_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};

test.describe('socio-econ', () => {
  test('V1 ENTER shows the heading, the location (session location preselected), the sections and Save / Cancel; the hidden block and the healers stay hidden', async ({ api, site, page, createEntryContext }) => {
    // ifMode VIEW include=false :22, :35, :512 (present in ENTER); when :307 (hidden at load)
    await open(page, createEntryContext, 'F');
    await expect(page.locator('h2')).toContainText('Socioeconomics');
    await expect(page.locator('div#where')).toContainText('Location'); // div#where and p#where share the id (V1): select the div
    await expect(page.locator('#where select option:checked')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    for (const id of ['edu', 'house', 'transport', 'activity', 'prenatal', 'assistance', 'mpi']) {
      await expect(page.locator(`fieldset#${id}`), id).toBeVisible();
    }
    await expect(page.locator('#mpi table tr input[type=radio]').first()).toBeVisible();
    await expect(mpi(page)).toHaveCount(10);
    await expect(page.locator('#encounter-details')).toBeHidden();
    await expect(page.locator('#which-healer')).toBeHidden();
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#buttons button.cancel')).toBeVisible();
  });

  test('a man does not get the prenatal section nor the two women-only assistance questions', async ({ page, createEntryContext }) => {
    // includeIf :295, :415
    await open(page, createEntryContext, 'M');
    await expect(page.locator('fieldset#prenatal')).toHaveCount(0);
    await expect(page.locator('#which-healer')).toHaveCount(0);
    await expect(page.locator('label:text-is("Support from family")')).toHaveCount(0);
    await expect(page.locator('label:text-is("Spouse/Partner/Household supports antenatal care")')).toHaveCount(0);
    for (const id of ['edu', 'house', 'transport', 'activity', 'assistance', 'mpi']) {
      await expect(page.locator(`fieldset#${id}`), id).toBeVisible();
    }
  });

  test('the location is required: Save with none shows Required and saves nothing; with it and nothing else, an empty encounter is saved', async ({ site, page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext, 'F');
    await page.locator('#where select').selectOption('');
    await page.locator(SAVE).click();
    await expect(page.locator('#where span.field-error:visible')).toHaveText(/Required/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);

    await page.locator('#where select').selectOption({ label: await getLocationName(api, site.sessionLocationUuid) });
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    expect(await getEncounterObs(api, encounterUuid)).toEqual([]);
    const res = await api.get(`encounter/${encounterUuid}?v=custom:(location:(display),encounterProviders:(encounterRole:(uuid)))`);
    const encounter = await res.json();
    expect(encounter.location.display).toBe(await getLocationName(api, site.sessionLocationUuid));
    expect(encounter.encounterProviders.map((p: { encounterRole: { uuid: string } }) => p.encounterRole.uuid)).toEqual([ENCOUNTER_ROLE_UUID]); // :505
  });

  test('"alternative source" Yes shows the healer choices, No (or changing back) hides them', async ({ page, createEntryContext }) => {
    // when :307
    await open(page, createEntryContext, 'F');
    const care = q(page, 'Received care from an alternative source');
    await pick(care, 'Yes');
    await expect(page.locator('#which-healer')).toBeVisible();
    for (const label of ['Traditional healer', 'Houngan', 'Manbo', 'Church', 'Other']) {
      await expect(healer(page, label), label).toBeVisible();
    }
    await pick(care, 'No');
    await expect(page.locator('#which-healer')).toBeHidden();
    await pick(care, 'Yes');
    await expect(page.locator('#which-healer')).toBeVisible();
  });

  test('healers ticked and then hidden by choosing No are not saved', async ({ page, api, createEntryContext }) => {
    // when :307 + HFE hidden fields: stale hidden answers must not be saved
    const context = await open(page, createEntryContext, 'F');
    const care = q(page, 'Received care from an alternative source');
    await pick(care, 'Yes');
    await healer(page, 'Houngan').check();
    await healer(page, 'Church').check();
    await pick(care, 'No');
    await expect(page.locator('#which-healer')).toBeHidden();
    await save(page);
    const displays = await obsDisplays(api, await onlyEncounter(api, context.patient.uuid));
    expect(displays).toContain('seen by traditional practitioner: no');
    expect(displays.filter((d) => d.startsWith('non-clinical antenatal care provider'))).toEqual([]);
  });

  test('a non-integer number of months is refused with "Not an integer" and blocks Save; the fixed value saves', async ({ page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext, 'M');
    const months = q(page, 'Number of months residing in Haiti').locator('input');
    await months.fill('abc');
    await months.blur();
    await expect(page.locator('span.field-error:visible')).toHaveText('Not an integer');
    await page.locator(SAVE).click();
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    await months.fill('14');
    await save(page);
    expectObs(await obsDisplays(api, await onlyEncounter(api, context.patient.uuid)), 'months residing in country: 14');
  });

  test('a woman: every field is saved; the VIEW on the visit page shows them (and not the ENTER-only blocks); EDIT starts from the saved values and a re-save replaces them', async ({ site, page, api, createEntryContext }) => {
    test.slow(); // the VIEW and the EDIT round trip each load the visit page
    const context = await open(page, createEntryContext, 'F');
    await fillAll(page, true);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    let displays = await obsDisplays(api, encounterUuid);
    expectObs(displays, ...COMMON_OBS, ...FEMALE_OBS);
    expect(displays.length, 'one obs per answer').toBe(COMMON_OBS.length + FEMALE_OBS.length);

    // VIEW (visit page)
    let view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, await assistanceLabels(api, encounterUuid));
    // ifMode VIEW include=false :22, :35, :512: the location select, the heading and the buttons are absent
    await expect(view.root.locator('#where, h2, #buttons, input.submitButton')).toHaveCount(0);
    // when :307 in VIEW: the saved answers of the healer block are shown
    await expect(view.root.locator('#which-healer')).toContainText('[X] Traditional healer');
    await expect(view.root.locator('#which-healer')).toContainText('[X] Manbo');
    await expect(view.root.locator('#which-healer')).toContainText('[X] Other');
    await expect(view.root.locator('#which-healer')).not.toContainText('[X] Houngan');
    await expect(view.root.locator('#trad-heal')).toContainText('[X] Yes');
    // assistance: received / recommended, one "[X]" per ticked box; nothing for the untouched row
    const row = (label: string) => view.root.locator('#assistance tr', { has: view.page.locator(`label:text-is("${label}")`) });
    await expect(row('Transport assistance').locator('.value')).toHaveCount(2);
    await expect(row('Nutritional assistance').locator('.value')).toHaveCount(1);
    await expect(row('Food package').locator('.value')).toHaveCount(1);
    await expect(row('Housing assistance').locator('.value')).toHaveCount(0);
    // the MPI answers are labelled yes / no / unknown
    const mpiRows = view.root.locator('#mpi table tr', { has: view.page.locator('.value') });
    await expect(mpiRows).toHaveCount(10);
    await expect(mpiRows.nth(0).locator('.value')).toContainText('Yes');
    await expect(mpiRows.nth(1).locator('.value')).toContainText('No');
    await expect(mpiRows.nth(2).locator('.value')).toContainText('unknown');
    // the encounter date (:498) is shown as a value
    await expect(view.values.filter({ hasText: pickerDate(isoDate(0)) })).toHaveCount(1);

    // EDIT: the form starts from the saved values (when :307 follows the saved "Yes")
    await page.goto(editUrl(context, encounterUuid));
    await expect(page.locator('#where select option:checked')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    await expect(q(page, 'Level of education').getByLabel('University', { exact: true })).toBeChecked();
    await expect(q(page, 'Number of rooms').locator('input')).toHaveValue('3');
    await expect(q(page, 'Comments:').locator('input')).toHaveValue('AutoRemark');
    await expect(page.locator('#which-healer')).toBeVisible();
    await expect(healer(page, 'Traditional healer')).toBeChecked();
    await expect(healer(page, 'Houngan')).not.toBeChecked();
    await expect(aid(page, 'Transport assistance').nth(0)).toBeChecked();
    await expect(aid(page, 'Transport assistance').nth(1)).toBeChecked();
    await expect(aid(page, 'Housing assistance').nth(0)).not.toBeChecked();
    await expect(mpi(page).nth(0).getByLabel('Yes', { exact: true })).toBeChecked();
    await expect(mpi(page).nth(2).getByLabel('unknown', { exact: true })).toBeChecked();

    // change a radio, a number, clear the remark, untick one box, then re-save
    await pick(q(page, 'Level of education'), 'Primary school');
    await q(page, 'Number of rooms').locator('input').fill('4');
    await q(page, 'Comments:').locator('input').fill('');
    await aid(page, 'Transport assistance').nth(1).uncheck();
    await save(page);
    displays = await obsDisplays(api, encounterUuid);
    expectObs(displays, 'highest education level: primary school', 'number of rooms (in house): 4', 'socio-economic assistance received: transport assistance');
    for (const gone of ['highest education level: university', 'number of rooms (in house): 3', 'socio-economic assistance comment', 'socio-economic assistance recommended: transport assistance']) {
      expect(displays.some((d) => d.includes(gone)), `"${gone}" is replaced`).toBeFalsy();
    }
    expectObs(displays, 'wall material: bamboo', 'socio-economic assistance recommended: cash transfer'); // untouched answers stay
    expect(displays.length).toBe(COMMON_OBS.length + FEMALE_OBS.length - 2);
    view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, await assistanceLabels(api, encounterUuid));
    await expect(view.values.filter({ hasText: 'Primary school' })).toHaveCount(1);
  });

  test('a man: his answers are saved and shown in the VIEW, which has no prenatal section', async ({ site, page, api, createEntryContext }) => {
    const context = await open(page, createEntryContext, 'M');
    await fillAll(page, false);
    await save(page);
    const encounterUuid = await onlyEncounter(api, context.patient.uuid);
    const displays = await obsDisplays(api, encounterUuid);
    expectObs(displays, ...COMMON_OBS);
    expect(displays.length).toBe(COMMON_OBS.length);
    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid, await assistanceLabels(api, encounterUuid));
    await expect(view.root.locator('#prenatal, #which-healer, #trad-heal')).toHaveCount(0);
    await expect(view.root.locator('#assistance').getByText('Support from family')).toHaveCount(0);
  });
});
