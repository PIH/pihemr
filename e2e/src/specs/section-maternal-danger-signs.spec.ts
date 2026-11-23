import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs, getEncounterObs } from '../rest';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-maternal-danger-signs.xml (pihemr, v1.0): "Maternal Danger Signs": one Yes/No pair of checkboxes per danger sign (Symptom present / Symptom absent, answer = the
// sign), with a different list of signs per parent encounter type, for the community-health home assessments. On the visit page it is the `section-maternal-danger-signs`
// section of the Prenatal, Pediatric and Maternal Post-partum types (not Maternal Follow-up). No form of this repo creates those encounters (how the community health app
// does is unverified), so the specs create the parent over REST (female patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-maternal-danger-signs.inv.md):
//   ifMode   VIEW include=true :17   a <style> that hides the legend, the section title and the encounter date / provider / location (no obs, no script)
//   includeIf $encounter.encounterType.uuid == 91DDF969 (Prenatal)         :84   nine signs: passage of fluids, decreased fetal movements, severe headache, vision problem, edema,
//                                                                                abdominal pain, vaginal infection, abnormal vaginal bleeding, fever
//   includeIf $encounter.encounterType.uuid == 0E7160DF (Post-partum)      :113  seven signs: postpartum hemorrhage, severe headache, vision problem, edema (face, hands),
//                                                                                abdominal pain, vaginal infection, fever
//   includeIf $encounter.encounterType.uuid == 0CF4717A (Pediatric)        :140  five signs: fever, diarrhea, jaundice, cough, seizures
//   (the Maternal Follow-up type, 690670E2, matches none: the form renders its heading only; the visit page does not list the section for it)
//   (no when / scripts)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): no Save button, and the section's entry in encounterTypeConfig.js has `editUrl: ""` (no pencil on the visit page).
// Visit-page display: `section-maternal-danger-signs` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci for the three parents): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-maternal-danger-signs
//   V1 Info    no Save button and an empty `editUrl` for the section: the signs cannot be entered or corrected from the EMR (only by the app that creates the encounter)
// Not covered here: entering the signs through the form (no Save button, V1; nothing stops a user from ticking Yes and No of one sign at once, but nobody can save it), the
//   home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-maternal-danger-signs.xml';

// concept (CIEL code) and label of each sign, in the order of the form's <repeat>, per parent
const PRENATAL = [
  ['CIEL:148968', 'Passage of fluids'],
  ['CIEL:113377', 'Decrease fetal movements'],
  ['CIEL:139081', 'Severe headache'],
  ['CIEL:118938', 'Vision problem'],
  ['CIEL:460', 'Edema'],
  ['CIEL:151', 'Abdominal pain'],
  ['CIEL:117010', 'Vaginal infection'],
  ['CIEL:150802', 'Abnormal vaginal bleeding'],
  ['CIEL:140238', 'Fever'],
];
const POSTPARTUM = [
  ['CIEL:230', 'Postpartum hemorrhage'],
  ['CIEL:139081', 'Severe headache'],
  ['CIEL:118938', 'Vision problem'],
  ['CIEL:165193', 'Edema (face, hands)'],
  ['CIEL:151', 'Abdominal pain'],
  ['CIEL:117010', 'Vaginal infection'],
  ['CIEL:140238', 'Fever'],
];
const PEDIATRIC = [
  ['CIEL:140238', 'Fever'],
  ['CIEL:142412', 'Diarrhea'],
  ['CIEL:136443', 'Jaundice'],
  ['CIEL:143264', 'Cough'],
  ['CIEL:113054', 'Seizures'],
];

const BRANCHES = [
  { name: 'Prenatal Home Assessment', uuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, signs: PRENATAL, absentOnly: 'Edema' },
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, signs: POSTPARTUM, absentOnly: 'Vision problem' },
  { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, signs: PEDIATRIC, absentOnly: 'Diarrhea' },
];

