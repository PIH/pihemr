import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { getEncounterObs } from '../rest';
import { specFacts } from '../spec-facts';
import type { PihemrFixtures, SectionEncounter, SiteSettings } from '../contract';

// section-review-of-systems.xml (pihemr): heading + Next/Save/Cancel around subforms/review-of-systems.xml: nine collapsible blocks of checkbox symptoms, each on
// its own "*exam findings" question concept, plus an "Other ... (comment)" checkbox with a comment input per block. On the visit page it is the
// `pihcore-review-of-systems` section of some encounter types of each site (`site.specs['section-review-of-systems'].parent`); the tests create a parent
// encounter over REST and open the section's edit URL directly (that skips the visit-page gating of the site's _availability.e2e.md).
// Written for Liberia, which had its own copy of the form (its Family Medicine Intake and Followup); pihemr has the form since commit b7c51652 (LSO-243/279, Lesotho MDR-TB).
//
// Conditions, from the inventory (section-review-of-systems.inv.md):
//   ifMode VIEW include=false  :3, :23           heading + script, and the #buttons row in ENTER/EDIT only
//   includeIf patient.gender == 'F'  (subform :189)   shows the "Gynecologic" block (female vs male patient, tested)
//   ifMode VIEW (subform :5-24)  VIEW forces .collapsible-content open (max-height none)
// Scripts: :9 setUpNextAndSubmitButtons(); mch.js (global): click on `.toggle-div` toggles `.open` on the next `.collapsible-content`; in EDIT a block with a
//   ticked box is opened at load (V6).
// Side effects on save: none. Required fields: none.
// VIEW (the visit page, which fetches getAsHtml.action for this section): ticked symptoms are `[X] <label>` values, unticked ones are not values, the button
//   row is absent.
// Not covered here: #next (needs the visit page), the comment input in VIEW (rendering unknown).
//
// Findings: see pihemr _findings.e2e.md#section-review-of-systems.xml (V1 the heading rendered twice; V2 Focal weakness = "Weakness"; V3 women-only Perineal pain,
//   "Genital ulcers"; V4 raw-English message codes and typos; V5 ROS answers share the exam-findings questions; V6 blocks start closed).

const FORM = 'section-review-of-systems.xml';

// The parent encounter of the section at this site (its facts).
const parentOf = (site: SiteSettings) => specFacts(site, 'section-review-of-systems').parent;

const BLOCKS = [
  'Cardiovascular',
  'Constitutional',
  'Endocrine',
  'Gastrointestinal',
  'Genitourinary',
  'Gynecologic',
  'Musculoskeletal',
  'Neurologic',
  'Respiratory',
];

// A block is a `.section-container` with a `.toggle-div` header and a `.collapsible-content` (subform).
const block = (page: Page, title: string) =>
  page.locator('.review-of-systems-subform .section-container').filter({ has: page.locator('.toggle-div', { hasText: title }) });

// Opens a block (they start closed, V6) and returns it. A click only toggles, so do it only when closed.
const openBlock = async (page: Page, title: string) => {
  const b = block(page, title);
  await expect(b).toHaveCount(1);
  const content = b.locator('.collapsible-content');
  if (!(await content.evaluate((el) => el.classList.contains('open')))) {
    await b.locator('.toggle-div').click();
  }
  await expect(content).toHaveClass(/open/);
  return b;
};

// The checkbox labels are the answerCode / answerLabel texts (raw English, V4); several appear in two blocks.
const box = (b: ReturnType<typeof block>, label: string) => b.getByLabel(label, { exact: true });

const saveForm = async (page: Page) => {
  const form = new SectionFormPage(page, FORM);
  await form.save();
  await form.expectSaved();
};

