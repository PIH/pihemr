import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { getEncounterObs, getPatientEncounters } from '../rest';
import { EntryFormPage, SectionFormPage, VISIT_PAGE_URL, VisitPage } from '../pages';
import { getLocationName } from '../rest';

// vaccination-only.xml: "Vaccination", a form with no fields of its own. Opened in ENTER it only creates the Vaccination encounter (who / when /
// where) and submits itself on load; the doses are then recorded on the visit page, in the vaccination table of the encounter's entry, which
// is where users work with this encounter. So the specs open the same enterHtmlFormWithStandardUi URL directly inside a visit they create
// (EntryFormPage; availability, _availability.e2e.md: `vaccination`, Vaccination Location, `Task: emr.enterVax`, not exercised) and then test the
// visit page. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (vaccination-only.inv.md):
//   ifMode ENTER :22   script: when the encounter location widget has a value (it defaults to the session location) the form is submitted at once
//                      (`submitHtmlForm()`) and never shown; with no location it shows the form and hides `#next`. Not covered: the session
//                      location of the harness is always set, so the "form shown" branch cannot be reached (and the form has no Save button).
//   ifMode EDIT :35    script: shows `.htmlform` and calls setUpNextAndSubmitButtons() (nextAndSubmitButtons.js, _shared.e2e.md)
//   ifMode EDIT :8     style for `#disposition` (an id the form does not have)
//   ifMode VIEW include=false :46-70  heading and the who / when / where block (see Visit-page display)
// Side effects on save: none (no obs, no program). Encounter type Vaccination (1e2a509c); the provider is the current user with the encounter role
//   4f10ad1a, the location the session's, the date today (default="now").
// Visit-page display: the visit page does NOT show this form's VIEW. The Vaccination entry of encounterTypeConfig.js (1e2a509c) has no
//   templateModelUrl and no editUrl: `defaultState: "long"`, `longTemplate: templates/vaccination/chVaccinations.page`, i.e. the `vaccination-table`
//   directive (pihcore vaccinations.js): a header "Vaccinations" with "No data entered" or the doses recorded in this encounter ("BCG-Dose 0"), and a
//   table of 15 vaccines x 6 doses. A "+" in a valid cell opens a dialog ("during the current consult" or on a given date) that saves a
//   PATIENT VACCINATION HISTORY group (vaccination, sequence, date) on THIS encounter through the encounter transaction; an "x" deletes it. The
//   form's own VIEW is empty anyway (everything is inside ifMode VIEW include=false), so it is not tested; the specs test this table instead.
// Not covered here: the "not during this visit" branch of the dialog (a date picked in the popup), the other 14 vaccines (same code, a different
//   dose list), `canEdit` / `canDelete` for another user, the "form shown" branch of the ENTER script (see above).
//
// Findings: see pihemr _findings.e2e.md#vaccination-only

const FORM = 'vaccination-only.xml';
const VACCINATION_ENCOUNTER_TYPE_UUID = '1e2a509c-7c9f-11e9-8f9e-2a86e4085a59';
const VACCINATION_ENCOUNTER_ROLE_UUID = '4f10ad1a-ec49-48df-98c7-1391c6ac7f05';

const SEQUENCES = ['Dose 0', 'Dose 1', 'Dose 2', 'Dose 3', 'Booster 1', 'Booster 2'];
const VACCINES = [
  'BCG', 'COVID-19', 'DT', 'TT', 'Hepatitis B', 'Influenza', 'Meningococcal', 'Pentavalent', 'Pneumococcal',
  'Polio (OPV)', 'Polio (IPV)', 'Rotavirus', 'Measles/Rubella', 'Yellow fever', 'IPTi-SP',
];

