import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-comments.xml (pihemr, v1.0): "Comments": one free-text remark (PIH:1364, "Clinical impression comments") for the community-health home-assessment encounters.
// On the visit page it is the `section-comments` section of the four home-assessment encounter types (Prenatal, Pediatric, Maternal Post-partum, Maternal Follow-up);
// no form of this repo creates those encounters (how the community health app does is unverified), so the specs create the parent over REST (female patient) and add
// the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`; the visit page renders the sections on any profile with `visitNote`).
//
// Conditions in the form, from documentation inventory (section-comments.inv.md):
//   ifMode VIEW include=true :4   a <style> that hides the legend, the section title, the encounter date / provider / location and lays the remark out on one line (asserted)
//   (no when / includeIf / scripts)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): it has no Save button and its entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `section-comments` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci for the four parents): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-comments
//   V1 Info    no Save button in the form and no `editUrl` for the section: the remark cannot be entered or corrected from the EMR (only by the app that creates the encounter)
//   V2 Low     :65,:68 headerCode / uimessage `pihcore.comments.title` has no message on zl-ci: the entry page prints the raw code as the section title and legend
//              ("pihcore.comments.title"); the VIEW hides both by style (asserted)
// Not covered here: entering the remark through the form (no Save button, V1), the home-assessment app that creates the parent encounters (unverified), the other sections
//   of those encounters.

const FORM = 'section-comments.xml';
const REMARK = 'Home visit remark';

const PARENTS = [
  { name: 'Prenatal Home Assessment', uuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
];

const patient = { givenName: 'AutoComments', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

// Records the remark on the encounter the way the community-health app would (the form has no way to save it).
const addRemark = async (api: APIRequestContext, section: SectionEncounter, text: string) => {
  const concept = await api.get('concept/PIH:1364?v=custom:(uuid)');
  expect(concept.ok(), `get concept PIH:1364: ${concept.status()}`).toBeTruthy();
  const res = await api.post('obs', {
    data: {
      person: section.patient.uuid,
      concept: (await concept.json()).uuid,
      encounter: section.encounter.uuid,
      obsDatetime: new Date(Date.now() - 60_000).toISOString(),
      value: text,
    },
  });
  expect(res.ok(), `create the remark obs: ${res.status()}`).toBeTruthy();
};

test.describe('section-comments on the visit page of each home-assessment type', () => {
  for (const parent of PARENTS) {
    test(`${parent.name}: VIEW shows the remark and the Comments label, without the form's title`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await addRemark(api, section, REMARK);
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {});
      expect(await view.valueTexts()).toEqual([REMARK]);
      // the label of the remark (`pihcore.remarks`); the legend and the section title are hidden by the VIEW style (ifMode :4)
      await expect(view.root.locator('#comments-form h3')).toBeVisible();
      await expect(view.root.locator('#comments-form h3')).toHaveText('Comments');
      await expect(view.root.locator('#comments-form legend').first()).toBeHidden();
      await expect(view.root.locator('#comments-form .title').first()).toBeHidden();
      // V1: the section has no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
      await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
    });
  }

  test('without a remark the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
  });
});

test.describe('section-comments edit URL (direct; the visit page has no pencil for it)', () => {
  test('the entry page loads the saved remark and has no Save and no Cancel button (V1)', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addRemark(api, section, REMARK);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#comments-section')).toBeVisible();
    await expect(page.locator('#comments-section :is(input[type=text], textarea)')).toHaveValue(REMARK);
    // neither a Save nor a Cancel button: the only form controls are the form's own fields
    await expect(page.locator('form#htmlform :is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });
});
