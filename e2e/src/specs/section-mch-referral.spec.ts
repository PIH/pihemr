import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs, getEncounterObs } from '../rest';
import { VISIT_PAGE_URL, ViewFormPage, buttonsSubmit, expectViewShowsSavedObs, openEditWithButtonsSubmit } from '../pages';
import { isoDate, pickerDate } from '../pages/form-widgets';

// section-mch-referral.xml (pihemr, v1.0): "Referrals": what a community health worker referred the patient for (hospital, mental health, family member, tetanus vaccination,
// pediatric vaccination, malnutrition programme), with the status and a remark of each referral, for the community-health home assessments (all four types). The referrals
// come from the CommCare app as obs of the encounter (Patient referred to hospital CIEL:1788, Reason for mental health referral PIH:12746, ...); the form shows one table row
// per referral present and saves a "Referral construct" obs group (PIH:12837: Type of referral ordered, Fulfillment status, Free text comment) per row. On the visit page it is
// the `section-mch-referral` section of the four types, WITH an edit pencil (the only one of the home-assessment sections that has one). No form of this repo creates those
// encounters, so the specs create the parent over REST (female patient) and add the CommCare obs over REST (`addObs`, with the encounter's location: see "Fixture" below).
// Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`). Save is `#buttons button.submitButton` (no `#submit`).
//
// Conditions in the form, from documentation inventory (section-mch-referral.inv.md):
//   ifMode   VIEW include=true  :6    a <style> that lays the fieldsets out line by line
//   ifMode   VIEW include=false :273  the Save and Cancel buttons (absent in VIEW: asserted)
//   includeIf CIEL:1788 = PIH:YES  :106  Hospital row (obs group); inside it, includeIf PIH:Emergency = YES :116 prints "Urgent" in the Details cell
//   includeIf CIEL:1788 = PIH:NO   :131  "Hospital / None" row, no inputs
//   includeIf any PIH:12746        :142  Mental Health row; Details = the names of every PIH:12746 answer (a <lookup> loop)
//   includeIf PIH:12745 = YES :168 Family Member row;  PIH:12747 = YES :193 Tetanus vaccination row;  PIH:12836 = YES :218 Pediatrics vaccination row
//   includeIf any PIH:12731        :243  Malnutrition row; Details = the date (dd/MMM/yyyy)
//   (no includeIf on the encounter type: all four parents show the same rows)
// Scripts :61: on load, sets the hidden "Type of referral ordered" dropdown of each row present to its only option (the form always opens in EDIT mode on a CommCare encounter,
//   where `defaultValue` has no effect). Effect: every Save writes one group per row present, even for a row left blank (see V2). In VIEW the script is part of the inserted HTML but
//   raises no error (checked: no uncaught error on the visit page).
// Side effects on save: none besides the obs groups.
// Visit-page display: `section-mch-referral` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci for the four parents): expectViewShowsSavedObs.
// Fixture: an obs created over REST without a location makes this form's Save fail ("Editing the fields [location] on Obs is not allowed", the form sets the encounter's location on
//   the obs it re-saves), so `addObs` gives the obs the encounter's location, as a form-saved obs has it. Whether the CommCare import does is unverified (V1).
// Findings: see pihemr _findings.e2e.md#section-mch-referral
//   V1 Low (unconfirmed)  an encounter whose CommCare obs have no location cannot be saved by this form (the Save answers "Editing the fields [location] on Obs is not allowed") (TESTED below with test.fixme)
//   V2 Info  :61-72 every Save creates a "Referral construct" group for every row present, also for rows with no status and no remark (TESTED below)
// Not covered here: the CommCare import that creates the parent encounter and its obs (unverified); the obs groups' own ids; entering a row that has no trigger obs (the form
//   has no way to add a referral).

const FORM = 'section-mch-referral.xml';
const REMARK_DATE = isoDate(10);

