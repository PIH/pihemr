import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs } from '../rest';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-postpartum-counsel.xml (pihemr, v1.0): "Postpartum training": the counselling given to the mother (Counseling offered to mother CIEL:164481), six checkboxes from a
// <repeat>, for the community-health Pediatric, Maternal Post-partum and Maternal Follow-up home assessments. On the visit page it is the `section-postpartum-training`
// section of those three types (not Prenatal). No form of this repo creates those encounters (how the community health app does is unverified), so the specs create the
// parent over REST (female patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-postpartum-counsel.inv.md):
//   ifMode   VIEW include=true :5    a <style> that widens the fieldsets (no obs, no script)
//   includeIf $encounter.encounterType.uuid != 0CF4717A (Post-partum and Follow-up) :27  checkboxes: danger signs = CIEL:161050 (counselling on the danger signs of pregnancy),
//                                                                                        breastfeeding 1910, good nutrition 1380, hygiene 1906, family planning 1382, other 5622
//   includeIf $encounter.encounterType.uuid == 0CF4717A (Pediatric)                 :48  the same six, but danger signs = CIEL:159860 ("Danger signs, baby")
//   (the two branches print the same labels; they differ only in the concept of the first box)
//   (no when / scripts)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): no Save button, and the section's entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `section-postpartum-training` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci for the three parents): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-postpartum-counsel
//   V1 Info    no Save button and no `editUrl` for the section: the counselling cannot be entered or corrected from the EMR (only by the app that creates the encounter)
// Not covered here: entering the counselling through the form (no Save button, V1), the home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-postpartum-counsel.xml';

const patient = { givenName: 'AutoPostpartum', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

// the six checkboxes in form order, as labelled by the form's messages
const LABELS = ['Danger signs', 'Breastfeeding', 'Good nutrition', 'Sanitation/Hygiene', 'Family planning', 'Other'];

const BRANCHES = [
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, dangerSigns: 'CIEL:161050', dangerSignsName: 'Counseling, danger signs of pregnancy', otherBranchDangerSigns: 'CIEL:159860' },
  { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, dangerSigns: 'CIEL:161050', dangerSignsName: 'Counseling, danger signs of pregnancy', otherBranchDangerSigns: 'CIEL:159860' },
  { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, dangerSigns: 'CIEL:159860', dangerSignsName: 'Danger signs, baby', otherBranchDangerSigns: 'CIEL:161050' },
];

type Section = Parameters<typeof addObs>[1];

// Danger signs (the branch's concept) and good nutrition (CIEL:1380, "Nutrition counseling").
const record = async (api: APIRequestContext, section: Section, branch: (typeof BRANCHES)[number]) => {
  await addObs(api, section, 'CIEL:164481', { coded: branch.dangerSigns });
  await addObs(api, section, 'CIEL:164481', { coded: 'CIEL:1380' });
};

const conceptId = async (api: APIRequestContext, reference: string): Promise<string> => {
  const res = await api.get(`concept/${encodeURIComponent(reference)}?v=custom:(id)`);
  expect(res.ok(), `get concept ${reference}: ${res.status()}`).toBeTruthy();
  return String((await res.json()).id);
};

test.describe('section-postpartum-counsel on the visit page', () => {
  for (const branch of BRANCHES) {
    // includeIf :27 (Post-partum, Follow-up) / :48 (Pediatric)
    test(`${branch.name}: VIEW ticks the recorded counselling under the form's labels and leaves the other four unticked`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: branch.uuid, patient });
      await record(api, section, branch);
      // the form labels the answers with its own messages, not the concept names
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
        [`Counseling offered to mother: ${branch.dangerSignsName}`]: 'Danger signs',
        'Counseling offered to mother: Nutrition counseling': 'Good nutrition',
      });
      expect((await view.valueTexts()).sort()).toEqual(['[X] Danger signs', '[X] Good nutrition']);
      const lines = (await view.root.locator('.value, .emptyValue').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      expect(lines).toEqual(LABELS.map((l) => (l === 'Danger signs' || l === 'Good nutrition' ? `[X] ${l}` : `[ ] ${l}`)));
      // V1: no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
      await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
    });
  }

  // the first box is tied to the branch's concept: the other branch's concept is not shown as ticked
  for (const branch of [BRANCHES[0], BRANCHES[2]]) {
    test(`${branch.name}: the danger-signs counselling of the other branch is not shown`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: branch.uuid, patient });
      await addObs(api, section, 'CIEL:164481', { coded: branch.otherBranchDangerSigns });
      const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
      await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
      await expect(view.root.locator('.emptyValue').first()).toContainText('Danger signs');
    });
  }

  test('Prenatal Home Assessment lists no postpartum-training section', async ({ page, createSectionEncounter }) => {
    // encounterTypeConfig.js: the sections of 91DDF969 are referral, vital signs, danger signs, education subjects, comments and return visit date
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await expect(ViewFormPage.open(page, FORM, section.encounter.uuid)).rejects.toThrow(/shows no VIEW of section-postpartum-counsel\.xml/);
  });

  test('without recorded counselling the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
    await expect(view.root.locator('.emptyValue')).toHaveCount(6);
  });
});

test.describe('section-postpartum-counsel edit URL (direct; the visit page has no pencil for it)', () => {
  for (const branch of [BRANCHES[0], BRANCHES[2]]) {
    test(`${branch.name}: the entry page ticks the recorded boxes, the first box is the branch's danger-signs concept, and there is no Save and no Cancel button (V1)`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: branch.uuid, patient });
      await record(api, section, branch);
      await page.goto(SectionFormPage.editUrl(FORM, section));
      await page.waitForLoadState('networkidle');
      const form = page.locator('form#htmlform');
      const boxes = form.locator('input[type=checkbox]');
      await expect(boxes).toHaveCount(6);
      // includeIf :27 / :48: the value of the first checkbox is the concept of that branch
      await expect(boxes.nth(0)).toHaveValue(await conceptId(api, branch.dangerSigns));
      await expect(boxes.nth(0)).not.toHaveValue(await conceptId(api, branch.otherBranchDangerSigns));
      expect((await form.locator('label').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(LABELS);
      await expect(boxes.nth(0)).toBeChecked();
      await expect(boxes.nth(1)).not.toBeChecked();
      await expect(boxes.nth(2)).toBeChecked();
      // neither a Save nor a Cancel button: the only form controls are the form's own fields
      await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
    });
  }
});
