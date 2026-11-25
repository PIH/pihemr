import { type APIRequestContext, type Locator, type Page, expect } from '@playwright/test';

// Helpers for the widgets that several section forms share (date pickers, the order widget) and for reading a test
// encounter's obs. Exported by pages/index.ts too.

// Sets a HFE date widget (a readonly jQuery UI datepicker input followed by a hidden input) to `isoDate` (yyyy-mm-dd).
export const pickDate = async (input: Locator, isoDate: string): Promise<void> => {
  await input.evaluate((el, iso) => {
    const j = (window as unknown as { jq: (e: unknown) => { datepicker: (...a: unknown[]) => void; trigger: (n: string) => void } }).jq;
    j(el).datepicker('setDate', new Date(`${iso}T12:00:00`));
    j(el).trigger('change');
  }, isoDate);
  await input.locator('xpath=following-sibling::input[@type="hidden"]').evaluate((el) => {
    (window as unknown as { jq: (e: unknown) => { trigger: (n: string) => void } }).jq(el).trigger('change');
  });
};

// yyyy-mm-dd of today + n days (local date).
export const isoDate = (n: number): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + n)).toISOString().slice(0, 10);
};

// "7 Sep 2026": how a VIEW prints a date.
export const viewDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
};

// "07 Sep 2026": how the date picker input (dd M yy) shows a date.
export const pickerDate = (iso: string): string => viewDate(iso).replace(/^(\d) /, '0$1 ');

// Lower-cased `display` of every obs of the (synthetic) encounter.
export const obsDisplays = async (api: APIRequestContext, encounterUuid: string): Promise<string[]> => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display)&limit=300`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as Array<{ display: string }>).map((o) => o.display.toLowerCase());
};

// Each expected text is a substring of some obs display (case-insensitive).
export const expectObs = (displays: string[], ...expected: string[]): void => {
  for (const e of expected) {
    expect(displays.some((d) => d.includes(e.toLowerCase())), `obs "${e}" among ${displays.join(' | ')}`).toBeTruthy();
  }
};

// Adds one medication order the way the order widget is used: Add Medication, pick the drug (autocomplete), dose, frequency, duration,
// quantity. `scope` is the section that holds the widget (`#drug-orders`).
export const addMedication = async (page: Page, drugLabel: string, scope = '#drug-orders'): Promise<void> => {
  await page.locator(`${scope} #order-action-button-NEW`).click();
  const order = page.locator('.orderwidget-order-form:visible');
  await order.locator('.order-drug input.orderwidget-autocomplete-textbox').pressSequentially(drugLabel.split(',')[0], { delay: 60 });
  await page.locator('ul.ui-autocomplete:visible li', { hasText: drugLabel }).first().click();
  await order.locator('.order-dose input').fill('250');
  await order.locator('.order-doseUnits select').selectOption({ index: 1 });
  await order.locator('.order-frequency select').selectOption({ index: 1 });
  await order.locator('.order-duration input').fill('10');
  await order.locator('.order-durationUnits select').selectOption({ index: 1 });
  await order.locator('.order-quantity input').fill('20');
  await order.locator('.order-quantityUnits select').selectOption({ index: 1 });
};

// The encounter-diagnosis widget (`encounterDiagnosesByObs`, search box #diagnosis-search): types `search`, picks the first suggestion and waits for it to be listed.
// Returns the suggestion's text.
export const pickEncounterDiagnosis = async (page: Page, search = 'mal'): Promise<string> => {
  await page.locator('#diagnosis-search').fill(search);
  const item = page.locator('ul.ui-autocomplete:visible li').first();
  await expect(item).toBeVisible();
  const text = (await item.innerText()).trim();
  await item.click();
  await expect(page.locator('.diagnosis')).toHaveCount(1);
  return text;
};

// The program enrolments of a test patient: program name, completion date.
export const programEnrollments = async (api: APIRequestContext, patientUuid: string): Promise<Array<{ uuid: string; program: { name: string }; dateCompleted: string | null }>> => {
  const res = await api.get(`programenrollment?patient=${patientUuid}&v=custom:(uuid,program:(name),dateCompleted)`);
  expect(res.ok(), `get enrollments: ${res.status()}`).toBeTruthy();
  return (await res.json()).results;
};
