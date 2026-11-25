import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures, type EntryContext } from '../contract';
import { OBGYN_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, SectionFormPage, ViewFormPage, VisitPage, VISIT_PAGE_URL, expectViewShowsSavedObs, selectDefaultProvider } from '../pages';
import { editEncounterUrl } from '../pages/sectioned-encounter';

// obGyn.xml: "ObGyn consult" (v2.0), the entry form of the OB/GYN encounter. The form has no clinical fields: it is its own shell (the same markup as oncologyIntakeConsult.xml: its
// own who / where / when block, with the location restricted to the "Maternal and Child Location" tag, and no enrollInProgram); the clinical content is entered in the sections of
// the visit page (section-obgyn-initial, section-exam, section-dx-obgyn, section-obgyn-plan: see their specs). The specs reach it with enterHtmlFormWithStandardUi inside a visit the
// fixture creates (EntryFormPage), which skips the visit-action gating of _availability.e2e.md (`obgyn` + `mch`, Maternal and Child Location, `Task: emr.enterMCH`, female). Runs on
// zl-ci. The session location there (Klinik Ekstèn) does NOT carry the "Maternal and Child Location" tag (20 other locations do), so the location select starts empty and the
// form is shown instead of auto-submitting: the specs pick a location, as a user at such a site would.
//
// Conditions in the form (read by hand: 96 lines, no <when>, toggle or includeIf):
//   ifMode ENTER   :24-38   when getValue("encounterLocation.value") is empty -> hide #next and show .htmlform (this form has no .htmlform element: the content is always shown,
//                           V1); else submitHtmlForm() (the form "auto-submits"). Needs a session location with the tag: not covered (see below)
//   ifMode EDIT    :40-49   .htmlform shown (no such element), setUpNextAndSubmitButtons() (nextAndSubmitButtons.js)
//   ifMode VIEW include=false   :51-86, :88-96   heading, who / where / when block and the Next / Save / Cancel buttons: nothing is rendered in VIEW
// Scripts: the two ifMode blocks above and nextAndSubmitButtons.js: no validation, default or derived value of its own. Provider (required, role Consulting Clinician
//   4f10ad1a-...) defaults to the current user, location to the session location (when it carries the tag), date to now.
// Side effects on save: none (no enrollInProgram, no postSubmissionAction): the OB/GYN program is not touched.
// Composition on the visit page (encounterTypeConfig.js, encounter type d83e98fd-..., version key `1` never equals formVersion, so the DEFAULT entry): section-obgyn-initial,
//   vaccinations (an include-section, `require: sex == 'F'`), physical-exam, pihcore-diagnosis-obgyn, section-obgyn-plan, in that order.
// Visit-page display: the visit page does NOT show this form's VIEW. Its entry has no templateModelUrl and the form is a shell (everything it renders is ifMode VIEW
//   include=false), so the form's own VIEW is not tested; the VIEW tests assert the section list and one section's VIEW (the skin exam of section-exam) saved into this encounter.
// Findings: see pihemr _findings.e2e.md#obGyn.xml
//   V1 Info :25-49 the ENTER and EDIT scripts call `jq('.htmlform').show()` but the form has no `.htmlform` element (the same as in oncologyIntakeConsult.xml): nothing is hidden,
//   the form is shown anyway
// Not covered here: the auto-submit path (needs a session location that carries the "Maternal and Child Location" tag; the session is shared by every spec), the Next button's later
//   hops (see _shared V8), availability, the sections' fields (their own specs), the print-form-datestamps block (:8, hidden, print only).

const FORM = 'obGyn.xml';
const SECTION_FORM = 'section-obgyn-initial.xml'; // the first section of the encounter
const EXAM_FORM = 'section-exam.xml'; // a simple section to save into the encounter
const SECTIONS_FEMALE = ['section-obgyn-initial', 'vaccinations', 'physical-exam', 'pihcore-diagnosis-obgyn', 'section-obgyn-plan'];

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext'], gender: 'M' | 'F' = 'F', years = 30) =>
  createEntryContext({ givenName: 'AutoObGyn', familyName: 'Tester', gender, birthdate: birthdateYearsAgo(years) });

