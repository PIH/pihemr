import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { NCD_INITIAL_ENCOUNTER_TYPE_UUID, OBGYN_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, VisitPage } from '../pages';

// section-dx-obgyn.xml (pihemr, v1.0): "Diagnostic with obgyn": coded diagnoses (encounterDiagnosesByObs, allowNonCoded=false), a non-coded
// diagnosis checkbox + text, free-text comments and, for a female OB/GYN encounter, a grey summary of the patient's most recent OB/GYN
// intake (LMP, EDD, gravida/para/abortus/living). On the visit page it is the `pihcore-diagnosis-obgyn` section of the OB/GYN encounter;
// the specs create the parent encounter over REST and open the section's edit URL directly (skips the gating of _availability.e2e.md).
// Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-dx-obgyn.inv.md):
//   ifMode VIEW include=false  :5, :17, :150, :274   style, heading + script, the OB/GYN summary block, the #buttons row: ENTER/EDIT only
//   toggle PIH:20580 checkbox  :133  shows #nonCodedDiagnosis (the "if non-coded, specify" textarea)
//   includeIf encounterType == OB/GYN (d83e98fd) :151 and patient.gender == 'F' :152   render #obgyn-div (the summary block)
//   includeIf encounterType != delivery (00e5ebb2) :276   renders #next; for a delivery encounter only Save and Cancel exist
// Scripts: :20-125 on load, GET ws/rest/v1/encounter?s=byObs&encounterType=OB/GYN&obsConcept=CIEL:164181&obsValues=CIEL:164180 (type of visit =
//   intake), order=desc; for each result dated not after this encounter it writes the date into #lastObGynEncounterDate/Time and fills LMP
//   (#obgyn_initial_lastPeriodDate, plus calculated gestational age and EDD), EDD (#obgyn_initial_edd), gravida, para, abortus, living
//   (#obgyn_initial_{gravida,para,abortus,living}Input) from the obs. :125 setUpNextAndSubmitButtons() (see _shared.e2e.md).
//   The inventory's "$encounterDate not in <macros>" lead is a false positive: the lookup's complexExpression (:49) does the #set.
// Side effects on save: none from the form itself (no postSubmissionAction).
// Visit-page display: the visit page does NOT show this form's VIEW. Tested on zl-ci, whose encounterTypeConfig.js has an ACTIVE
//   templateModelUrl for section-dx-obgyn.xml (ViewFormPage.open finds the entry and the HTML is fetched), but the section's longTemplate
//   `dxLong.page` renders the encounter's obs itself (rows Diagnoses, Non-Coded Diagnoses, Clinical Note) and shows no `.value` of the form
//   (0 spans). So the VIEW tests below assert those rows (VisitPage), like section-dx, and the form's own VIEW (ifMode VIEW :5-:274) is not tested.
// Findings: see pihemr _findings.e2e.md#section-dx-obgyn
//   V1 Medium :20-125 the script loops over ALL qualifying prior intakes (newest first) and overwrites the summary each time, so the label
//          "most recent OB/GYN intake" shows the OLDEST one (TESTED below with test.fixme). Fix: break after the first match.
//   V2 Info encounterTypeConfig.js `pihcore-diagnosis-obgyn`: active templateModelUrl, but dxLong.page renders the obs itself, so the form's VIEW is never shown (see Visit-page display).
// Not covered here: #next (needs the visit page / entry form); the delivery arm of :276 is opened under a delivery-type encounter by direct
//   URL only (delivery does not list this section on the visit page).

const FORM = 'section-dx-obgyn.xml';
const DELIVERY_ENCOUNTER_TYPE_UUID = '00e5ebb2-90ec-11e8-9eb6-529269fb1459';
// CIEL concept uuids are the CIEL id padded with 'A' to 36 characters.
const ciel = (id: string) => id.padEnd(36, 'A');
const TYPE_OF_VISIT = ciel('164181');
const INTAKE_VISIT = ciel('164180');

const female = { givenName: 'AutoDxObgyn', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(30) };