const patient = { givenName: 'AutoReferral', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

type Section = Parameters<typeof addObs>[1];

// The six rows, in table order: the id of the hidden "type" span (also the row's anchor), the row's label cell, the concept saved as the type.
const ROWS = [
  { id: 'hospital_referral', label: 'Hospital', type: 'Hospital', status: 'Referral completed', statusObs: 'Completed' },
  { id: 'mental_health_referral', label: 'Mental Health', type: 'Mental health', status: 'Referral pending', statusObs: 'Pending status' },
  { id: 'family_member_referral', label: 'Family Member', type: 'Family member', status: 'Referral unmet', statusObs: 'Referral unmet' },
  { id: 'tetanus_vaccination_referral', label: 'Tetanus vaccination', type: 'Referral for tetanus vaccination', status: 'No show, failed to attend', statusObs: 'No show, failed to attend' },
  { id: 'pediatric_vaccination_referral', label: 'Pediatrics vaccination', type: 'Referral for pediatric vaccination', status: 'Cancelled', statusObs: 'Cancelled' },
  { id: 'malnutrition_referral', label: 'Malnutrition', type: 'Malnutrition program', status: 'Other', statusObs: 'Other' },
];
// obs display of a status answer -> text of the dropdown option / VIEW
const STATUS_LABEL: Record<string, string> = Object.fromEntries(ROWS.map((r) => [r.statusObs, r.status]));

// What the CommCare app records for a patient referred everywhere.
const addAllReferrals = async (api: APIRequestContext, section: Section) => {
  await addObs(api, section, 'CIEL:164141', 'chw1');
  await addObs(api, section, 'CIEL:1788', { coded: 'PIH:YES' });
  await addObs(api, section, 'PIH:Emergency', { coded: 'PIH:YES' });
  await addObs(api, section, 'PIH:12746', { coded: 'CIEL:119537' });
  await addObs(api, section, 'PIH:12746', { coded: 'CIEL:5622' });
  await addObs(api, section, 'PIH:12745', { coded: 'PIH:YES' });
  await addObs(api, section, 'PIH:12747', { coded: 'PIH:YES' });
  await addObs(api, section, 'PIH:12836', { coded: 'PIH:YES' });
  await addObs(api, section, 'PIH:12731', { date: REMARK_DATE });
};

// "16/Nov/2026": how the Malnutrition row prints the date
const referralDate = (iso: string) => pickerDate(iso).replace(/ /g, '/');

// The row of one referral in the edit form or the VIEW.
const row = (root: Page | ReturnType<ViewFormPage['root']['locator']>, id: string) => root.locator(`tr:has(#${id})`);
const statusSelect = (root: Parameters<typeof row>[0], id: string) => row(root, id).locator('td:nth-child(3) select');
const remarkInput = (root: Parameters<typeof row>[0], id: string) => row(root, id).locator('td:nth-child(4) input');

const save = async (page: Page) => {
  await buttonsSubmit(page).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};

interface Group {
  type: string;
  status: string;
  comment: string;
}

// The non-voided "Referral construct" obs groups of the encounter, as the rows they came from.
const referralGroups = async (api: APIRequestContext, encounterUuid: string): Promise<Group[]> => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(concept:(display),groupMembers:(concept:(display),value))&limit=100`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  const text = (v: unknown): string => (v && typeof v === 'object' && 'display' in v ? String((v as { display: string }).display) : String(v ?? ''));
  type ObsGroup = { concept: { display: string }; groupMembers: Array<{ concept: { display: string }; value: unknown }> | null };
  return ((await res.json()).results as ObsGroup[])
    .filter((g) => g.concept.display === 'Referral construct' && g.groupMembers)
    .map((g) => {
      const member = (name: string) => g.groupMembers!.filter((m) => m.concept.display === name).map((m) => text(m.value)).join('');
      return { type: member('Type of referral ordered'), status: member('Fulfillment status'), comment: member('Free text comment') };
    })
    .sort((a, b) => a.type.localeCompare(b.type));
};

const sortedByType = (groups: Group[]) => [...groups].sort((a, b) => a.type.localeCompare(b.type));

// obs display -> text the VIEW shows, for the generic check of expectViewShowsSavedObs: the CommCare trigger answers, the hidden type and the mental health reasons are not
// span.value (the reasons are printed by a <lookup> in a plain cell), a status shows under the dropdown's label.
const viewLabels = async (api: APIRequestContext, encounterUuid: string): Promise<Record<string, string>> => {
  const labels: Record<string, string> = {};
  for (const o of await getEncounterObs(api, encounterUuid)) {
    if (o.value && typeof o.value === 'object' && 'display' in o.value) {
      const answer = String((o.value as { display: string }).display);
      labels[o.display] = o.concept.display === 'Fulfillment status' ? STATUS_LABEL[answer] : '';
    }
  }
  return labels;
};

test.describe('section-mch-referral edit form', () => {
  // includeIf :106, :116, :142, :168, :193, :218, :243
  test('Prenatal: one row per referral the encounter lists, with Urgent, the mental health reasons and the malnutrition date', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addAllReferrals(api, section);
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('input[type=text]').first()).toHaveValue('chw1');
    await expect(form.locator('table tr:has(td)')).toHaveCount(6);
    for (const r of ROWS) {
      await expect(row(form, r.id).locator('td').first()).toContainText(r.label);
      // the script of :61 selected the only option of the hidden "type" dropdown
      await expect(form.locator(`#${r.id} select`)).not.toHaveValue('');
      await expect(statusSelect(form, r.id).locator('option')).toHaveText(['', 'Referral unmet', 'Referral completed', 'Referral pending', 'No show, failed to attend', 'Cancelled', 'Other']);
    }
    // :116
    await expect(row(form, 'hospital_referral').locator('td:nth-child(2)')).toHaveText('Urgent');
    // :142 lookup: every answer of PIH:12746, one per line
    await expect(row(form, 'mental_health_referral').locator('td:nth-child(2)')).toContainText('Depression');
    await expect(row(form, 'mental_health_referral').locator('td:nth-child(2)')).toContainText('Other');
    // :243 lookup
    await expect(row(form, 'malnutrition_referral').locator('td:nth-child(2)')).toHaveText(referralDate(REMARK_DATE));
    // the other three have no details
    for (const id of ['family_member_referral', 'tetanus_vaccination_referral', 'pediatric_vaccination_referral']) {
      await expect(row(form, id).locator('td:nth-child(2)')).toHaveText('');
    }
    await expect(form.locator('#buttons')).toBeVisible();
  });

  // includeIf :131 and the "no" side of :168 / :193
  test('"no" answers: Hospital / None row without inputs, no row for a family member or tetanus referral, and Save writes no group', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addObs(api, section, 'CIEL:1788', { coded: 'PIH:NO' });
    await addObs(api, section, 'PIH:12745', { coded: 'PIH:NO' });
    await addObs(api, section, 'PIH:12747', { coded: 'PIH:NO' });
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('table tr:has(td)')).toHaveCount(1);
    await expect(form.locator('table tr:has(td) td').first()).toContainText('Hospital');
    await expect(form.locator('table tr:has(td) td').nth(1)).toContainText(/none/i);
    await expect(form.locator('#hospital_referral, table select, table input')).toHaveCount(0);
    await save(page);
    expect(await referralGroups(api, section.encounter.uuid)).toEqual([]);
    // the CommCare answers are still there
    const kept = (await getEncounterObs(api, section.encounter.uuid)).map((o) => o.display);
    expect(kept).toContain('Patient referred to hospital: No');
  });

  test('Mental Health row alone: any answer of PIH:12746 shows it, and an encounter with no referral shows no row', async ({ page, api, createSectionEncounter }) => {
    const only = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addObs(api, only, 'PIH:12746', { coded: 'CIEL:119537' });
    await openEditWithButtonsSubmit(page, FORM, only);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('form#htmlform table tr:has(td)')).toHaveCount(1);
    await expect(row(page, 'mental_health_referral').locator('td:nth-child(2)')).toContainText('Depression');

    const none = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await openEditWithButtonsSubmit(page, FORM, none);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('form#htmlform table tr:has(td)')).toHaveCount(0);
    await expect(page.locator('form#htmlform table tr th')).toHaveCount(4);
  });
});

