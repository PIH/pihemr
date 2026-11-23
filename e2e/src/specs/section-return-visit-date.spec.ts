import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { isoDate, pickerDate } from '../pages/form-widgets';

// section-return-visit-date.xml (pihemr, v1.0): "Return Visit Date": one date (PIH:RETURN VISIT DATE, id apptDate, allowPastDates=false) for the community-health
// home-assessment encounters. On the visit page it is the `section-return-visit-date` section of the Prenatal, Pediatric and Maternal Post-partum home-assessment types
// (not of Maternal Follow-up); no form of this repo creates those encounters (how the community health app does is unverified), so the specs create the parent over REST
// (female patient) and add the obs over REST. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (central, petiteriviere and verrettes list `chwApp`).
//
// Conditions in the form, from documentation inventory (section-return-visit-date.inv.md):
//   ifMode VIEW include=true :4   a <style> that hides the legend, the section title and the encounter date / provider / location
//   (no when / includeIf / scripts)
// Side effects on save: none. THE FORM CANNOT BE SAVED (V1): it has no Save button and its entry in encounterTypeConfig.js has no `editUrl` (no pencil on the visit page).
// Visit-page display: `section-return-visit-date` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci): expectViewShowsSavedObs. The Maternal Follow-up type does not list the section, so its visit page shows no VIEW of this form.
// Findings: see pihemr _findings.e2e.md#section-return-visit-date
//   V1 Info    no Save button in the form and no `editUrl` for the section: the date cannot be entered or corrected from the EMR
//   V2 Low     :66 headerCode `pihcore.returnVisitDate.title` has no message on zl-ci: the entry page prints the raw code as the section title (the VIEW hides it by style)
// Not covered here: entering the date through the form (no Save button, V1), the home-assessment app that creates the parent encounters (unverified).

const FORM = 'section-return-visit-date.xml';
const RETURN = isoDate(14);

const PARENTS = [
  { name: 'Prenatal Home Assessment', uuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Pediatric Home Assessment', uuid: PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
  { name: 'Maternal Post-partum Home Assessment', uuid: MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID },
];

const patient = { givenName: 'AutoReturnDate', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(25) };

// Records the return visit date on the encounter the way the community-health app would (the form has no way to save it). Noon UTC: the same calendar day in the
// server's and the browser's time zones.
const addReturnDate = async (api: APIRequestContext, section: SectionEncounter, isoDay: string) => {
  const concept = await api.get('concept/PIH:RETURN VISIT DATE?v=custom:(uuid)');
  expect(concept.ok(), `get concept PIH:RETURN VISIT DATE: ${concept.status()}`).toBeTruthy();
  const res = await api.post('obs', {
    data: {
      person: section.patient.uuid,
      concept: (await concept.json()).uuid,
      encounter: section.encounter.uuid,
      obsDatetime: new Date(Date.now() - 60_000).toISOString(),
      value: `${isoDay}T12:00:00.000+0000`,
    },
  });
  expect(res.ok(), `create the return visit date obs: ${res.status()}`).toBeTruthy();
};

test.describe('section-return-visit-date on the visit page of each home-assessment type', () => {
  for (const parent of PARENTS) {
    test(`${parent.name}: VIEW shows the return visit date and its label, without the form's title`, async ({ page, api, createSectionEncounter }) => {
      const section = await createSectionEncounter({ encounterTypeUuid: parent.uuid, patient });
      await addReturnDate(api, section, RETURN);
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {});
      expect(await view.valueTexts()).toEqual([pickerDate(RETURN)]);
      await expect(view.valueOf('apptDate')).toHaveText(pickerDate(RETURN));
      await expect(view.root.locator('#return-visit-date-form h3')).toHaveText('Return visit date');
      await expect(view.root.locator('#return-visit-date-form legend').first()).toBeHidden();
      await expect(view.root.locator('#return-visit-date-form .title').first()).toBeHidden();
      // V1: the section has no edit pencil on the visit page (no `editUrl` in encounterTypeConfig.js)
      await expect(view.root.locator('xpath=ancestor::encounter-section').first().locator('a.edit-encounter i.icon-pencil:visible')).toHaveCount(0);
    });
  }

  test('Maternal Follow-up Home Assessment lists no return-visit-date section', async ({ page, createSectionEncounter }) => {
    // encounterTypeConfig.js: the sections of 690670E2 end with section-comments
    const section = await createSectionEncounter({ encounterTypeUuid: MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    
    await expect(ViewFormPage.open(page, FORM, section.encounter.uuid)).rejects.toThrow(/shows no VIEW of section-return-visit-date\.xml/);
  });

  test('without a date the VIEW shows no value', async ({ page, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values.filter({ hasText: /\S/ })).toHaveCount(0);
  });
});

test.describe('section-return-visit-date edit URL (direct; the visit page has no pencil for it)', () => {
  test('the entry page loads the saved date and has no Save and no Cancel button (V1)', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID, patient });
    await addReturnDate(api, section, RETURN);
    await page.goto(SectionFormPage.editUrl(FORM, section));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#apptDate input[readonly]')).toHaveValue(pickerDate(RETURN));
    // neither a Save nor a Cancel button: the only form controls are the form's own fields
    await expect(page.locator('form#htmlform :is(button, input[type=submit], input[type=button])')).toHaveCount(0);
  });
});