// Visit-page display (dxLong.page): one row per heading, the saved values in its right column.
const dxRow = (long: Locator, heading: string) => long.locator(`div:has(> .left-column > h3:text-is("${heading}")) > .right-column`);
const openLong = async (page: Page, section: SectionEncounter) => {
  const visit = await VisitPage.open(page, section.encounter.visitUuid);
  return visit.expand(visit.section('pihcore-diagnosis-obgyn'));
};
const save = async (page: Page) => {
  await new SectionFormPage(page, FORM).save();
  await new SectionFormPage(page, FORM).expectSaved();
};
const obsDisplays = async (api: APIRequestContext, encounterUuid: string) => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display)&limit=100`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as Array<{ display: string }>).map((o) => o.display);
};
// A prior OB/GYN intake encounter (type of visit = intake) with its gravida, in the same visit. The visit is moved back first so that the
// prior encounter can be dated before the test encounter.
const conceptUuid = async (api: APIRequestContext, mapping: string): Promise<string> => {
  const res = await api.get(`concept/${mapping}?v=custom:(uuid)`);
  expect(res.ok(), `get concept ${mapping}: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};
const addPriorIntake = async (api: APIRequestContext, section: SectionEncounter, daysAgo: number, gravida: number, lmp: string, locationUuid: string) => {
  const visit = await api.post(`visit/${section.encounter.visitUuid}`, { data: { startDatetime: new Date(Date.now() - 10 * 86_400_000).toISOString() } });
  expect(visit.ok(), `move visit start: ${visit.status()}`).toBeTruthy();
  const res = await api.post('encounter', {
    data: {
      patient: section.patient.uuid,
      encounterType: OBGYN_ENCOUNTER_TYPE_UUID,
      location: locationUuid,
      encounterDatetime: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      visit: section.encounter.visitUuid,
      obs: [
        { concept: TYPE_OF_VISIT, value: INTAKE_VISIT },
        { concept: await conceptUuid(api, 'CIEL:1427'), value: lmp },
        { concept: await conceptUuid(api, 'CIEL:5624'), value: gravida },
      ],
    },
  });
  expect(res.ok(), `create prior intake: ${res.status()} ${res.ok() ? "" : (await res.text()).slice(0, 400)}`).toBeTruthy();
};