// ENTER: the form stays open (the session location is not a Maternal and Child Location); choose the first offered location and save.
const enterObGyn = async (page: Page, api: APIRequestContext, context: EntryContext): Promise<string> => {
  await EntryFormPage.open(page, FORM, context);
  await expect(page.locator('#submit')).toBeVisible();
  if ((await page.locator('#who select').first().inputValue()) === '') {
    await selectDefaultProvider(page);
  }
  await page.locator('#where select').selectOption({ index: 1 });
  await page.locator('#submit').click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
  let uuid = '';
  await expect
    .poll(async () => {
      const encounters = await getPatientEncounters(api, context.patient.uuid);
      uuid = encounters[0]?.uuid ?? '';
      return encounters.length;
    })
    .toBe(1);
  return uuid;
};

const expandEntry = async (page: Page, visitUuid: string): Promise<VisitPage> => {
  const visit = await VisitPage.open(page, visitUuid);
  await visit.expand(visit.encounterOfType(OBGYN_ENCOUNTER_TYPE_UUID));
  return visit;
};

const enrollments = async (api: APIRequestContext, patientUuid: string) => {
  const res = await api.get(`programenrollment?patient=${patientUuid}&v=custom:(uuid)`);
  expect(res.ok(), `get enrollments: ${res.status()}`).toBeTruthy();
  return (await res.json()).results as unknown[];
};

