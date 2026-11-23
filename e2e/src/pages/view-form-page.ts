import { type APIRequestContext, type Locator, type Page, expect } from '@playwright/test';
import { VisitPage } from './visit-page';

// VIEW mode of a form, as users see it: on the visit page. The visit page fetches the encounter and the form from
// viewEncounterWithHtmlForm/getAsHtml.action (the `templateModelUrl` of the entry in encounterTypeConfig.js) when the entry
// is expanded, and binds the returned HTML into its long view, where every saved value is a span.value and every unanswered
// or unselected one a span.emptyValue. So this opens the real visit page of the encounter's visit, finds the entry whose
// templateModelUrl names the form and expands it (VisitPage.expandFormView), and everything the test asserts is read from
// that page: the form's own scripts run in the page that normally hosts them (the BMI of the vitals forms is computed by
// them), the page loads the scripts the visit page loads, and `failOnJsError` fails the test on an error thrown by the
// inserted HTML.
//
// The visit page does NOT load htmlFormEntry.js or htmlForm.js, so `getField`, `getValue`, `htmlForm` and `beforeSubmit` are
// undefined there: a form script that uses them in VIEW throws on the visit page (HAI-1278), and the test fails with the
// uncaught error: a finding, not something to work around.
//
// A form whose entry has no templateModelUrl (or one that names another form) is not shown as a VIEW: open() throws and says so.
// Test what the visit page shows for it with VisitPage instead (skill: "Visit-page display").
export class ViewFormPage {
  // `root` is the long view of the entry that shows the form: the visit page around it is not part of the VIEW.
  constructor(
    readonly page: Page,
    readonly root: Locator,
  ) {}

  static async open(page: Page, formFile: string, encounterUuid: string): Promise<ViewFormPage> {
    const res = await page.request.get(`/openmrs/ws/rest/v1/encounter/${encounterUuid}?v=custom:(visit:(uuid))`);
    expect(res.ok(), `get encounter ${encounterUuid}: ${res.status()}`).toBeTruthy();
    const visitUuid = (await res.json()).visit?.uuid as string | undefined;
    expect(visitUuid, `encounter ${encounterUuid} is in a visit (the visit page lists encounters by visit)`).toBeTruthy();
    const visitPage = await VisitPage.open(page, visitUuid!);
    return new ViewFormPage(page, await visitPage.expandFormView(encounterUuid, formFile));
  }

  // Every saved value shown by the form.
  // vital-signs-widget.js takes the "value" class off the vitals it colour-codes (.vitals-values), so they are matched by
  // their parent.
  get values() {
    return this.root.locator('span.value, .vitals-values > span:not(.emptyValue, .units, .append-to-value)');
  }

  // The saved value of the obs whose span has this id (HFE puts the id on the span around the value). The units next to
  // it and the placeholder of an unanswered obs are not matched, and neither is the "value" class, which
  // vital-signs-widget.js takes off.
  valueOf(id: string) {
    return this.root.locator(`#${id} > span:not(.emptyValue, .units, .append-to-value)`);
  }

  // The text of every saved value, whitespace collapsed ("[X] yes" for a selected radio or checkbox).
  async valueTexts(): Promise<string[]> {
    return (await this.values.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }
}

interface ViewObs {
  display: string;
  concept: { display: string };
  value: unknown;
}

// A date or datetime as the REST API returns it ("2025-03-10" or "2025-03-10T09:30:00.000+0000").
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

// The diagnosis widget (encounterDiagnosesByObs) prints diagnoses as plain text, not in a span.value, so these obs
// (the diagnosis, its order and certainty, the Visit Diagnoses construct) are not looked for. Assert the printed text itself.
const NOT_IN_A_VALUE = /^(Diagnosis|Visit Diagnoses)\b/;

// Answers nearly every form labels the same way.
const DEFAULT_LABELS: Record<string, string> = { 'Disposition categories: Discharged': 'Discharge' };

// A short expected text ("2", "No", "F") is a substring of far too much, so it must be a whole value (a selected
// radio or checkbox shows as "[X] <label>", a number may carry decimals: "3" is shown as "3.0"); a longer one only has
// to appear in some value. An empty label means "do not look for this obs", and "[X]" any selected answer.
const isShown = (shown: string[], expected: string): boolean => {
  const want = expected.toLowerCase();
  if (want === '') {
    return true;
  }
  if (want.length > 3) {
    return shown.some((t) => t.toLowerCase().includes(want));
  }
  return shown.some((t) => {
    const text = t.toLowerCase();
    const bare = text.replace(/^\[x\]\s*/, '');
    return text === want || bare === want || (want === '[x]' && text.startsWith('[x]')) || (/^-?\d+(\.\d+)?$/.test(want) && Number(bare) === Number(want));
  });
};

// The saved obs the VIEW does not show. Text and number values must appear in a span.value as they were
// saved; a coded answer must appear by its concept name, ignoring case (a form that labels the answer differently with
// answerCodes / answerLabels is listed in `labels`: obs display -> text shown). Dates, datetimes, groups and the
// diagnosis obs are not compared (their rendering is the form's choice): assert them with a targeted locator.
export const viewMismatches = async (
  api: APIRequestContext,
  view: ViewFormPage,
  encounterUuid: string,
  givenLabels: Record<string, string> = {},
  limit = 200,
): Promise<string[]> => {
  const labels = { ...DEFAULT_LABELS, ...givenLabels };
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display,concept:(display),value)&limit=${limit}`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  const obs = (await res.json()).results as ViewObs[];
  const shown = await view.valueTexts();
  const missing: string[] = [];
  for (const o of obs) {
    if (NOT_IN_A_VALUE.test(o.display) && labels[o.display] === undefined) {
      continue;
    }
    let expected: string | undefined;
    if (labels[o.display] !== undefined) {
      expected = labels[o.display];
    } else if (typeof o.value === 'number') {
      expected = String(o.value);
    } else if (typeof o.value === 'string' && !ISO_DATE.test(o.value)) {
      expected = o.value;
    } else if (o.value && typeof o.value === 'object' && 'display' in o.value) {
      expected = String((o.value as { display: string }).display);
    }
    if (expected !== undefined && !isShown(shown, expected)) {
      missing.push(`${o.display} (looked for "${expected}")`);
    }
  }
  return missing;
};

// Opens the VIEW of the saved encounter and checks it shows what was saved.
export const expectViewShowsSavedObs = async (
  page: Page,
  api: APIRequestContext,
  formFile: string,
  encounterUuid: string,
  labels: Record<string, string> = {},
  limit = 200,
): Promise<ViewFormPage> => {
  const view = await ViewFormPage.open(page, formFile, encounterUuid);
  expect(await view.values.count(), 'the VIEW shows at least one saved value').toBeGreaterThan(0);
  expect(await viewMismatches(api, view, encounterUuid, labels, limit), 'saved obs missing from the VIEW').toEqual([]);
  return view;
};
