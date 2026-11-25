import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { PRIMARY_CARE_ADULT_INITIAL_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getEncounterObs, getPatientEncounters } from '../rest';
import { SectionFormPage, ViewFormPage, VisitPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { editEncounterUrl, enterShellForm } from '../pages/sectioned-encounter';

// primary-care-adult-initial.xml: "Outpatient Intake (Adult)", the entry form of the primary-care adult INTAKE encounter. The form has no
// fields of its own: it is the encounter-with-sections.xml shell (heading + the encounter-provider-location-date subform, "EPLD") with the
// location widget restricted to the "Primary Care Consult Location" tag; everything clinical is entered in the sections of the visit page
// (section-history, section-exam, section-dx, section-plan: see their specs). The specs reach it with enterHtmlFormWithStandardUi inside a
// visit the fixture creates (EntryFormPage), which skips the visit-action gating of _availability.e2e.md (no initial in an earlier visit,
// adult at visit start, retro / `Task: emr.enterPrimaryCareConsultNote`). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere) (session location Klinik Ekstèn carries the tag).
//
// Conditions in the form (read from the XML: a 17-line wrapper around subforms/encounter-with-sections.xml, "trivial" in the skill's terms):
//   ifMode ENTER   shell :12-25    .htmlform is display:none; when every input of #who-when-where has a value -> submitHtmlForm() (the form
//                                 "auto-submits"), else #next is hidden and the form is shown
//   ifMode EDIT    shell :28-35   shows .htmlform, setUpNextAndSubmitButtons() (nextAndSubmitButtons.js)
//   ifMode VIEW include=false     shell :39-41, :47-53 (the .htmlform div :37 is display:none)   heading, EPLD and the Next / Save / Cancel buttons: nothing is rendered in VIEW
// Scripts: the two shell blocks above and the EPLD permission script (_shared.e2e.md): no validation, default or derived value of its own.
//   Provider (required, role Consulting Clinician 4f10ad1a-...) defaults to the current user, location to the session location, date to now.
// Side effects on save: none (no obs, program or order; the encounter is saved with the form linked).
// Composition on the visit page (encounterTypeConfig.js `primaryCareAdultInitialConsult`, encounter type 27d3a180-...): sections
//   pihcore-history, physical-exam, pihcore-diagnosis, pihcore-plan, in that order. No chief-complaint section (the history section has the
//   chief complaint), no peds feeding section and no vaccinations (the peds forms only).
// Visit-page display: the visit page does NOT show this form's VIEW. Its entry has no templateModelUrl and both templates are
//   defaultEncounterShort.page ("no expanded view, instead there are individual sections"): the encounter expands to its sections, each
//   showing the VIEW of its own section form. So the form's own VIEW is not tested (and everything it renders is ifMode VIEW include=false);
//   the VIEW tests assert the section list and one section's VIEW (the chief complaint of section-history) saved into this encounter.
// Not covered here: the "location empty -> form shown" path (needs a session location without the tag; the session is shared by every spec),
//   the Next button's second hop (the later sections; see _shared V8), availability, the sections' fields (their own specs).

const FORM = 'primary-care-adult-initial.xml';
const SECTION_FORM = 'section-history.xml'; // the section that has a (simple) chief complaint text in this encounter type
const COMPLAINT = 'Cough for two weeks';
const SECTIONS = ['pihcore-history', 'physical-exam', 'pihcore-diagnosis', 'pihcore-plan'];
const NOT_OFFERED = ['pihcore-chief-complaint', 'pihcore-peds', 'vaccinations'];

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], years = 30) =>
  createEntryContext({ givenName: 'AutoPrimaryCare', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(years) });

const expandEntry = async (page: Page, visitUuid: string): Promise<VisitPage> => {
  const visit = await VisitPage.open(page, visitUuid);
  await visit.expand(visit.encounterOfType(PRIMARY_CARE_ADULT_INITIAL_ENCOUNTER_TYPE_UUID));
  return visit;
};

