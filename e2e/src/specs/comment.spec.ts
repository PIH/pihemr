import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { type PihemrFixtures } from '../contract';
import { COMMENT_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getEncounterHeader, getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs, selectDefaultProvider } from '../pages';

// comment.xml (pihemr, v1.0): "Comment": one free-text remark (PIH:CLINICAL IMPRESSION COMMENTS, a 5-row textarea) with the provider, location and date of
// the encounter. Top-level form: the specs open enterHtmlFormWithStandardUi inside a visit they created (EntryFormPage), so the visit action's gating
// (_availability.e2e.md: `commentForm`, i.e. the hiv profile only, no privilege, no location tag, no `require`) is not exercised. Runs on the ZL hiv server only
// (E2E_TARGET=hiv-ci, which also sets E2E_PROFILE=hiv, the one profile that offers the form): no other server of this suite offers it. The form uses <submit>: there is no #submit, the button is
// `#buttons input.submitButton`.
//
// Conditions in the form, from the XML:
//   ifMode VIEW include=false   the provider / location / date block (`#who-when-where`) and the Save / Cancel buttons are not in the VIEW
//   Required (HFE): the provider (encounterProviderAndRole default currentUser, role 4f10ad1a, required) and the location (tag Consult Note Location,
//   default the session location). No scripts, no `when`, no post-submission action: a save writes one Comment encounter and at most one obs.
// Visit-page display: the visit page shows the form's VIEW of a Comment encounter (encounterTypeConfig.js, c30d6e06): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#comment (V1 Low: nothing requires the remark, so an empty Comment encounter can be saved; asserted below)
// Not covered here: the "Notes" widget that enableCommentForm adds to the dashboard, the visit action itself, a retrospective date.

const FORM = 'comment.xml';
const SAVE = '#buttons input.submitButton';
const REMARK = 'Patient reports feeling better today';

const open = async (page: Page, createEntryContext: PihemrFixtures['createEntryContext']) => {
  const context = await createEntryContext({ givenName: 'AutoComment', familyName: 'Tester', gender: 'F' });
  const form = await EntryFormPage.open(page, FORM, context);
  await expect(page.locator('textarea')).toBeVisible();
  await selectDefaultProvider(page);
  return { context, form };
};
const remark = (page: Page) => page.locator('textarea');
const savedEncounters = async (api: Parameters<typeof getPatientEncounters>[0], patientUuid: string) => {
  const encounters = await getPatientEncounters(api, patientUuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([COMMENT_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};

test.describe('comment @hiv-ci', () => {
  test('ENTER shows the provider, the location (session location preselected), the date, the remark and Save / Cancel', async ({ page, createEntryContext }) => {
    await open(page, createEntryContext);
    await expect(page.locator('#who-when-where #who select')).toBeVisible();
    await expect(page.locator('#where select')).not.toHaveValue(''); // the session location has the Consult Note Location tag
    await expect(page.locator('#when')).toBeVisible();
    await expect(remark(page)).toHaveAttribute('rows', '5');
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#buttons button.cancel')).toBeVisible();
  });

  test('a remark is saved as one Comment encounter at the session location, with its provider, and the browser returns to the visit page', async ({ site, page, api, createEntryContext }) => {
    const { context, form } = await open(page, createEntryContext);
    await remark(page).fill(REMARK);
    await page.locator(SAVE).click();
    await form.expectSaved();

    const encounterUuid = await savedEncounters(api, context.patient.uuid);
    const header = await getEncounterHeader(api, encounterUuid);
    expect(header.location.uuid).toBe(site.sessionLocationUuid);
    expect(header.visit?.uuid).toBe(context.visitUuid);
    expect(header.encounterProviders.map((p) => p.encounterRole.uuid)).toEqual(['4f10ad1a-ec49-48df-98c7-1391c6ac7f05']);
    const obs = await getEncounterObs(api, encounterUuid);
    expect(obs).toHaveLength(1);
    expect(obs[0].display).toMatch(/^Clinical impression comments: /i);
    expect(obs[0].value).toBe(REMARK);
  });

  test('Save with the provider cleared shows Required and saves nothing', async ({ page, api, createEntryContext }) => {
    const { context } = await open(page, createEntryContext);
    await remark(page).fill(REMARK);
    await page.locator('#who select').first().selectOption({ index: 0 }); // "Choose a Provider"
    await page.locator(SAVE).click();
    await expect(page.locator('#who span.field-error', { hasText: /required/i })).toBeVisible();
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toHaveLength(0);
  });

  test('VIEW (visit page) shows the saved remark and not the provider / location / date block or the buttons', async ({ page, api, createEntryContext }) => {
    const { context, form } = await open(page, createEntryContext);
    await remark(page).fill(REMARK);
    await page.locator(SAVE).click();
    await form.expectSaved();
    const encounterUuid = await savedEncounters(api, context.patient.uuid);

    const view = await expectViewShowsSavedObs(page, api, FORM, encounterUuid);
    expect(await view.valueTexts()).toContain(REMARK);
    await expect(view.root.locator('#who-when-where, #buttons')).toHaveCount(0); // ifMode VIEW include=false
  });

  test('EDIT starts from the saved remark and a changed remark replaces it', async ({ page, api, createEntryContext }) => {
    const { context, form } = await open(page, createEntryContext);
    await remark(page).fill(REMARK);
    await page.locator(SAVE).click();
    await form.expectSaved();
    const encounterUuid = await savedEncounters(api, context.patient.uuid);

    await page.goto(SectionFormPage.editUrl(FORM, { patient: context.patient, encounter: { uuid: encounterUuid, visitUuid: context.visitUuid } }));
    await expect(remark(page)).toHaveValue(REMARK);
    await remark(page).fill('Changed remark');
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);
    await expect.poll(async () => (await getEncounterObs(api, encounterUuid)).map((o) => o.value)).toEqual(['Changed remark']);
  });

  test('V1 Save with no remark creates an empty Comment encounter (nothing requires the remark)', async ({ page, api, createEntryContext }) => {
    // Nothing requires the remark (obs without required="true"): an empty "Comment" encounter is saved (the visit page lists it as no data).
    const { context, form } = await open(page, createEntryContext);
    await page.locator(SAVE).click();
    await form.expectSaved();
    const encounterUuid = await savedEncounters(api, context.patient.uuid);
    expect(await getEncounterObs(api, encounterUuid)).toHaveLength(0);
  });
});
