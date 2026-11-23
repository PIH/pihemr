import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs } from '../rest';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-family-planning-simple.xml (pihemr, v1.0): "Maternal Family planning": the method(s) of family planning (Method of family planning CIEL:374), nine checkboxes
// from one <repeat>, for the community-health Maternal Post-partum and Maternal Follow-up home assessments. On the visit page it is the `maternal-family-planning` section of
// those two types only. No form of this repo creates those encounters (how the community health app does is unverified), so the specs create the parent over REST (female
// patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-family-planning-simple.inv.md):
//   ifMode VIEW include=true :5   a <style> that widens the fieldsets (no obs, no script)
//   (no when / includeIf / scripts: no per-parent branch; the visit page lists the section under 0E7160DF and 690670E2 only, tested below)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): no Save button, and the section's entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `maternal-family-planning` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-family-planning-simple
//   V1 Info    no Save button and no `editUrl` for the section: the methods cannot be entered or corrected from the EMR (only by the app that creates the encounter)
// Not covered here: entering the methods through the form (no Save button, V1), the home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-family-planning-simple.xml';

const PARENTS = [
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
];

const patient = { givenName: 'AutoFamilyPlan', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

// The nine checkboxes in form order (concept names), and the two the tests record.
const METHODS = [
  'Jadelle (implantable contraceptive)',
  'Tubal ligation',
  'Medroxyprogesterone acetate (Depo-provera)',
  'Intra uterine device (IUD)',
  'Condoms',
  'Oral contraception',
  'Natural family planning',
  'None',
  'Not applicable',
];
const RECORDED = ['Condoms', 'Natural family planning'];

const record = async (api: Parameters<typeof addObs>[0], section: Parameters<typeof addObs>[1]) => {
  await addObs(api, section, 'CIEL:374', { coded: 'CIEL:190' });
  await addObs(api, section, 'CIEL:374', { coded: 'CIEL:5277' });
};

test.describe('section-family-planning-simple on the visit page', () => {
  for (const parent of PARENTS) {
    test(`${parent.name}: VIEW ticks the recorded methods and leaves the other seven unticked`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await record(api, section);
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid);
      expect((await view.valueTexts()).sort()).toEqual(RECORDED.map((m) => `[X] ${m}`).sort());
      // the checkboxes come in the order of the form's <repeat>
      const lines = (await view.root.locator('.value, .emptyValue').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      expect(lines).toEqual(METHODS.map((m) => (RECORDED.includes(m) ? `[X] ${m}` : `[ ] ${m}`)));
      // V1: no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
      await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
    });
  }

  test('without recorded methods the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
  });

  // encounterTypeConfig.js: Prenatal and Pediatric do not list `maternal-family-planning`
  for (const parent of [
    { name: 'Prenatal Home Assessment', uuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
    { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  ]) {
    test(`${parent.name} lists no family-planning section`, async ({ page, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await expect(ViewFormPage.open(page, FORM, section.encounter.uuid)).rejects.toThrow(/shows no VIEW of section-family-planning-simple\.xml/);
    });
  }
});

test.describe('section-family-planning-simple edit URL (direct; the visit page has no pencil for it)', () => {
  test('the entry page loads the recorded methods as ticked boxes and has no Save and no Cancel button (V1)', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await record(api, section);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('input[type=checkbox]')).toHaveCount(METHODS.length);
    for (const method of METHODS) {
      const box = form.getByLabel(method, { exact: true });
      if (RECORDED.includes(method)) {
        await expect(box).toBeChecked();
      } else {
        await expect(box).not.toBeChecked();
      }
    }
    // neither a Save nor a Cancel button: the only form controls are the form's own fields
    await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });
});