test.describe('section-mch-referral save', () => {
  test('Prenatal: Save writes one group per row with its status and remark; VIEW shows them on the visit page', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addAllReferrals(api, section);
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    for (const r of ROWS) {
      await statusSelect(page, r.id).selectOption({ label: r.status });
      await remarkInput(page, r.id).fill(`remark ${r.id}`);
    }
    await save(page);
    expect(await referralGroups(api, section.encounter.uuid)).toEqual(
      sortedByType(ROWS.map((r) => ({ type: r.type, status: r.statusObs, comment: `remark ${r.id}` }))),
    );

    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, await viewLabels(api, section.encounter.uuid));
    await expect(view.root.locator('p.radio .value')).toHaveText('chw1');
    for (const r of ROWS) {
      await expect(row(view.root, r.id).locator('td:nth-child(3) .value')).toHaveText(r.status);
      await expect(row(view.root, r.id).locator('td:nth-child(4) .value')).toHaveText(`remark ${r.id}`);
    }
    await expect(row(view.root, 'hospital_referral').locator('td:nth-child(2)')).toHaveText('Urgent');
    await expect(row(view.root, 'mental_health_referral').locator('td:nth-child(2)')).toContainText('Depression');
    await expect(row(view.root, 'malnutrition_referral').locator('td:nth-child(2)')).toHaveText(referralDate(REMARK_DATE));
    // ifMode :273: no Save / Cancel in VIEW; the section has its edit pencil on the visit page
    await expect(view.root.locator('#buttons')).toHaveCount(0);
    await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(1);
  });

  // V1 (unconfirmed for real CommCare data): obs without a location, as a plain REST client creates them. Remove test.fixme() when the form saves such an encounter.
  test.fixme('V1: an encounter whose CommCare obs have no location can be saved', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const concept = await api.get('concept/CIEL:1788?v=custom:(uuid)');
    const answer = await api.get('concept/PIH:YES?v=custom:(uuid)');
    const res = await api.post('obs', {
      data: {
        person: section.patient.uuid,
        concept: (await concept.json()).uuid,
        encounter: section.encounter.uuid,
        obsDatetime: new Date(Date.now() - 60_000).toISOString(),
        value: (await answer.json()).uuid,
      },
    });
    expect(res.ok(), `create the hospital referral obs: ${res.status()}`).toBeTruthy();
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    await statusSelect(page, 'hospital_referral').selectOption({ label: 'Referral completed' });
    await save(page);
  });

  // V2, :61 script. The groups are written for the rows' type only.
  test('V2: Save without touching a row writes a group with the type only for every row present', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addAllReferrals(api, section);
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    await save(page);
    expect(await referralGroups(api, section.encounter.uuid)).toEqual(sortedByType(ROWS.map((r) => ({ type: r.type, status: '', comment: '' }))));
    // the VIEW shows those rows with no status
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, await viewLabels(api, section.encounter.uuid));
    await expect(view.root.locator('td:nth-child(3) .value')).toHaveCount(0);
  });

  // The risk of six groups of one grouping concept: each row's status and remark come back in its own row and a second Save does not duplicate the groups.
  test('re-opening and saving again keeps each status and remark in its own row, with six groups and no duplicate', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addAllReferrals(api, section);
    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    await statusSelect(page, 'hospital_referral').selectOption({ label: 'Referral completed' });
    await remarkInput(page, 'mental_health_referral').fill('seen at the clinic');
    await save(page);

    await openEditWithButtonsSubmit(page, FORM, section);
    await page.waitForLoadState('networkidle');
    for (const r of ROWS) {
      await expect(statusSelect(page, r.id).locator('option:checked')).toHaveText(r.id === 'hospital_referral' ? 'Referral completed' : '');
      await expect(remarkInput(page, r.id)).toHaveValue(r.id === 'mental_health_referral' ? 'seen at the clinic' : '');
    }
    // change one and add one, then save again
    await statusSelect(page, 'hospital_referral').selectOption({ label: 'Referral pending' });
    await remarkInput(page, 'malnutrition_referral').fill('next visit');
    await save(page);

    const groups = await referralGroups(api, section.encounter.uuid);
    expect(groups).toEqual(
      sortedByType(
        ROWS.map((r) => ({
          type: r.type,
          status: r.id === 'hospital_referral' ? 'Pending status' : '',
          comment: r.id === 'mental_health_referral' ? 'seen at the clinic' : r.id === 'malnutrition_referral' ? 'next visit' : '',
        })),
      ),
    );
  });
});