// Creates the Vaccination encounter the way the visit action does: the form opens, fills its defaults and submits itself.
const createEncounter = async (page: Page, api: APIRequestContext, context: Parameters<typeof EntryFormPage.open>[2]) => {
  await EntryFormPage.open(page, FORM, context);
  await expect(page).toHaveURL(VISIT_PAGE_URL);
  const encounters = await getPatientEncounters(api, context.patient.uuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([VACCINATION_ENCOUNTER_TYPE_UUID]);
  return encounters[0].uuid;
};

const entry = (visit: VisitPage) => visit.encounterOfType(VACCINATION_ENCOUNTER_TYPE_UUID);
const table = (scope: Locator) => scope.locator('table.vaccination-table');
const row = (scope: Locator, vaccine: string) => table(scope).locator('tbody tr').filter({ has: scope.page().locator('th', { hasText: new RegExp(`^\\s*${vaccine.replace(/[()/]/g, '\\$&')}\\s*$`) }) });
// The cell of a vaccine row for a dose column (0 = Dose 0).
const cell = (scope: Locator, vaccine: string, sequence: number) => row(scope, vaccine).locator('td').nth(sequence);

// The vaccination history groups of the encounter: vaccination, sequence and date of each.
const doses = async (api: APIRequestContext, encounterUuid: string) => {
  const res = await api.get(`encounter/${encounterUuid}?v=custom:(obs:(display,concept:(display),groupMembers:(concept:(display),value:(display))))`);
  expect(res.ok(), `get encounter: ${res.status()}`).toBeTruthy();
  const obs = (await res.json()).obs as Array<{ groupMembers: Array<{ concept: { display: string }; value: unknown }> | null }>;
  return obs
    .filter((o) => o.groupMembers && o.groupMembers.length > 0)
    .map((o) => o.groupMembers!.map((m) => `${m.concept.display}=${typeof m.value === 'object' ? (m.value as { display: string }).display : m.value}`));
};

test.describe('vaccination-only', () => {
  test('ENTER creates the Vaccination encounter by itself: no form is shown, no obs, the current user and the session location', async ({ site, page, api, createEntryContext }) => {
    // when :22 (ENTER): location has a value -> submitHtmlForm()
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    const encounterUuid = await createEncounter(page, api, context);
    expect(await getEncounterObs(api, encounterUuid)).toEqual([]);
    const res = await api.get(`encounter/${encounterUuid}?v=custom:(location:(uuid),encounterDatetime,encounterProviders:(encounterRole:(uuid)))`);
    const encounter = await res.json();
    expect(encounter.location.uuid).toBe(site.sessionLocationUuid);
    expect(encounter.encounterProviders.map((p: { encounterRole: { uuid: string } }) => p.encounterRole.uuid)).toEqual([VACCINATION_ENCOUNTER_ROLE_UUID]);
    // encounterDate default="now" (the date, not later than the server's clock)
    expect(new Date(encounter.encounterDatetime).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  test('visit page: the entry says "No data entered" and shows the 15 x 6 dose table, with "+" only in the cells that are valid doses', async ({ page, api, createEntryContext }) => {
    // longTemplate chVaccinations.page (see Visit-page display); doses lists of vaccinations.js
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    await createEncounter(page, api, context);
    const visit = await VisitPage.open(page, context.visitUuid);
    const e = entry(visit);
    await expect(e.locator('.vaccinations-section .encounter-name')).toContainText('Vaccinations');
    await expect(e.locator('.vaccinations-section .no-data-text')).toBeVisible();
    await expect(table(e)).toBeVisible();
    expect((await table(e).locator('thead th').allTextContents()).map((t) => t.trim())).toEqual(['Vaccinations', ...SEQUENCES]);
    expect((await table(e).locator('tbody th').allTextContents()).map((t) => t.trim())).toEqual(VACCINES);
    // BCG: dose 0 only; yellow fever: dose 1 only; COVID-19: doses 1-3
    await expect(row(e, 'BCG').locator('.edit-action:visible')).toHaveCount(1);
    await expect(cell(e, 'BCG', 0).locator('.edit-action:visible')).toHaveCount(1);
    await expect(cell(e, 'BCG', 1)).toHaveClass(/impossible/);
    await expect(row(e, 'Yellow fever').locator('.edit-action:visible')).toHaveCount(1);
    await expect(cell(e, 'COVID-19', 0)).toHaveClass(/impossible/);
    await expect(row(e, 'COVID-19').locator('.edit-action:visible')).toHaveCount(3);
    await expect(table(e).locator('a.delete-action:visible')).toHaveCount(0);
  });

  test('visit page: a dose recorded "during the current consult" is saved on this encounter, shown in its header and cell, and can be deleted', async ({ page, api, createEntryContext }) => {
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    const encounterUuid = await createEncounter(page, api, context);
    const visit = await VisitPage.open(page, context.visitUuid);
    const e = entry(visit);

    await cell(e, 'BCG', 0).locator('.edit-action').click();
    const dialog = page.locator('.ngdialog:visible');
    await expect(dialog.locator('h4')).toContainText('BCG');
    await expect(dialog.locator('h4')).toContainText('Dose 0');
    // an encounter exists, so "during the current consult" is offered and preselected
    await expect(dialog.locator('input[type=radio][value=encounter]')).toBeChecked();
    await dialog.locator('button.vaccination-confirm').click();
    await expect(dialog).toBeHidden();

    // the encounter transaction saved one group: vaccination, sequence 0, date (encounter date)
    await expect.poll(async () => (await doses(api, encounterUuid)).length).toBe(1);
    const [group] = await doses(api, encounterUuid);
    expect(group.join(' | ').toLowerCase()).toContain('bcg');
    expect(group.some((g) => /sequence.*=0(\.0)?$/i.test(g)), `sequence 0 in ${group.join(' | ')}`).toBeTruthy();
    expect(group.some((g) => /date.*=\d{4}/i.test(g)), `date in ${group.join(' | ')}`).toBeTruthy();

    // the entry shows it: header text, and the cell holds the date in bold (a dose of this encounter) with a delete link
    await expect(e.locator('.vaccinations-section .obs-span')).toContainText('BCG');
    await expect(e.locator('.vaccinations-section .no-data-text')).toBeHidden();
    await expect(cell(e, 'BCG', 0).locator('span.bold')).toContainText(String(new Date().getFullYear()));
    await expect(cell(e, 'BCG', 0).locator('.edit-action:visible')).toHaveCount(0);
    await expect(cell(e, 'BCG', 0).locator('a.delete-action:visible')).toHaveCount(1);
    await expect(row(e, 'COVID-19').locator('span.bold')).toHaveCount(0); // nothing else recorded

    // delete: confirm dialog names the vaccination, the dose and the date; Delete voids the group
    await cell(e, 'BCG', 0).locator('a.delete-action').click();
    const confirm = page.locator('.ngdialog:visible');
    await expect(confirm.locator('.dialog-content')).toContainText('BCG');
    await confirm.locator('button.vaccination-confirm').click();
    await expect.poll(async () => (await doses(api, encounterUuid)).length).toBe(0);
    await expect(e.locator('.vaccinations-section .no-data-text')).toBeVisible();
    await expect(cell(e, 'BCG', 0).locator('.edit-action:visible')).toHaveCount(1);
  });

  test('visit page: doses of one vaccine are recorded per sequence (COVID-19 doses 1 and 2) and the header lists the latest', async ({ page, api, createEntryContext }) => {
    test.slow(); // two dialogs, each reloads the vaccination history (about 25 s)
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    const encounterUuid = await createEncounter(page, api, context);
    const visit = await VisitPage.open(page, context.visitUuid);
    const e = entry(visit);
    for (const sequence of [1, 2]) {
      await cell(e, 'COVID-19', sequence).locator('.edit-action').click();
      await page.locator('.ngdialog:visible button.vaccination-confirm').click();
      await expect(row(e, 'COVID-19').locator('span.bold')).toHaveCount(sequence);
    }
    await expect.poll(async () => (await doses(api, encounterUuid)).length).toBe(2);
    // getCurrentVaccinations: one item per vaccine, its most recent sequence
    await expect(e.locator('.vaccinations-section .obs-span')).toContainText('COVID-19');
    await expect(e.locator('.vaccinations-section .obs-span')).toContainText('Dose 2');
    await expect(e.locator('.vaccinations-section .obs-span')).not.toContainText('Dose 1');
  });

  test('EDIT (no edit link on the visit page): the form opens with the heading and the who / where / when block, and has no Save button', async ({ site, page, api, createEntryContext }) => {
    // when :35 (EDIT) shows .htmlform; ifMode VIEW include=false :46-70 (present in EDIT). The widgets are in a display:none div and nothing
    // submits the form: see the finding in _findings.e2e.md#vaccination-only.
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    const encounterUuid = await createEncounter(page, api, context);
    await page.goto(
      SectionFormPage.editUrl(FORM, { patient: context.patient, encounter: { uuid: encounterUuid, visitUuid: context.visitUuid } }),
    );
    await expect(page.locator('.htmlform')).toBeVisible();
    await expect(page.locator('.htmlform h2')).toHaveText('Vaccination');
    const block = page.locator('#who-where-when-view');
    await expect(block).toBeVisible();
    await expect(block.locator('label')).toHaveCount(3);
    await expect(block.locator('td').nth(1).locator('span')).toHaveText(await getLocationName(api, site.sessionLocationUuid));
    await expect(block.locator('td').nth(2).locator('span')).toContainText(String(new Date().getFullYear()));
    await expect(page.locator('#submit, #buttons .submitButton, input.submitButton')).toHaveCount(0);
  });

  // when :46-70, :58 (V2). Intended: the provider who created the encounter is shown. Remove test.fixme() when fixed.
  test.fixme('V2 EDIT: the who / where / when block shows the provider of the encounter', async ({ page, api, createEntryContext }) => {
    const context = await createEntryContext({ givenName: 'AutoVacc', familyName: 'Tester' });
    const encounterUuid = await createEncounter(page, api, context);
    await page.goto(
      SectionFormPage.editUrl(FORM, { patient: context.patient, encounter: { uuid: encounterUuid, visitUuid: context.visitUuid } }),
    );
    await expect(page.locator('#who-where-when-view td').nth(0).locator('span')).toHaveText(/\S/);
  });
});