// Obs of the encounter with their comment (the "Other ... (comment)" boxes keep the typed text there).
const obsWithComment = async (api: APIRequestContext, encounterUuid: string) => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display,comment)&limit=200`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).results as Array<{ display: string; comment: string | null }>;
};

test.describe('section-review-of-systems', () => {
  let section: SectionEncounter;

  test.beforeEach(async ({ page, site, createSectionEncounter }) => {
    section = await createSectionEncounter({
      encounterTypeUuid: parentOf(site).encounterTypeUuid,
      patient: { givenName: 'AutoRos', familyName: 'Tester', gender: 'F' },
    });
    await SectionFormPage.openEdit(page, FORM, section);
  });

  test('a female patient gets nine blocks, all closed', async ({ page }) => {
    // includeIf subform :189 (female) + mch.js: blocks without a saved symptom start closed (V6)
    await expect(page.locator('.review-of-systems-subform .section-container')).toHaveCount(9);
    for (const title of BLOCKS) {
      await expect(block(page, title)).toHaveCount(1);
      await expect(block(page, title).locator('.collapsible-content')).not.toHaveClass(/open/);
    }
  });

  test('a male patient gets eight blocks, without Gynecologic', async ({ page, site, createSectionEncounter }) => {
    // includeIf subform :189 (male)
    const male = await createSectionEncounter({
      encounterTypeUuid: parentOf(site).encounterTypeUuid,
      patient: { givenName: 'AutoRos', familyName: 'Tester', gender: 'M' },
    });
    await SectionFormPage.openEdit(page, FORM, male);
    await expect(page.locator('.review-of-systems-subform .section-container')).toHaveCount(8);
    await expect(block(page, 'Gynecologic')).toHaveCount(0);
    await expect(block(page, 'Genitourinary')).toHaveCount(1);
  });

  test('clicking a block header opens it and clicking again closes it', async ({ page }) => {
    // mch.js click handler on .toggle-div
    const content = block(page, 'Endocrine').locator('.collapsible-content');
    await block(page, 'Endocrine').locator('.toggle-div').click();
    await expect(content).toHaveClass(/open/);
    await block(page, 'Endocrine').locator('.toggle-div').click();
    await expect(content).not.toHaveClass(/open/);
  });

  test('saves a blank form and records nothing', async ({ page, api }) => {
    await saveForm(page);
    expect(await getEncounterObs(api, section.encounter.uuid)).toEqual([]);
  });

  test('the same answer in two blocks is a separate question: Weight loss and Syncope', async ({ page, api }) => {
    // Weight loss is in Constitutional (:76) and Endocrine (:105); Syncope in Cardiovascular (:48) and Neurologic (:271)
    const constitutional = await openBlock(page, 'Constitutional');
    const endocrine = await openBlock(page, 'Endocrine');
    await box(constitutional, 'Weight loss').check();
    await expect(box(endocrine, 'Weight loss')).not.toBeChecked();
    const neurologic = await openBlock(page, 'Neurologic');
    const cardiovascular = await openBlock(page, 'Cardiovascular');
    await box(neurologic, 'Syncope').check();
    await expect(box(cardiovascular, 'Syncope')).not.toBeChecked();
    await saveForm(page);

    const displays = (await getEncounterObs(api, section.encounter.uuid)).map((o) => o.display);
    expect(displays.filter((d) => /^General exam findings: Weight loss/i.test(d))).toHaveLength(1);
    expect(displays.filter((d) => /^Endocrine exam findings:/i.test(d))).toHaveLength(0);
    expect(displays.filter((d) => /^Neurologic exam findings: Syncope/i.test(d))).toHaveLength(1);
    expect(displays.filter((d) => /^Cardiac exam findings:/i.test(d))).toHaveLength(0);
  });

  test('saves symptoms and an "Other" comment, and EDIT shows them again with their blocks open', async ({ page, api }) => {
    await box(await openBlock(page, 'Cardiovascular'), 'Chest pain').check();
    await box(await openBlock(page, 'Constitutional'), 'Fever').check();
    const respiratory = await openBlock(page, 'Respiratory');
    await box(respiratory, 'Cough').check();
    await box(respiratory, 'Other respiratory (comment)').check();
    await respiratory.locator('input[type=text]').fill('Night wheeze');
    await box(await openBlock(page, 'Musculoskeletal'), 'Joint pain').check();
    await box(await openBlock(page, 'Neurologic'), 'Headache').check();
    await saveForm(page);

    const obs = await obsWithComment(api, section.encounter.uuid);
    const displays = obs.map((o) => o.display.toLowerCase());
    for (const symptom of ['chest pain', 'fever', 'cough', 'joint pain', 'headache']) {
      expect(displays.some((d) => d.includes(symptom)), symptom).toBeTruthy();
    }
    expect(obs.some((o) => /respiratory/i.test(o.display) && o.comment === 'Night wheeze')).toBeTruthy();

    // mch.js: in EDIT a block with a ticked box is open at load, one without stays closed
    await SectionFormPage.openEdit(page, FORM, section);
    for (const title of ['Cardiovascular', 'Constitutional', 'Respiratory', 'Musculoskeletal', 'Neurologic']) {
      await expect(block(page, title).locator('.collapsible-content')).toHaveClass(/open/);
    }
    await expect(block(page, 'Endocrine').locator('.collapsible-content')).not.toHaveClass(/open/);
    await expect(box(block(page, 'Cardiovascular'), 'Chest pain')).toBeChecked();
    await expect(box(block(page, 'Cardiovascular'), 'Syncope')).not.toBeChecked();
    await expect(box(block(page, 'Respiratory'), 'Other respiratory (comment)')).toBeChecked();
    await expect(block(page, 'Respiratory').locator('input[type=text]')).toHaveValue('Night wheeze');

    // VIEW: the "Other" answer is labelled by answerLabel, not by its concept name (obs display -> text shown)
    const labels: Record<string, string> = {};
    for (const o of obs) {
      if (/Review of systems, respiratory \(comment\)/i.test(o.display)) {
        labels[o.display] = '[X] Other respiratory (comment)';
      }
    }
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, labels);
    expect(await view.valueTexts()).toEqual(
      expect.arrayContaining(['[X] Chest pain', '[X] Fever', '[X] Cough', '[X] Joint pain', '[X] Headache']),
    );
    await expect(block(view.page, 'Cardiovascular').locator('.value')).toHaveText(['[X] Chest pain']);
    await expect(block(view.page, 'Endocrine').locator('.value')).toHaveCount(0);
    await expect(block(view.page, 'Gynecologic').locator('.value')).toHaveCount(0);
    // ifMode VIEW (subform :5-24): every block is forced open
    await expect(block(view.page, 'Endocrine').locator('.collapsible-content')).toHaveCSS('max-height', 'none');
    // ifMode VIEW include=false (:3, :23): no heading and no buttons
    await expect(view.root.locator('#buttons, #submit, #next, #cancel')).toHaveCount(0);
    await expect(view.root.locator('h3', { hasText: 'Review of Systems' })).toHaveCount(0);
  });

  test('VIEW: a form with nothing saved shows no value', async ({ page }) => {
    await saveForm(page);
    const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
    await expect(view.values).toHaveCount(0);
    await expect(view.root.locator('.review-of-systems-subform .section-container')).toHaveCount(9);
  });
});