const patient = { givenName: 'AutoDangerSigns', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

// The first sign of the branch is recorded as present, `absentOnly` as absent, the rest are left unanswered.
const record = async (api: Parameters<typeof addObs>[0], section: Parameters<typeof addObs>[1], branch: (typeof BRANCHES)[number]) => {
  await addObs(api, section, 'PIH:SYMPTOM PRESENT', { coded: branch.signs[0][0] });
  const absent = branch.signs.find(([, label]) => label === branch.absentOnly)!;
  await addObs(api, section, 'PIH:SYMPTOM ABSENT', { coded: absent[0] });
};

test.describe('section-maternal-danger-signs on the visit page', () => {
  for (const branch of BRANCHES) {
    // includeIf :84 / :113 / :140
    test(`${branch.name}: VIEW lists that type's ${branch.signs.length} signs with Yes / No ticked as recorded`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: branch.uuid, patient });
      await record(api, section, branch);
      // every value is a "[X] Yes" / "[X] No": the generic check cannot tell them apart, the rows below do
      const blank = Object.fromEntries((await getEncounterObs(api, section.encounter.uuid)).map((o) => [o.display, '']));
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, blank);
      expect((await view.root.locator('fieldset strong').allInnerTexts()).map(norm)).toEqual(branch.signs.map(([, label]) => label));
      const row = (label: string) => view.root.locator('fieldset', { has: page.locator(`strong:text-is("${label}")`) });
      await expect(row(branch.signs[0][1])).toContainText(/\[X\]\s+Yes\s+\[\s*\]\s+No/);
      await expect(row(branch.absentOnly)).toContainText(/\[\s*\]\s+Yes\s+\[X\]\s+No/);
      // an unanswered sign shows neither
      const other = branch.signs.find(([, label]) => label !== branch.signs[0][1] && label !== branch.absentOnly)!;
      await expect(row(other[1])).toContainText(/\[\s*\]\s+Yes\s+\[\s*\]\s+No/);
      await expect(row(other[1]).locator('.value')).toHaveCount(0);
      expect(await view.values.count()).toBe(2);
    });
  }

  test('Maternal Follow-up Home Assessment lists no danger-signs section', async ({ page, createSectionEncounter }) => {
    // encounterTypeConfig.js: the sections of 690670E2 are referral, vital signs, post-partum training, family planning and comments
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await expect(ViewFormPage.open(page, FORM, section.encounter.uuid)).rejects.toThrow(/shows no VIEW of section-maternal-danger-signs\.xml/);
  });

  test('without recorded signs the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
    // V1: no edit pencil on the visit page (`editUrl: ""` in encounterTypeConfig.js)
    await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
  });
});

test.describe('section-maternal-danger-signs edit URL (direct; the visit page has no pencil for it)', () => {
  for (const branch of BRANCHES) {
    test(`${branch.name}: the entry page shows that type's signs with the recorded Yes / No ticked and has no Save and no Cancel button (V1)`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: branch.uuid, patient });
      await record(api, section, branch);
      await page.goto(SectionFormPage.editUrl(FORM, section));
      await page.waitForLoadState('networkidle');
      const form = page.locator('form#htmlform');
      await expect(form.locator('input[type=checkbox]')).toHaveCount(branch.signs.length * 2);
      expect((await form.locator('fieldset strong').allInnerTexts()).map(norm)).toEqual(branch.signs.map(([, label]) => label));
      const boxes = (label: string) => form.locator('fieldset', { has: page.locator(`strong:text-is("${label}")`) }).locator('input[type=checkbox]');
      await expect(boxes(branch.signs[0][1]).nth(0)).toBeChecked();
      await expect(boxes(branch.signs[0][1]).nth(1)).not.toBeChecked();
      await expect(boxes(branch.absentOnly).nth(0)).not.toBeChecked();
      await expect(boxes(branch.absentOnly).nth(1)).toBeChecked();
      // neither a Save nor a Cancel button: the only form controls are the form's own fields
      await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
    });
  }

  test('Maternal Follow-up Home Assessment matches no includeIf: the entry page shows the heading and no checkbox', async ({ page, createSectionEncounter }) => {
    // includeIf :84, :113 and :140 all fail for 690670E2
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('form#htmlform')).toContainText('Danger signs');
    await expect(page.locator('form#htmlform input[type=checkbox]')).toHaveCount(0);
  });
});
