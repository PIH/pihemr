import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs } from '../rest';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-education-subjects.xml (pihemr, v1.0): "Education Subjects": the counselling subjects given to an expectant mother (six checkboxes, all answers of one question,
// Counseling for expectant mother CIEL:1912) for the community-health Prenatal Home Assessment. On the visit page it is the `section-education-subjects` section of the
// Prenatal type only. No form of this repo creates that encounter (how the community health app does is unverified), so the specs create the parent over REST (female
// patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-education-subjects.inv.md):
//   ifMode VIEW include=true :11   a <style> that lays the fieldsets out line by line (no obs, no script)
//   (no when / includeIf / scripts: the form has no per-parent branch; the visit page lists it under the Prenatal type only, tested below)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V2): no Save button, and the section's entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `section-education-subjects` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-education-subjects
//   V1 Low  :79-107 plural `answerCodes` on a singular `answerConceptId`: HFE ignores it, so the checkboxes carry the concept names ("Counseling, danger signs of pregnancy")
//           instead of the messages the form names ("Danger signs", `pihcore.mch.dangerSigns`). Fix: `answerCode=` (TESTED below with test.fixme)
//   V2 Info no Save button and no `editUrl` for the section: the subjects cannot be entered or corrected from the EMR (only by the app that creates the encounter)
// Not covered here: entering the subjects through the form (no Save button, V2), the home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-education-subjects.xml';

const patient = { givenName: 'AutoEducation', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

// Checkbox label as rendered now (the concept name, V1) for the three subjects the tests record.
const RECORDED = ['Counseling about breastfeeding', 'Antenatal counseling, good nutrition', 'Family planning counseling'];
const UNRECORDED = ['Counseling, danger signs of pregnancy', 'Sanitation/hygiene counseling', 'Other'];

const record = async (api: Parameters<typeof addObs>[0], section: Parameters<typeof addObs>[1]) => {
  await addObs(api, section, 'CIEL:1912', { coded: 'CIEL:1910' });
  await addObs(api, section, 'CIEL:1912', { coded: 'CIEL:161073' });
  await addObs(api, section, 'CIEL:1912', { coded: 'CIEL:1382' });
};

test.describe('section-education-subjects on the visit page', () => {
  test('Prenatal Home Assessment: VIEW ticks the recorded subjects and leaves the others unticked', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await record(api, section);
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid);
    expect((await view.valueTexts()).sort()).toEqual(RECORDED.map((l) => `[X] ${l}`).sort());
    const text = (await view.root.innerText()).replace(/\s+/g, ' ');
    for (const label of UNRECORDED) {
      expect(text, `${label} is unticked`).toMatch(new RegExp(`\\[\\s*\\] ${label.replace(/[/.]/g, '\\$&')}`));
    }
    // the section title is the question (a label), not a value
    await expect(view.root.getByText('Counseling for expectant mother')).toBeVisible();
    // V2: no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
    await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
  });

  // V1: the checkboxes should carry the form's messages. Remove test.fixme() when the form uses `answerCode=`.
  test.fixme('V1: VIEW labels the subjects with the form messages ("Breastfeeding", "Good nutrition", "Family planning")', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await record(api, section);
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    expect((await view.valueTexts()).sort()).toEqual(['[X] Breastfeeding', '[X] Family planning', '[X] Good nutrition']);
  });

  test('without recorded subjects the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
  });

  // encounterTypeConfig.js: only the Prenatal type lists `section-education-subjects`
  for (const parent of [
    { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
    { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
    { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  ]) {
    test(`${parent.name} lists no education-subjects section`, async ({ page, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await expect(ViewFormPage.open(page, FORM, section.encounter.uuid)).rejects.toThrow(/shows no VIEW of section-education-subjects\.xml/);
    });
  }
});

test.describe('section-education-subjects edit URL (direct; the visit page has no pencil for it)', () => {
  test('the entry page loads the recorded subjects as ticked boxes and has no Save and no Cancel button (V2)', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await record(api, section);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('input[type=checkbox]')).toHaveCount(6);
    for (const label of RECORDED) {
      await expect(form.getByLabel(label, { exact: true })).toBeChecked();
    }
    for (const label of UNRECORDED) {
      await expect(form.getByLabel(label, { exact: true })).not.toBeChecked();
    }
    // neither a Save nor a Cancel button: the only form controls are the form's own fields
    await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });
});
