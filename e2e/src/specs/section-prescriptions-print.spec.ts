import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { SectionFormPage, VISIT_PAGE_URL, VisitPage, addMedication } from '../pages';
import { specFacts } from '../spec-facts';
import type { SectionEncounter, SiteSettings } from '../contract';

// section-prescriptions-print.xml (pihemr, v1.0): "Prescriptions": a PRINT template, not an entry form. It is the `printTemplateUrl` of the `pihcore-plan` section
// (encounterTypeConfig.js, template printPrescriptionsWithHtmlFormLong.page): the printer icon in the header of the expanded plan section calls visit.js
// `printPrescriptions()`, which GETs
//   /openmrs/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId=<uuid>&definitionUiResource=file:configuration/pih/htmlforms/section-prescriptions-print.xml
// that URL from the visit page (it answers an error without the Angular request headers) and read the HTML. VIEW only: nothing is entered here.
//
// What differs per site is in `site.specs['section-prescriptions-print']`: the parent encounter type that has the `pihcore-plan` section, two drugs that exist in
// the site's formulary, and the label of a medication the section-plan form lists. A prescription is recorded over REST as the obs group, which is what older plan
// forms (section-plan_v1.0.xml) saved. The visit-page gating is not exercised (_availability.e2e.md).
//
// Findings: see pihemr _findings.e2e.md#section-prescriptions-print
//   V1 Medium    the current plan form (section-plan v2.0) saves a medication as a drug order, not as the "Prescription construct" obs group that the print template and
//                the print icon look for: the icon is never offered and the print template returns only the heading and the signature line (TESTED below with test.fixme).
//                Printing works only for encounters saved by the retired plan form (v1.0), which the tests recreate over REST.
// Not covered here: the browser print dialog itself (printDiv opens an iframe and calls print()), the other parents with the same section config, the other languages
//   of the labels.

const FORM = 'section-prescriptions-print.xml';
const SAVE = '#buttons input.submitButton';
const patient = { givenName: 'AutoPrint', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(30) };

