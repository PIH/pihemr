import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { addObs } from '../rest';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';

// section-maternal-vital-signs.xml (pihemr, v1.0): "Maternal Vital Signs": the vital signs of a home visit, for the community-health home assessments (all four types). On the
// visit page it is the `section-maternal-vital-signs` section of the Prenatal, Pediatric, Maternal Post-partum and Maternal Follow-up types. No form of this repo creates those
// encounters (how the community health app does is unverified), so the specs create the parent over REST (female patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central,
// petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-maternal-vital-signs.inv.md):
//   ifMode   VIEW include=true :5    a <style> that hides the title and the encounter date / provider / location (no obs, no script)
//   includeIf $encounter.encounterType.uuid != 0CF4717A (every type but Pediatric) :70   blood pressure (bp_systolic, bp_diastolic)
//   includeIf $encounter.encounterType.uuid == 0CF4717A (Pediatric)                :116  weight_kg, height_cm, head_cm (head circumference), MUAC (CIEL:160908, a dropdown),
//                                                                                        meals per day (CIEL:165591)
//   always: temperature_c, heart_rate, respiratory_rate
//   (no when / scripts: no colouring, BMI or range check, unlike the clinic vitals forms)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): no Save button, and the section's entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `section-maternal-vital-signs` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci for the four parents): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-maternal-vital-signs
//   V1 Info    no Save button and no `editUrl` for the section: the vital signs cannot be entered or corrected from the EMR (only by the app that creates the encounter)
// Not covered here: entering the vital signs through the form (no Save button, V1), the home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-maternal-vital-signs.xml';

const ADULT_PARENTS = [
  { name: 'Prenatal Home Assessment', uuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Follow-up Home Assessment', uuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
];
const PEDIATRIC_BLOCK = ['weight_kg', 'height_cm', 'head_cm'];

const patient = { givenName: 'AutoVitalSigns', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

type Section = Parameters<typeof addObs>[1];

// the three vitals both branches have
const recordCommon = async (api: APIRequestContext, section: Section) => {
  await addObs(api, section, 'PIH:TEMPERATURE (C)', 37.5);
  await addObs(api, section, 'PIH:PULSE', 72);
  await addObs(api, section, 'PIH:RESPIRATORY RATE', 18);
};

const recordPediatric = async (api: APIRequestContext, section: Section) => {
  await recordCommon(api, section);
  await addObs(api, section, 'PIH:WEIGHT (KG)', 7.5);
  await addObs(api, section, 'PIH:HEIGHT (CM)', 65);
  await addObs(api, section, 'PIH:HEAD CIRCUMFERENCE', 42);
  const muac = await api.get('concept/CIEL:160908?v=custom:(answers:(uuid,display))');
  expect(muac.ok(), `get concept CIEL:160908: ${muac.status()}`).toBeTruthy();
  const yellow = ((await muac.json()).answers as Array<{ uuid: string; display: string }>).find((a) => a.display === 'Yellow color');
  expect(yellow, 'the MUAC question has the answer "Yellow color"').toBeTruthy();
  await addObs(api, section, 'CIEL:160908', { coded: yellow!.uuid });
  await addObs(api, section, 'CIEL:165591', 3);
};

test.describe('section-maternal-vital-signs on the visit page', () => {
  for (const parent of ADULT_PARENTS) {
    // includeIf :70 (not Pediatric)
    test(`${parent.name}: VIEW shows blood pressure, temperature, heart and respiratory rate, and none of the pediatric measures`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await addObs(api, section, 'PIH:SYSTOLIC BLOOD PRESSURE', 118);
      await addObs(api, section, 'PIH:DIASTOLIC BLOOD PRESSURE', 76);
      await recordCommon(api, section);
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid);
      await expect(view.valueOf('bp_systolic')).toHaveText('118');
      await expect(view.valueOf('bp_diastolic')).toHaveText('76');
      await expect(view.valueOf('temperature_c')).toHaveText('37.5');
      await expect(view.valueOf('heart_rate')).toHaveText('72');
      await expect(view.valueOf('respiratory_rate')).toHaveText('18');
      // units are printed next to the value
      await expect(view.root.locator('#temperature_c')).toContainText('°C');
      await expect(view.root.locator('#heart_rate')).toContainText('/min');
      // includeIf :116 fails: no weight / height / head circumference / MUAC / meals
      for (const id of PEDIATRIC_BLOCK) {
        await expect(view.root.locator(`#${id}`)).toHaveCount(0);
      }
      await expect(view.root).not.toContainText('Weight');
      await expect(view.root).not.toContainText('MUAC');
      expect(await view.values.count()).toBe(5);
    });
  }

  // includeIf :116 (Pediatric) and :70 (not Pediatric) fails
  test('Pediatric Home Assessment: VIEW shows temperature, rates, weight, height, head circumference, MUAC and meals per day, and no blood pressure', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await recordPediatric(api, section);
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid);
    await expect(view.valueOf('temperature_c')).toHaveText('37.5');
    await expect(view.valueOf('heart_rate')).toHaveText('72');
    await expect(view.valueOf('respiratory_rate')).toHaveText('18');
    await expect(view.valueOf('weight_kg')).toHaveText('7.5');
    await expect(view.valueOf('height_cm')).toHaveText('65');
    await expect(view.valueOf('head_cm')).toHaveText('42');
    await expect(view.root.locator('#weight_kg')).toContainText('kg');
    await expect(view.root.locator('fieldset', { hasText: 'MUAC' }).locator('.value')).toHaveText('Yellow color');
    await expect(view.root.locator('fieldset', { hasText: 'Meals per day' }).locator('.value')).toHaveText('3');
    // includeIf :70 fails: no blood pressure
    await expect(view.root.locator('#bp_systolic, #bp_diastolic')).toHaveCount(0);
    await expect(view.root).not.toContainText('Blood Pressure');
    expect(await view.values.count()).toBe(8);
    // V1: no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
    await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
  });

  test('without recorded vital signs the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
    await expect(view.root.locator('.emptyValue')).toHaveCount(5);
  });
});

