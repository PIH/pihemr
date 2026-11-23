import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type PihemrFixtures } from '../contract';
import { DRUG_ORDER_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { getPatientEncounters } from '../rest';
import { EntryFormPage, ViewFormPage, VISIT_PAGE_URL, visitPagePath } from '../pages';
import { addMedication } from '../pages/form-widgets';
import { getLocationName } from '../rest';
import { specFacts } from '../spec-facts';

// drugOrder.xml: "Order Medication": provider / location / date and one drug-order widget (drug-order-widget.xml: Add Medication, Revise, Renew,
// Discontinue). It has no obs: a save writes the encounter and its drug orders (voided with the encounter). Reached with a synthetic adult patient who
// has an active visit, through enterHtmlFormWithStandardUi (EntryFormPage); who offers it: the ORDER_DRUG_VISIT_ACTION visit action (every ZL profile,
// _availability.e2e.md); availability (privilege, Drug Order Location tag, retro rules) is not exercised. Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). The form uses the HFE <submit>
// tag: there is no #submit, the button is `#buttons input.submitButton`. The location select starts with the session location (Klinik Ekstèn carries
// the Drug Order Location tag).
//
// Conditions in the form, from documentation inventory (drugOrder.inv.md):
//   ifMode VIEW include=false :5-9, :12-14, :30-35   the stylesheet, the <h2> heading and the Save / Cancel buttons (absent in VIEW, asserted in the VIEW test)
//   the order widget (subform drug-order-widget.xml) is not conditional, but it renders differently per mode: ENTER a "New Orders" list with an "Add
//   Medication" button; EDIT the encounter's own orders with Edit / Delete buttons and, for an order of an earlier encounter, Revise / Renew /
//   Discontinue; VIEW a read-only history of the orders.
// Scripts: none in this file (the order widget's onLoadFunction `initializeOrderWidgetAndSetupDrugOrderQuantityCalculations` is shared code, see _shared).
// Side effects on save: one drug order per medication row (action NEW / REVISE / RENEW / DISCONTINUE, care setting Outpatient, urgency Routine). Editing
//   or deleting an order of the SAME encounter in EDIT voids the original order and (for Edit) creates a new one: the widget says "Editing or deleting
//   will remove the original medication order."
// Visit-page display: the visit page shows this form's VIEW (encounterTypeConfig.js, e0b41238: templateModelUrl without definitionUiResource, so it
//   renders the form the encounter was saved with; longTemplate viewEncounterWithHtmlFormLong.page): ViewFormPage. The form has no obs, so there is no
//   span.value: the VIEW tests read the order widget's own rows (`.order-view-current-encounter .order-<field>`).
// Not covered here: the quantity calculator ("Calculate Quantity"), free-text dosing, other care settings, an order whose drug has no formulation
//   units, provider/location/date behaviour (see _shared.e2e.md).
//
// Findings: see pihemr _findings.e2e.md#drugOrder

const FORM = 'drugOrder.xml';
const SAVE = '#buttons input.submitButton';
// A drug of the site's formulary (its fact), set before each test.
let DRUG = '';

const newPatient = (createEntryContext: PihemrFixtures['createEntryContext']) =>
  createEntryContext({ givenName: 'AutoDrugOrder', familyName: 'Tester', gender: 'F', birthdate: birthdateYearsAgo(30) });

const editUrl = (patientUuid: string, encounterUuid: string, visitUuid: string) =>
  `htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?${new URLSearchParams({
    patientId: patientUuid,
    encounterId: encounterUuid,
    definitionUiResource: `file:configuration/pih/htmlforms/${FORM}`,
    returnUrl: visitPagePath(visitUuid),
  })}`;

interface OrderRow {
  uuid: string;
  orderNumber: string;
  action: string;
  dose: number;
  duration: number;
  quantity: number;
  voided: boolean;
  dateStopped: string | null;
  drug: { display: string } | null;
  previousOrder: { orderNumber: string } | null;
  encounter: { uuid: string };
}

// The orders of the test patient (voided ones included), oldest first.
const getOrders = async (api: APIRequestContext, patientUuid: string): Promise<OrderRow[]> => {
  const res = await api.get(
    `order?patient=${patientUuid}&includeVoided=true&v=custom:(uuid,orderNumber,action,dose,duration,quantity,voided,dateStopped,drug:(display),previousOrder:(orderNumber),encounter:(uuid))`,
  );
  expect(res.ok(), `get orders: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as OrderRow[]).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
};

const saveAndWait = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};

// Opens the form, adds the drug, saves, and returns the context and the saved encounter.
const saveOneMedication = async (page: Page, api: APIRequestContext, createEntryContext: PihemrFixtures['createEntryContext']) => {
  const context = await newPatient(createEntryContext);
  await EntryFormPage.open(page, FORM, context);
  await addMedication(page, DRUG);
  await saveAndWait(page);
  const encounters = await getPatientEncounters(api, context.patient.uuid);
  expect(encounters.map((e) => e.encounterType.uuid)).toEqual([DRUG_ORDER_ENCOUNTER_TYPE_UUID]);
  return { context, encounter: encounters[0] };
};

// A row of the order widget's read-only history: the text of one field of the one order shown.
const field = (scope: ReturnType<Page['locator']>, name: string) => scope.locator(`.order-view-current-encounter .order-field-widget.order-${name}`);

test.describe('drugOrder', () => {
  test.beforeEach(({ site }) => {
    DRUG = specFacts(site, 'drugOrder').drug;
  });
  test('ENTER shows the heading, who/where/when, the order widget with Add Medication, and Save / Cancel', async ({ page, createEntryContext }) => {
    // ifMode VIEW include=false :12-14, :30-35 (present in ENTER)
    await EntryFormPage.open(page, FORM, await newPatient(createEntryContext));
    await expect(page.locator('h2')).toHaveText('Order Medication');
    await expect(page.locator('#who select')).toBeVisible();
    await expect(page.locator('#where select')).not.toHaveValue('');
    await expect(page.locator('#when input.hasDatepicker')).toHaveValue(/\d{2} \w{3} \d{4}/);
    await expect(page.locator('#drug-orders .orderwidget-new-order-section .orderwidget-section-no-orders')).toBeVisible();
    await expect(page.locator('#drug-orders #order-action-button-NEW')).toBeVisible();
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#buttons .cancel')).toBeVisible();
    await expect(page.locator('#submit')).toHaveCount(0);
  });

  test('the location is required: Save with it blank is refused with "Required" and saves nothing', async ({ site, page, api, createEntryContext }) => {
    // encounterLocation (tag Drug Order Location), required by HFE
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await addMedication(page, DRUG);
    await page.locator('#where select').selectOption('');
    await page.locator(SAVE).click();
    await expect(page.locator('#where .field-error')).toHaveText(/Required/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await getPatientEncounters(api, context.patient.uuid)).toEqual([]);
    expect(await getOrders(api, context.patient.uuid)).toEqual([]);
    // fixing it saves
    await page.locator('#where select').selectOption({ label: await getLocationName(api, site.sessionLocationUuid) });
    await saveAndWait(page);
    expect((await getOrders(api, context.patient.uuid)).map((o) => o.drug?.display)).toEqual([DRUG]);
  });

  test('"Cancel Changes" on a new medication row drops it: nothing is ordered', async ({ page, api, createEntryContext }) => {
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await addMedication(page, DRUG);
    await page.locator('.orderwidget-order-form:visible').getByText('Cancel Changes').click();
    await expect(page.locator('.orderwidget-order-form:visible')).toHaveCount(0);
    await saveAndWait(page);
    expect(await getOrders(api, context.patient.uuid)).toEqual([]);
  });

  test('Save with no medication still creates an empty Order Medication encounter (V1)', async ({ page, api, createEntryContext }) => {
    // no field is required except provider and location, so an empty order form saves; the visit page then lists "NO DATA ENTERED"
    const context = await newPatient(createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    await saveAndWait(page);
    expect((await getPatientEncounters(api, context.patient.uuid)).map((e) => e.encounterType.uuid)).toEqual([DRUG_ORDER_ENCOUNTER_TYPE_UUID]);
    expect(await getOrders(api, context.patient.uuid)).toEqual([]);
  });

  test('saves a medication as a drug order of the encounter; the visit page shows it in the form VIEW', async ({ page, api, createEntryContext }) => {
    const { context, encounter } = await saveOneMedication(page, api, createEntryContext);
    const orders = await getOrders(api, context.patient.uuid);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ action: 'NEW', dose: 250, duration: 10, quantity: 20, voided: false, previousOrder: null });
    expect(orders[0].drug?.display).toBe(DRUG);
    expect(orders[0].encounter.uuid).toBe(encounter.uuid);
    const full = await (await api.get(`order/${orders[0].uuid}?v=custom:(careSetting:(display),urgency,dosingType)`)).json();
    expect(full).toMatchObject({ careSetting: { display: 'Outpatient' }, urgency: 'ROUTINE', dosingType: 'org.openmrs.SimpleDosingInstructions' });

    // VIEW on the visit page: no span.value (the form has no obs); the order widget prints the order
    const view = await ViewFormPage.open(page, FORM, encounter.uuid);
    const widget = view.root.locator('#drug-orders');
    await expect(field(widget, 'drug')).toHaveText(DRUG);
    await expect(field(widget, 'dose')).toHaveText('250.0');
    await expect(field(widget, 'duration')).toHaveText('10');
    await expect(field(widget, 'durationUnits')).toHaveText('Days');
    await expect(field(widget, 'quantity')).toHaveText('20.0');
    await expect(field(widget, 'numRefills')).toHaveText('0');
    await expect(widget.locator('.orderwidget-new-order-section .order-view-current-encounter')).toHaveCount(1);
    await expect(widget.locator('.orderwidget-existing-order-section .orderwidget-section-no-orders')).toBeVisible();
    // ifMode VIEW include=false: no heading, no Save / Cancel, no Add / Edit / Delete buttons
    await expect(view.root.locator('h2, #buttons, input.submitButton, .order-action-button')).toHaveCount(0);
  });

  test('EDIT lists the encounter\'s order with Edit and Delete; Edit voids the original order and saves a new one', async ({ page, api, createEntryContext }) => {
    const { context, encounter } = await saveOneMedication(page, api, createEntryContext);
    await page.goto(editUrl(context.patient.uuid, encounter.uuid, context.visitUuid));
    const widget = page.locator('#drug-orders');
    await expect(widget.locator('.orderwidget-section-header').first()).toHaveText('Active Orders');
    await expect(field(widget, 'drug')).toHaveText(DRUG);
    await expect(widget.locator('#order-action-button-REVISE_0')).toHaveText('Edit');
    await expect(widget.locator('#order-action-button-DISCONTINUE_0')).toHaveText('Delete');

    await widget.locator('#order-action-button-REVISE_0').click();
    await expect(widget.getByText('Editing or deleting will remove the original medication order.')).toBeVisible();
    const form = page.locator('.orderwidget-order-form:visible');
    await expect(form.locator('.order-dose input')).toHaveValue('250.0');
    await form.locator('.order-dose input').fill('500');
    await saveAndWait(page);

    const orders = await getOrders(api, context.patient.uuid);
    expect(orders.map((o) => ({ action: o.action, dose: o.dose, voided: o.voided }))).toEqual([
      { action: 'NEW', dose: 250, voided: true },
      { action: 'NEW', dose: 500, voided: false },
    ]);
    // the visit page shows only the new order
    const view = await ViewFormPage.open(page, FORM, encounter.uuid);
    await expect(field(view.root.locator('#drug-orders'), 'dose')).toHaveText('500.0');
  });

  test('EDIT Delete voids the encounter\'s order', async ({ page, api, createEntryContext }) => {
    const { context, encounter } = await saveOneMedication(page, api, createEntryContext);
    await page.goto(editUrl(context.patient.uuid, encounter.uuid, context.visitUuid));
    await page.locator('#order-action-button-DISCONTINUE_0').click();
    await saveAndWait(page);
    expect((await getOrders(api, context.patient.uuid)).map((o) => o.voided)).toEqual([true]);
  });

  test('a second form in the visit offers Revise / Renew / Discontinue for the active order, and Discontinue stops it', async ({ page, api, createEntryContext }) => {
    // the order widget's action buttons for an order of an EARLIER encounter
    const { context, encounter } = await saveOneMedication(page, api, createEntryContext);
    await EntryFormPage.open(page, FORM, context);
    const widget = page.locator('#drug-orders');
    await expect(widget.locator('.orderwidget-section-header').first()).toHaveText('Active Orders');
    for (const action of ['REVISE', 'RENEW', 'DISCONTINUE']) {
      await expect(widget.locator(`#order-action-button-${action}_0`), `${action} button`).toBeVisible();
    }
    await widget.locator('#order-action-button-DISCONTINUE_0').click();
    await page.locator('.orderwidget-order-form:visible .order-discontinueReason select').selectOption({ index: 1 });
    await saveAndWait(page);

    const orders = await getOrders(api, context.patient.uuid);
    expect(orders).toHaveLength(2);
    const [first, second] = orders;
    expect(first).toMatchObject({ action: 'NEW', voided: false });
    expect(first.dateStopped).not.toBeNull();
    expect(second).toMatchObject({ action: 'DISCONTINUE', voided: false });
    expect(second.previousOrder?.orderNumber).toBe(first.orderNumber);
    expect(second.encounter.uuid).not.toBe(encounter.uuid);
  });
});