const concept = async (api: APIRequestContext, mapping: string): Promise<string> => {
  const res = await api.get(`concept/${encodeURIComponent(mapping)}?v=custom:(uuid)`);
  expect(res.ok(), `get concept ${mapping}: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};

interface Prescription {
  drugQuery: string;
  dose: number;
  doseUnit: string; // concept mapping
  frequency: string;
  duration: number;
  durationUnit: string;
  instructions: string;
}
const FIRST = (site: SiteSettings): Prescription => ({
  drugQuery: specFacts(site, 'section-prescriptions-print').drugs[0],
  dose: 250,
  doseUnit: 'CIEL:161553',
  frequency: 'PIH:BID',
  duration: 10,
  durationUnit: 'PIH:Days',
  instructions: 'Take with food',
});
const SECOND = (site: SiteSettings): Prescription => ({
  drugQuery: specFacts(site, 'section-prescriptions-print').drugs[1],
  dose: 500,
  doseUnit: 'CIEL:161553',
  frequency: 'PIH:TID',
  duration: 7,
  durationUnit: 'PIH:Days',
  instructions: 'After meals',
});
const parentOf = (site: SiteSettings) => specFacts(site, 'section-prescriptions-print').parent.encounterTypeUuid;

// Records one prescription the way the retired plan form did: an obs group "Prescription construct" on the encounter.
const addPrescription = async (api: APIRequestContext, s: SectionEncounter, p: Prescription) => {
  const drugs = await api.get(`drug?q=${p.drugQuery}&v=custom:(uuid,display)&limit=1`);
  expect(drugs.ok(), `get drug ${p.drugQuery}: ${drugs.status()}`).toBeTruthy();
  const drug = (await drugs.json()).results[0];
  expect(drug, `a drug named ${p.drugQuery} exists`).toBeTruthy();
  const when = new Date(Date.now() - 60_000).toISOString();
  const member = async (mapping: string, value: unknown) => ({ person: s.patient.uuid, concept: await concept(api, mapping), obsDatetime: when, value });
  const res = await api.post('obs', {
    data: {
      person: s.patient.uuid,
      concept: await concept(api, 'PIH:Prescription construct'),
      encounter: s.encounter.uuid,
      obsDatetime: when,
      groupMembers: [
        await member('PIH:MEDICATION ORDERS', drug.uuid),
        await member('CIEL:160856', p.dose),
        await member('PIH:Dosing units coded', await concept(api, p.doseUnit)),
        await member('PIH:Drug frequency for HUM', await concept(api, p.frequency)),
        await member('CIEL:159368', p.duration),
        await member('PIH:TIME UNITS', await concept(api, p.durationUnit)),
        await member('PIH:Prescription instructions non-coded', p.instructions),
      ],
    },
  });
  expect(res.ok(), `create the prescription obs group: ${res.status()}`).toBeTruthy();
  return drug.display as string;
};

// What the print button asks for: the same request as the VIEW of a section (Angular's $http sends the Accept header the controller needs).
const printHtml = async (page: Page, s: SectionEncounter): Promise<string> => {
  await VisitPage.open(page, s.encounter.visitUuid);
  const url = `/openmrs/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId=${s.encounter.uuid}&definitionUiResource=file:configuration/pih/htmlforms/${FORM}`;
  const body = await page.evaluate(async (u) => {
    const r = await fetch(u, { headers: { Accept: 'application/json, text/plain, */*' } });
    return { status: r.status, text: await r.text() };
  }, url);
  expect(body.status, 'getAsHtml status').toBe(200);
  const json = JSON.parse(body.text) as { html?: string; message?: string };
  expect(json.html, `the print template renders (${json.message ?? ''})`).toBeTruthy();
  return json.html!;
};
// Puts the printable HTML into a blank page so that it can be queried like the DOM.
const show = async (page: Page, html: string) => {
  await page.goto('about:blank');
  await page.setContent(`<body>${html}</body>`);
};

test.describe('section-prescriptions-print template', () => {
  test('prints the medication, dose, frequency, duration and instructions of a prescription, then the signature line', async ({ page, api, site, createSectionEncounter }) => {
    test.slow();
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    const drug = await addPrescription(api, s, FIRST(site));
    await show(page, await printHtml(page, s));
    const print = page.locator('#prescriptionsDiv');
    await expect(print.locator('legend')).toHaveText('Medication orders');
    await expect(print.locator('h3')).toHaveText([/Medication\s+1/]);
    await expect(print.locator('#name1')).toHaveText(drug);
    await expect(print.locator('#dose1 .value')).toHaveText('250');
    await expect(print.locator('#doseUnit1 .value')).toHaveText(/mg/);
    await expect(print.locator('#frequencyCoded1 .value')).toHaveText('BID');
    await expect(print.locator('#duration1 .value')).toHaveText('10');
    await expect(print.locator('#durationUnit1 .value')).toHaveText('Days');
    await expect(print.locator('#instructions1 .value')).toHaveText('Take with food');
    await expect(print).toContainText('Signature:');
    // labels of the fields
    for (const label of ['Medication Name', 'Dose', 'Frequency', 'Duration', 'Administration Instructions']) {
      await expect(print.locator('label', { hasText: label }).first()).toBeVisible();
    }
  });

  test('prints each prescription in its own numbered block and nothing for the empty slots', async ({ page, api, site, createSectionEncounter }) => {
    test.slow();
    // repeat of 8 obsgroups with showIfEmpty="false"
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    await addPrescription(api, s, FIRST(site));
    await addPrescription(api, s, SECOND(site));
    await show(page, await printHtml(page, s));
    const print = page.locator('#prescriptionsDiv');
    await expect(print.locator('h3')).toHaveText([/Medication\s+1/, /Medication\s+2/]);
    const names = await print.locator('.medication-name').allTextContents();
    expect(names.sort()).toEqual(
      specFacts(site, 'section-prescriptions-print')
        .drugs.map((d) => d.toLowerCase())
        .sort()
        .map((d) => expect.stringMatching(new RegExp(d, 'i'))),
    );
    await expect(print.locator('#name3')).toHaveCount(0);
    await expect(print.locator('.value', { hasText: 'Take with food' })).toHaveCount(1);
    await expect(print.locator('.value', { hasText: 'After meals' })).toHaveCount(1);
  });

  test('an encounter without prescriptions prints the heading and the signature line only', async ({ page, site, createSectionEncounter }) => {
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    await show(page, await printHtml(page, s));
    const print = page.locator('#prescriptionsDiv');
    await expect(print.locator('legend')).toHaveText('Medication orders');
    await expect(print.locator('h3, .value, .medication-name')).toHaveCount(0);
    await expect(print).toContainText('Signature:');
  });
});

test.describe('section-prescriptions-print on the visit page', () => {
  test('the plan section of an encounter with a prescription offers the print icon, which loads the prescription into the print area', async ({ page, api, site, createSectionEncounter }) => {
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    const drug = await addPrescription(api, s, FIRST(site));
    const visit = await VisitPage.open(page, s.encounter.visitUuid);
    // the print icon is in the header of the EXPANDED plan section (defaultPlanSectionActions.gsp); the header loses its id when expanded, so look page-wide
    await visit.expand(visit.section('pihcore-plan'));
    const icon = page.locator('a.delete-encounter:has(i.icon-print):visible');
    await expect(icon).toHaveCount(1);
    await icon.click();
    // printPrescriptions() fetches the print template, binds it and prints #prescriptionsDiv in an iframe
    await expect(page.locator('#prescriptionsDiv')).toContainText(drug);
    await expect(page.locator('#prescriptionsDiv')).toContainText('Signature:');
  });

  test('without a prescription the plan section has no print icon', async ({ page, site, createSectionEncounter }) => {
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    const visit = await VisitPage.open(page, s.encounter.visitUuid);
    await visit.expand(visit.section('pihcore-plan'));
    await expect(page.locator('a.delete-encounter:has(i.icon-print):visible')).toHaveCount(0);
  });

  test.fixme('V1: a medication saved by the current plan form (a drug order) is offered for printing and printed', async ({ page, site, createSectionEncounter }) => {
    // remove test.fixme() when fixed. section-plan.xml v2.0 saves the medication as a drug order; no "Prescription construct" obs is written, so the print icon is hidden and the
    // print template prints an empty "Medication orders" block .
    test.slow();
    const s = await createSectionEncounter({ encounterTypeUuid: parentOf(site), patient });
    await page.goto(SectionFormPage.editUrl('section-plan.xml', s));
    await expect(page.locator(SAVE)).toBeVisible();
    await addMedication(page, specFacts(site, 'section-prescriptions-print').planFormMedication);
    await page.locator(SAVE).click();
    await expect(page).toHaveURL(VISIT_PAGE_URL);

    await show(page, await printHtml(page, s));
    await expect(page.locator('#prescriptionsDiv')).toContainText(specFacts(site, 'section-prescriptions-print').planFormMedication.split(',')[0]);

    const visit = await VisitPage.open(page, s.encounter.visitUuid);
    await visit.expand(visit.section('pihcore-plan'));
    await expect(page.locator('a.delete-encounter:has(i.icon-print):visible')).toHaveCount(1);
  });
});