test.describe('section-maternal-vital-signs edit URL (direct; the visit page has no pencil for it)', () => {
  test('Prenatal: the entry page loads the recorded values into the blood pressure, temperature and rate fields and has no Save and no Cancel button (V1)', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addObs(api, section, 'PIH:SYSTOLIC BLOOD PRESSURE', 118);
    await addObs(api, section, 'PIH:DIASTOLIC BLOOD PRESSURE', 76);
    await recordCommon(api, section);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('#bp_systolic input')).toHaveValue('118');
    await expect(form.locator('#bp_diastolic input')).toHaveValue('76');
    await expect(form.locator('#temperature_c input')).toHaveValue('37.5');
    await expect(form.locator('#heart_rate input')).toHaveValue('72');
    await expect(form.locator('#respiratory_rate input')).toHaveValue('18');
    await expect(form.locator('#weight_kg')).toHaveCount(0);
    // neither a Save nor a Cancel button: the only form controls are the form's own fields
    await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });

  test('Pediatric: the entry page has the pediatric fields (weight, height, head circumference, MUAC dropdown, meals) and no blood pressure', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await recordPediatric(api, section);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    const form = page.locator('form#htmlform');
    await expect(form.locator('#weight_kg input')).toHaveValue('7.5');
    await expect(form.locator('#height_cm input')).toHaveValue('65');
    await expect(form.locator('#head_cm input')).toHaveValue('42');
    await expect(form.locator('fieldset', { hasText: 'MUAC' }).locator('select option:checked')).toHaveText('Yellow color');
    await expect(form.locator('fieldset', { hasText: 'Meals per day' }).locator('input')).toHaveValue('3');
    await expect(form.locator('#bp_systolic, #bp_diastolic')).toHaveCount(0);
    await expect(form.locator(':is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });
});