test.describe('primary-care-adult-initial', () => {
  test('ENTER auto-submits at a Primary Care Consult location and saves a form-linked encounter in the visit', async ({
    site,
    page,
    api,
    createEntryContext,
  }) => {
    // ifMode ENTER shell :12: every #who-when-where input has a value -> submitHtmlForm()
    const context = await newPatient(createEntryContext);
    expect(await getPatientEncounters(api, context.patient.uuid)).toHaveLength(0);
    const encounterUuid = await enterShellForm(page, api, FORM, context);

    const [encounter] = await getPatientEncounters(api, context.patient.uuid);
    expect(encounter.encounterType.uuid).toBe(PRIMARY_CARE_ADULT_INITIAL_ENCOUNTER_TYPE_UUID);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.visit?.uuid).toBe(context.visitUuid);
    // location defaults to the session location (Klinik Ekstèn, which has the tag); provider to the current user, as Consulting Clinician
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    // date defaults to now: not after the server clock
    expect(new Date(header.encounterDatetime).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(await getEncounterObs(api, encounterUuid), 'the shell form saves no obs').toEqual([]);
  });

  test('the visit page offers history, exam, diagnosis and plan, and no chief-complaint, peds or vaccination section', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // composition: encounterTypeConfig.js primaryCareAdultInitialConsult
    const context = await newPatient(createEntryContext);
    await enterShellForm(page, api, FORM, context);
    const visit = await expandEntry(page, context.visitUuid);
    const shown = await visit.shownSectionIds();
    expect(shown).toEqual(SECTIONS);
    for (const id of NOT_OFFERED) {
      expect(shown, `${id} is not a section of this encounter`).not.toContain(id);
    }
  });

  test('the sections follow the encounter type, not the age: a child gets the same adult list', async ({ page, api, createEntryContext }) => {
    // the peds sections of the peds forms are gated by the age at visit start; this form lists none of them
    const context = await newPatient(createEntryContext, 8);
    await enterShellForm(page, api, FORM, context);
    const visit = await expandEntry(page, context.visitUuid);
    expect(await visit.shownSectionIds()).toEqual(SECTIONS);
  });

  test('the visit page shows no VIEW of the form itself: no templateModelUrl, only the sections', async ({ page, api, createEntryContext }) => {
    // Visit-page display (header)
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    await expect(ViewFormPage.open(page, FORM, encounterUuid)).rejects.toThrow(/shows no VIEW of primary-care-adult-initial\.xml/);
    // the form's own rendering (heading, EPLD, buttons) is not on the visit page
    await expandEntry(page, context.visitUuid);
    await expect(page.locator('.htmlform, #who-when-where, #buttons')).toHaveCount(0);
  });

  test('EDIT shows the heading, the provider and location selects, the date and the Next, Save and Cancel buttons', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // ifMode EDIT shell :28: .htmlform shown; EPLD renders #who, #where (tag Primary Care Consult Location), #when
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('.htmlform h2')).toHaveText(/^\s*Outpatient Intake \(Adult\)\s*$/);
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
    await expect(page.locator('.htmlform select')).toHaveCount(2);
    await expect(page.locator('#who select option:checked')).toHaveCount(1);
    await expect(page.locator('#when input.hasDatepicker')).not.toHaveValue('');
    // the location select offers only the Primary Care Consult Location locations, with the saved one selected
    const tagged = await (await api.get('location?tag=Primary%20Care%20Consult%20Location&v=custom:(display)&limit=100')).json();
    const names: string[] = tagged.results.map((l: { display: string }) => l.display);
    const selected = (await page.locator('#where select option:checked').innerText()).trim();
    expect(names, 'the saved location is one of the tagged locations').toContain(selected);
    const options = await page.locator('#where select option').count();
    expect(options).toBeGreaterThan(1);
    expect(options).toBeLessThanOrEqual(names.length);
  });

  test('EDIT without a provider is refused with "Required" and changes nothing', async ({ page, api, createEntryContext }) => {
    // EPLD: encounterProviderAndRole required="true"
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#who select').first().selectOption({ index: 0 });
    await page.locator('#submit').click();
    await expect(page.locator('#who span.field-error')).toContainText('Required');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.encounterProviders).toHaveLength(1);
  });

  test('Next saves the shell and opens the edit form of the first section of the encounter', async ({ page, api, createEntryContext }) => {
    // #next (nextAndSubmitButtons.js setUpNextButton): submit with goToNext=true -> the visit page opens the first section's edit form
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#next')).toBeVisible();
    await page.locator('#next').click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('definitionUiResource'))
      .toBe(`file:configuration/pih/htmlforms/${SECTION_FORM}`);
    expect(new URL(page.url()).searchParams.get('encounterId')).toBe(encounterUuid);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.uuid)).toEqual([encounterUuid]);
  });

  test('EDIT Save keeps the same encounter and its provider, location and date', async ({ page, api, createEntryContext }) => {
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    const before = await getEncounterHeader(api, encounterUuid);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#submit').click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);

    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.uuid)).toEqual([encounterUuid]);
    const after = await getEncounterHeader(api, encounterUuid);
    expect(after.location.uuid).toBe(before.location.uuid);
    expect(after.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(before.encounterProviders.map((p) => p.encounterRole.uuid));
    expect(after.encounterDatetime.slice(0, 10)).toBe(before.encounterDatetime.slice(0, 10));
    expect(after.form?.uuid).toBe(before.form?.uuid);
  });

  test('a section saved into the encounter the shell created shows in its VIEW, and re-saving the shell keeps the section obs', async ({
    page,
    api,
    createEntryContext,
  }) => {
    // cross-section: the history section (section-history.xml) edits THIS encounter; the shell's EDIT must not void obs it has no field for
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterShellForm(page, api, FORM, context);
    const before = await getEncounterHeader(api, encounterUuid);

    await page.goto(editEncounterUrl(SECTION_FORM, context, encounterUuid));
    await page.locator('#chief-complaint textarea').fill(COMPLAINT);
    await new SectionFormPage(page, SECTION_FORM).save();
    await new SectionFormPage(page, SECTION_FORM).expectSaved();

    const obs = await getEncounterObs(api, encounterUuid);
    expect(obs.map((o) => o.value)).toEqual([COMPLAINT]);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.uuid)).toEqual([encounterUuid]);
    expect((await getEncounterHeader(api, encounterUuid)).form?.uuid, 'the section does not replace the encounter\'s form').toBe(before.form?.uuid);

    // VIEW: the visit page shows the section's own VIEW inside this encounter
    const view = await expectViewShowsSavedObs(page, api, SECTION_FORM, encounterUuid);
    expect(await view.valueTexts()).toContain(COMPLAINT);

    // re-save the shell in EDIT: the section's obs stay
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#submit').click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    expect((await getEncounterObs(api, encounterUuid)).map((o) => o.value)).toEqual([COMPLAINT]);
  });
});