test.describe('section-mch-referral on every home-assessment parent', () => {
  for (const parent of [
    { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
    { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
    { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  ]) {
    // no includeIf on the encounter type: the same hospital row, saved and shown
    test(`${parent.name}: the hospital referral is saved from the form and shown by VIEW`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await addObs(api, section, 'CIEL:1788', { coded: 'PIH:YES' });
      await openEditWithButtonsSubmit(page, FORM, section);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('form#htmlform table tr:has(td)')).toHaveCount(1);
      await statusSelect(page, 'hospital_referral').selectOption({ label: 'Referral pending' });
      await remarkInput(page, 'hospital_referral').fill('by ambulance');
      await save(page);
      expect(await referralGroups(api, section.encounter.uuid)).toEqual([{ type: 'Hospital', status: 'Pending status', comment: 'by ambulance' }]);
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, await viewLabels(api, section.encounter.uuid));
      await expect(row(view.root, 'hospital_referral').locator('td:nth-child(3) .value')).toHaveText('Referral pending');
      await expect(row(view.root, 'hospital_referral').locator('td:nth-child(4) .value')).toHaveText('by ambulance');
      // no Urgent without PIH:Emergency (:116)
      await expect(row(view.root, 'hospital_referral').locator('td:nth-child(2)')).toHaveText('');
    });
  }
});