test.describe('section-dx-obgyn under OB/GYN, female patient', () => {
  let section: SectionEncounter;

  test.beforeEach(async ({ page, createSectionEncounter }) => {
    section = await createSectionEncounter({ encounterTypeUuid: OBGYN_ENCOUNTER_TYPE_UUID, patient: female });
    await SectionFormPage.openEdit(page, FORM, section);
  });

  test('the non-coded diagnosis text shows only while its checkbox is ticked', async ({ page }) => {
    // toggle :133
    const text = page.locator('#nonCodedDiagnosis');
    await expect(text).toBeHidden();
    await page.locator('#w4').check();
    await expect(text).toBeVisible();
    await page.locator('#w4').uncheck();
    await expect(text).toBeHidden();
  });

  test('Next, Save and Cancel are offered for an OB/GYN encounter, and the OB/GYN summary is shown, empty without a prior intake', async ({ page }) => {
    // includeIf :276 (not delivery), :151 + :152 (OB/GYN encounter, female)
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
    const summary = page.locator('#obgyn-div');
    await expect(summary).toBeVisible();
    await expect(summary.locator('legend, .title').first()).toContainText('OB/GYN');
    for (const id of ['gravida', 'para', 'abortus', 'living']) {
      await expect(page.locator(`#obgyn_initial_${id}Input`)).toHaveText('____');
      await expect(page.locator(`#obgyn_initial_${id}Input`)).toHaveClass(/emptyValue/);
    }
    await expect(page.locator('#lastObGynEncounterDate')).toHaveText('');
  });

  test('saves a coded diagnosis, a non-coded diagnosis and the comment; EDIT and the visit page show them', async ({ page, api }) => {
    await page.locator('#diagnosis-search').fill('Asthma');
    await page.locator('ul.ui-autocomplete li', { hasText: 'J45.9 Asthma' }).first().click();
    await expect(page.locator('#encounter-diagnoses-target')).toContainText(/J45\.9[\s\S]*Asthma/);
    await page.locator('#w4').check();
    await page.locator('#w6').fill('Pelvic pain');
    await page.locator('#w8').fill('Seen for pelvic pain');
    await save(page);

    const displays = await obsDisplays(api, section.encounter.uuid);
    expect(displays.some((d) => d.includes('Pelvic pain')), displays.join(' | ')).toBeTruthy();
    expect(displays.some((d) => d.includes('Seen for pelvic pain'))).toBeTruthy();
    expect(displays.some((d) => d.includes('Asthma'))).toBeTruthy();

    // EDIT starts from the saved values: toggle :133 shows the text again
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#w4')).toBeChecked();
    await expect(page.locator('#nonCodedDiagnosis')).toBeVisible();
    await expect(page.locator('#w6')).toHaveValue('Pelvic pain');
    await expect(page.locator('#w8')).toHaveValue('Seen for pelvic pain');
    await expect(page.locator('#encounter-diagnoses-target')).toContainText(/J45\.9[\s\S]*Asthma/);

    // visit page: dxLong.page (see the Visit-page display header line)
    await page.goto('about:blank'); // the visit page does not load when it is the page's own previous URL
    const long = await openLong(page, section);
    await expect(dxRow(long, 'Diagnoses').locator('p.diagnosis')).toHaveCount(1);
    await expect(dxRow(long, 'Diagnoses')).toContainText('Asthma');
    await expect(dxRow(long, 'Non-Coded Diagnoses')).toHaveText('Pelvic pain');
    await expect(dxRow(long, 'Clinical Note')).toHaveText('Seen for pelvic pain');
  });

  test('a non-coded diagnosis text typed and then hidden by unticking the checkbox is not saved; the visit page shows only the comment', async ({ page, api }) => {
    // toggle :133 only hides #nonCodedDiagnosis; HFE does not submit a hidden obs
    await page.locator('#w4').check();
    await page.locator('#w6').fill('Typed then hidden');
    await page.locator('#w4').uncheck();
    await page.locator('#w8').fill('Only a comment');
    await save(page);
    expect((await obsDisplays(api, section.encounter.uuid)).some((d) => d.includes('Typed then hidden'))).toBeFalsy();

    await page.goto('about:blank');
    const long = await openLong(page, section);
    await expect(dxRow(long, 'Clinical Note')).toHaveText('Only a comment');
    await expect(dxRow(long, 'Non-Coded Diagnoses')).toHaveText('');
    await expect(dxRow(long, 'Diagnoses').locator('p.diagnosis')).toHaveCount(0);
  });

  test('the summary shows the gravida, LMP and visit date of the prior OB/GYN intake', async ({ site, page, api }) => {
    // script :20-125 (REST byObs search; the prior encounter is dated before this one)
    await addPriorIntake(api, section, 3, 2, '2026-09-15', site.sessionLocationUuid);
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#obgyn_initial_gravidaInput')).toHaveText('2');
    await expect(page.locator('#obgyn_initial_gravidaInput')).toHaveClass(/\bvalue\b/);
    await expect(page.locator('#obgyn_initial_paraInput')).toHaveText('____'); // not saved on the prior encounter
    await expect(page.locator('#obgyn_initial_lastPeriodDate')).toHaveText(/^1[4-6] \w{3} 2026$/); // 15 Sep, +-1 day for the browser timezone
    await expect(page.locator('#lastObGynEncounterDate')).not.toHaveText('');
  });

  test.fixme('V1: with two prior intakes the summary shows the most recent one', async ({ site, page, api }) => {
    // remove test.fixme() when fixed. script :20-125: the REST results are newest first and the loop keeps overwriting, so the oldest qualifying intake wins
    // (checked on zl-ci: with intakes of gravida 1 (5 days ago) and 3 (2 days ago) the summary shows 1)
    await addPriorIntake(api, section, 5, 1, '2026-08-01', site.sessionLocationUuid);
    await addPriorIntake(api, section, 2, 3, '2026-09-15', site.sessionLocationUuid);
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#obgyn_initial_gravidaInput')).toHaveText('3');
  });
});

test.describe('section-dx-obgyn summary block, other fixtures', () => {
  test('a male patient with an OB/GYN encounter gets no OB/GYN summary', async ({ page, createSectionEncounter }) => {
    // includeIf :152
    const section = await createSectionEncounter({ encounterTypeUuid: OBGYN_ENCOUNTER_TYPE_UUID, patient: { ...female, gender: 'M' } });
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#obgyn-div')).toHaveCount(0);
    await expect(page.locator('#next')).toBeVisible();
  });

  test('another encounter type (NCD initial) gets no OB/GYN summary', async ({ page, createSectionEncounter }) => {
    // includeIf :151
    const section = await createSectionEncounter({ encounterTypeUuid: NCD_INITIAL_ENCOUNTER_TYPE_UUID, patient: female });
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#obgyn-div')).toHaveCount(0);
  });

  test('Next is not offered for a delivery encounter', async ({ page, createSectionEncounter }) => {
    // includeIf :276, state "delivery encounter" (opened by direct URL: delivery does not list this section)
    const section = await createSectionEncounter({ encounterTypeUuid: DELIVERY_ENCOUNTER_TYPE_UUID, patient: female });
    await SectionFormPage.openEdit(page, FORM, section);
    await expect(page.locator('#next')).toHaveCount(0);
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
  });
});