test.describe('obGyn', () => {
  test('ENTER at a session location without the tag shows the form (no auto-submit) with the location empty and no Next button', async ({ page, api, createEntryContext }) => {
    // ifMode ENTER :29: no encounter location value -> hide #next, show .htmlform
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('#next')).toBeHidden();
    await expect(page.locator('#cancel')).toBeVisible();
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('#who-when-where')).toBeVisible();
    await expect(page.locator('#who select option:checked')).toHaveCount(1);
    await expect(page.locator('#where select')).toHaveValue('');
    // the select offers the empty choice and the locations that carry the Maternal and Child Location tag (the session location is not one of them)
    const tagged = await (await api.get('location?tag=Maternal%20and%20Child%20Location&v=custom:(uuid)&limit=100')).json();
    const options = await page.locator('#where select option').count();
    expect(options).toBeGreaterThan(1);
    expect(options).toBeLessThanOrEqual(tagged.results.length + 1);
    await expect(page.locator('#when input.hasDatepicker')).not.toHaveValue('');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
  });

  test('saving without a location is refused with "required" and creates nothing', async ({ page, api, createEntryContext }) => {
    // encounterLocation: the select is empty because the session location does not carry the tag
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#submit').click();
    // the location widget's message is lower case ("required"), unlike the provider's "Required"
    await expect(page.locator('#where span.field-error')).toContainText(/required/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
  });

  test('ENTER with a location saves a form-linked OB/GYN encounter in the visit, with no obs and no program enrolment', async ({ page, api, createEntryContext }) => {
    // submit
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);

    const [encounter] = await getPatientEncounters(api, context.patient.uuid);
    expect(encounter.encounterType.uuid).toBe(OBGYN_ENCOUNTER_TYPE_UUID);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.form, 'HFE links the form').not.toBeNull();
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    expect(new Date(header.encounterDatetime).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    // the chosen location is one of the tagged ones
    const tagged = await (await api.get('location?tag=Maternal%20and%20Child%20Location&v=custom:(uuid)&limit=100')).json();
    expect((tagged.results as Array<{ uuid: string }>).map((l) => l.uuid)).toContain(header.location.uuid);
    expect(await getEncounterObs(api, encounterUuid), 'the shell form saves no obs').toEqual([]);
    expect(await enrollments(api, context.patient.uuid), 'no enrollInProgram: nobody is enrolled').toEqual([]);
  });

  test('the visit page offers obgyn intake, vaccinations, exam, OB/GYN diagnosis and OB/GYN plan for a woman', async ({ page, api, createEntryContext }) => {
    // composition: encounterTypeConfig.js obGyn
    const context = await newPatient(createEntryContext);
    await enterObGyn(page, api, context);
    const visit = await expandEntry(page, context.visitUuid);
    const shown = await visit.shownSectionIds();
    expect(shown).toEqual(SECTIONS_FEMALE);
    for (const id of ['pihcore-history', 'pihcore-diagnosis', 'pihcore-plan', 'pihcore-peds']) {
      expect(shown, `${id} is not a section of this encounter`).not.toContain(id);
    }
  });

  test('a male patient gets the same list without the vaccinations section (require sex == F)', async ({ page, api, createEntryContext }) => {
    // the form is only offered for women (_availability.e2e.md), but the section's own `require` is on the sex: the direct URL shows it
    const context = await newPatient(createEntryContext, 'M');
    await enterObGyn(page, api, context);
    const visit = await expandEntry(page, context.visitUuid);
    expect(await visit.shownSectionIds()).toEqual(SECTIONS_FEMALE.filter((id) => id !== 'vaccinations'));
  });

  test('the visit page shows no VIEW of the form itself: no templateModelUrl, only the sections', async ({ page, api, createEntryContext }) => {
    // Visit-page display (header)
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
    await expect(ViewFormPage.open(page, FORM, encounterUuid)).rejects.toThrow(/shows no VIEW of obGyn\.xml/);
    // the form's own rendering (heading, who / where / when, buttons) is not on the visit page
    await expandEntry(page, context.visitUuid);
    await expect(page.locator('#who-when-where, #buttons')).toHaveCount(0);
  });

  test('EDIT shows the heading, provider, location (saved one selected) and date, and the Next, Save and Cancel buttons', async ({ page, api, createEntryContext }) => {
    // ifMode EDIT :40 and ifMode VIEW include=false :51, :90
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
    await expect(page.locator('#who select option:checked')).toHaveCount(1);
    await expect(page.locator('#where select')).not.toHaveValue('');
    await expect(page.locator('#when input.hasDatepicker')).not.toHaveValue('');
  });

  test('EDIT without a provider is refused with "Required" and changes nothing', async ({ page, api, createEntryContext }) => {
    // encounterProviderAndRole required="true" :64
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#who select').first().selectOption({ index: 0 });
    await page.locator('#submit').click();
    await expect(page.locator('#who span.field-error')).toContainText('Required');
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect((await getEncounterHeader(api, encounterUuid)).encounterProviders).toHaveLength(1);
  });

  test('Next saves the shell and opens the edit form of the first section of the encounter (the obgyn intake)', async ({ page, api, createEntryContext }) => {
    // #next (nextAndSubmitButtons.js setUpNextButton)
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#next')).toBeVisible();
    await page.locator('#next').click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('definitionUiResource'))
      .toBe(`file:configuration/pih/htmlforms/${SECTION_FORM}`);
    expect(new URL(page.url()).searchParams.get('encounterId')).toBe(encounterUuid);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.uuid)).toEqual([encounterUuid]);
  });

  test('EDIT Save keeps the same encounter, provider, location and date', async ({ page, api, createEntryContext }) => {
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
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
    // cross-section: the exam section (section-exam.xml) edits THIS encounter; the shell's EDIT must not void obs it has no field for
    const context = await newPatient(createEntryContext);
    const encounterUuid = await enterObGyn(page, api, context);
    const before = await getEncounterHeader(api, encounterUuid);

    await page.goto(editEncounterUrl(EXAM_FORM, context, encounterUuid));
    // the "Normal" box of the skin block; sticky headings intercept the pointer, so click through the DOM
    await page.locator('#skin + .collapsible-content').getByLabel('Normal', { exact: true }).evaluate((el) => (el as HTMLElement).click());
    await page.locator('#submit').evaluate((el) => (el as HTMLElement).click());
    await new SectionFormPage(page, EXAM_FORM).expectSaved();

    const obs = await getEncounterObs(api, encounterUuid);
    expect(obs.map((o) => o.display.toLowerCase())).toEqual([expect.stringContaining('skin exam findings: normal')]);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.uuid)).toEqual([encounterUuid]);
    expect((await getEncounterHeader(api, encounterUuid)).form?.uuid, "the section does not replace the encounter's form").toBe(before.form?.uuid);

    // VIEW: the visit page shows the section's own VIEW inside this encounter
    const view = await expectViewShowsSavedObs(page, api, EXAM_FORM, encounterUuid);
    expect((await view.valueTexts()).join(' | ')).toContain('Normal');

    // re-save the shell in EDIT: the section's obs stay
    await page.goto(editEncounterUrl(FORM, context, encounterUuid));
    await expect(page.locator('#submit')).toBeVisible();
    await page.locator('#submit').click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    expect(await getEncounterObs(api, encounterUuid)).toHaveLength(1);
  });
});
