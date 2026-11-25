import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { DELIVERY_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, VISIT_PAGE_URL, expectViewShowsSavedObs } from '../pages';
import { expectObs, isoDate, obsDisplays, pickDate } from '../pages/form-widgets';


// section-c-section.xml (pihemr, v1.0): "C-section": the surgical note of a caesarean: surgery team (encounterProviderAndRole widgets), procedure, scheduled or
// emergency, anesthesia, wound class, sutures, lacerations, fluids in and out, pathology / laboratory specimens, complications, wound status and comments. On the
// visit page it is the `pihcore-c-section` section of the MCH Delivery encounter (00e5ebb2); the specs create the parent encounter over REST (female patient) and
// open the section's edit URL directly (skips the gating of _availability.e2e.md). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere).
//
// Conditions in the form, from documentation inventory (section-c-section.inv.md):
//   when PIH:20703 (suture material) = Other       :331   shows #otherSMaterial (text)
//   when PIH:20712 (laceration location) = Perineum :379  shows #perineal-grade (radios 1, 2, 3, 3a, 3b, 3c, 4)   (checkbox #lace-loc-14)
//   when PIH:Transfusion status = Yes              :429   shows #transfusionDetails (4 blood products + units)
//   when PIH:Pre-operative antibiotic = Yes        :483   shows #antibioticDetails (antibiotic name)
//   when PIH:Pathology sample sent = Yes           :540   shows #pathDetails;  when PIH:Laboratory specimen sent = Yes :560 shows #labSpecDetails
//   ifMode VIEW include=false :168 heading h2 "C-section", :620 #buttons (Next, Save, Cancel); absent in VIEW
//   required: the attending surgeon (encounterProviderAndRole encounterRole 9b135b19 "Attending Surgeon", providerRoles Surgeon and Physician, required="true" :183)
// Scripts: :153-166 textareas of #post-op-surgical-note grow with their content (that id does not exist in this form: V3) and setUpNextAndSubmitButtons()
//   (see _shared.e2e.md).
// Side effects on save: none (no postSubmissionAction: see V2 for the diagnosis constructs of the adhesions).
// Visit-page display: `pihcore-c-section` has an active templateModelUrl and longTemplate viewSectionWithHtmlFormLong.page, so the visit page shows the form's VIEW
//   (checked on zl-ci): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-c-section
//   V1 High   :251 (and section-delivery.xml:420-426) the "Procedure performed" radio (CIEL:1651) and the delivery section's procedure checkboxes edit the same concept on the
//             same encounter: HFE gives the radio the first existing CIEL:1651 obs, so saving a caesarean REPLACES "Suture of female perineum" that the delivery section saved
//             (the episiotomy stays). Data of the delivery is lost without a message. (TESTED below with test.fixme.) Fix: give the c-section procedures their own concept or
//             answers, or one form for both
//   V2 Low    :269-275 the adhesion diagnoses are saved as "Visit Diagnoses" groups but the form has no CleanDiagnosisConstructAction (section-delivery has): the groups carry no
//             "Diagnosis order" (TESTED below). The visit page shows them; whether reports that read the order skip them is unverified. Fix: add the postSubmissionAction
//   V3 Low    :157,:162 the script resizes textareas of `#post-op-surgical-note`, an id the form does not have: dead code, the textareas do not grow
// Not covered here: choosing a surgeon, an assistant, an anesthesiologist or a nurse through the provider autocompletes (the suggestions are limited to the providers
//   of the roles Surgeon / Physician / Resident / Anaesthetist / Nurse (RN): employee data of the shared server, and the harness user holds none of those roles). The
//   attending surgeon is given to the encounter over REST (the harness user's own provider, encounter role 9b135b19) and the form loads it from there; the form
//   accepts it although the user has none of the listed provider roles, so `providerRoles` only filters the suggestions. The "other procedure(s)" autocompletes
//   (concept class Procedure) and #next.

const FORM = 'section-c-section.xml';
const DELIVERY_FORM = 'section-delivery.xml';
const SAVE = '#submit';
const ATTENDING_SURGEON_ENCOUNTER_ROLE_UUID = '9b135b19-7ebe-4a51-aea2-69a53f9383af';

const esc = (l: string) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactLabel = (label: string) => new RegExp(`^\\s*${esc(label)}\\s*$`);
const choose = async (scope: Locator, label: string) => {
  await scope.locator('label', { hasText: exactLabel(label) }).first().click();
};
const tick = async (page: Page, label: string, scope = 'form#htmlform') => {
  await page.locator(`${scope} label`, { hasText: exactLabel(label) }).first().click();
};
const checked = (scope: Locator) => scope.locator('input:checked + label');
// The <p> that holds the question with this label.
const q = (page: Page, text: string): Locator =>
  page
    .locator('p')
    .filter({ has: page.locator('label', { hasText: text }) })
    .first();

const female = { givenName: 'AutoCSection', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(28) };

// The harness user's own provider as Attending Surgeon of the encounter (the form is not usable without one: see the header).
const addAttendingSurgeon = async (api: APIRequestContext, encounterUuid: string) => {
  const session = await (await api.get('session')).json();
  const providers = await api.get(`provider?user=${session.user.uuid}&v=custom:(uuid)`);
  expect(providers.ok(), `get provider of the API user: ${providers.status()}`).toBeTruthy();
  const provider = (await providers.json()).results[0]?.uuid;
  expect(provider, 'the API user has a provider').toBeTruthy();
  const res = await api.post(`encounter/${encounterUuid}/encounterprovider`, { data: { provider, encounterRole: ATTENDING_SURGEON_ENCOUNTER_ROLE_UUID } });
  expect(res.ok(), `add the attending surgeon: ${res.status()}`).toBeTruthy();
};
const open = async (page: Page, section: SectionEncounter) => {
  await page.goto(SectionFormPage.editUrl(FORM, section));
  await expect(page.locator(SAVE)).toBeVisible();
  await page.waitForLoadState('networkidle');
};
const save = async (page: Page) => {
  await page.locator(SAVE).click();
  await expect(page).toHaveURL(VISIT_PAGE_URL);
};

test.describe('section-c-section layout, conditions and the required surgeon', () => {
  let section: SectionEncounter;
  test.beforeEach(async ({ page, createSectionEncounter }) => {
    section = await createSectionEncounter({ encounterTypeUuid: DELIVERY_ENCOUNTER_TYPE_UUID, patient: female });
    await open(page, section);
  });

  test('ENTER/EDIT shows the heading, the sections, Next, Save and Cancel', async ({ page }) => {
    // ifMode VIEW include=false :168, :620
    await expect(page.locator('form#htmlform h2')).toHaveText('C-section');
    for (const id of ['service-team', 'description', 'ins-outs', 'pathology', 'plan']) {
      await expect(page.locator(`#${id}`), `section ${id}`).toBeVisible();
    }
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
  });

  test('the attending surgeon is required: saving without one shows the error and stays on the form', async ({ page, api }) => {
    // encounterProviderAndRole required="true" :183
    await page.locator('#additional-comments textarea').fill('No surgeon given');
    await page.locator(SAVE).click();
    await expect(page.locator('#w1 ~ .field-error')).toBeVisible();
    await expect(page.locator('#w1 ~ .field-error')).toHaveText(/required/i);
    await expect(page).not.toHaveURL(VISIT_PAGE_URL);
    expect(await obsDisplays(api, section.encounter.uuid)).toEqual([]);
  });

  test('each Yes / Other / Perineum answer shows its own detail block', async ({ page }) => {
    // when :331, :379, :429, :483, :540, :560
    const cases: Array<{ trigger: Locator; label: string; target: string }> = [
      { trigger: page.locator('#sMaterial'), label: 'Other', target: '#otherSMaterial' },
      { trigger: page.locator('#transfusionQ'), label: 'Yes', target: '#transfusionDetails' },
      { trigger: page.locator('#antibioticsQ'), label: 'Yes', target: '#antibioticDetails' },
      { trigger: page.locator('#pathSentQ'), label: 'Yes', target: '#pathDetails' },
      { trigger: page.locator('#labSpecQ'), label: 'Yes', target: '#labSpecDetails' },
    ];
    for (const c of cases) {
      await expect(page.locator(c.target), `${c.target} starts hidden`).toBeHidden();
      await choose(c.trigger, c.label);
      await expect(page.locator(c.target), `${c.target} after "${c.label}"`).toBeVisible();
    }
    // answering something else hides them again
    await choose(page.locator('#sMaterial'), 'Silk');
    await expect(page.locator('#otherSMaterial')).toBeHidden();
    for (const id of ['#transfusionQ', '#antibioticsQ', '#pathSentQ', '#labSpecQ']) {
      await choose(page.locator(id), 'No');
    }
    for (const target of ['#transfusionDetails', '#antibioticDetails', '#pathDetails', '#labSpecDetails']) {
      await expect(page.locator(target)).toBeHidden();
    }

    // the perineal grade follows the Perineum checkbox among the laceration locations
    const grade = page.locator('#perineal-grade');
    await expect(grade).toBeHidden();
    await page.locator('#lace-loc-14 input[type=checkbox]').check();
    await expect(grade).toBeVisible();
    await expect(grade).toContainText('3a');
    await page.locator('#lace-loc-13 input[type=checkbox]').check(); // Vagina: does not matter
    await expect(grade).toBeVisible();
    await page.locator('#lace-loc-14 input[type=checkbox]').uncheck();
    await expect(grade).toBeHidden();
  });
});

test.describe('section-c-section saves', () => {
  let section: SectionEncounter;
  test.beforeEach(async ({ page, api, createSectionEncounter }) => {
    section = await createSectionEncounter({ encounterTypeUuid: DELIVERY_ENCOUNTER_TYPE_UUID, patient: female });
    await addAttendingSurgeon(api, section.encounter.uuid);
    await open(page, section);
  });

  test('saves a caesarean note; EDIT starts from it and VIEW shows it', async ({ page, api }) => {
    test.slow();
    await expect(page.locator('#w1')).not.toHaveValue(''); // the attending surgeon given to the encounter is loaded
    await expect(page.locator('#w1_hid')).not.toHaveValue('');
    await tick(page, 'Caesarean section with tubal ligation', '#description');
    await tick(page, 'Adhesion of urinary bladder');
    await choose(q(page, 'Scheduled/Elective'), 'Yes');
    await page.locator('#description select').first().selectOption({ label: 'General anesthesia' });
    await choose(q(page, 'Wound Classification'), 'Clean/Contaminated');
    await choose(q(page, 'Suture size'), '2-0');
    await choose(page.locator('#sMaterial'), 'Other');
    await page.locator('#otherSMaterial :is(input, textarea):visible').fill('Nylon');
    await q(page, '# of sutures').locator('input[type=text]').fill('3');
    await choose(q(page, 'Location of uterine incision'), 'Low traverse incision on uterus');
    await q(page, '# of lacerations').locator('input[type=text]').fill('1');
    await page.locator('#lace-loc-14 input[type=checkbox]').check();
    await choose(page.locator('#perineal-grade'), '2');
    // ins and outs
    await page.locator('#ins-outs select').first().selectOption({ label: "Ringer's lactate" });
    await page.locator('#ins-outs .small input').first().fill('1.5');
    await choose(page.locator('#transfusionQ'), 'Yes');
    await page.locator('#transfusionDetails input[type=text]').first().fill('2');
    await choose(page.locator('#antibioticsQ'), 'Yes');
    await page.locator('#antibioticDetails select').selectOption({ label: 'Cefazolin' });
    await choose(q(page, 'Venous thromboembolism prophylaxis'), 'Graduated compression stockings');
    await page.locator('#ins-outs p:has(strong:text-is("Fluid outputs")) input').nth(0).fill('0.6');
    await page.locator('#ins-outs p:has(strong:text-is("Fluid outputs")) input').nth(1).fill('0.4');
    // pathology
    await choose(page.locator('#pathSentQ'), 'Yes');
    await page.locator('#pathDetails input[type=text]').fill('Placenta sent');
    await choose(page.locator('#labSpecQ'), 'No');
    // findings
    await choose(page.locator('#plan p.side-by-side').first(), 'None');
    await tick(page, 'Clean', '#plan');
    await tick(page, 'Dressing in place', '#plan');
    await page.locator('#additional-comments textarea').fill('Uneventful');
    await save(page);

    const displays = await obsDisplays(api, section.encounter.uuid);
    expectObs(
      displays,
      'procedure performed: caesarean section with tubal ligation',
      'diagnosis: adhesion of urinary bladder',
      'scheduled surgery: yes',
      'type of anesthesia: general anesthesia',
      'classifications of surgical wounds: clean/contaminated',
      'suture thickness (text): 2-0',
      'suture material (coded): other',
      'suture material (text): nylon',
      'number of surgical sutures: 3',
      'location of incision on uterus: low traverse incision on uterus',
      'number of lacerations: 1',
      'location of laceration(s): perineum',
      'perineal tear: perineal laceration, second degree',
      "intravenous fluids administered: ringer's lactate",
      'ivf volume: 1.5',
      'transfusion status: yes',
      'volume of transfusion: 2.0',
      'pre-operative antibiotic administered: yes',
      'surgery antibiotics: cefazolin',
      'venous thromboembolism prophylaxis: graduated compression stockings',
      'estimated blood loss: 0.6',
      'volume measurement, urine: 0.4',
      'pathology sample sent: yes',
      'pathology specimen comment: placenta sent',
      'laboratory specimen sent: no',
      'complications from surgery: none',
      'cesarean section wound status: surgical wound healed',
      'cesarean section wound status: wound dressing',
      'additional surgery comments: uneventful',
    );

    // EDIT starts from the saved values and the conditional blocks follow them
    await open(page, section);
    await expect(page.locator('#description input:checked + label').first()).toHaveText('Caesarean section with tubal ligation');
    await expect(page.locator('#otherSMaterial')).toBeVisible();
    await expect(page.locator('#otherSMaterial :is(input, textarea):visible')).toHaveValue('Nylon');
    await expect(page.locator('#perineal-grade')).toBeVisible();
    await expect(checked(page.locator('#perineal-grade'))).toHaveText('2');
    await expect(page.locator('#transfusionDetails')).toBeVisible();
    await expect(page.locator('#antibioticDetails')).toBeVisible();
    await expect(page.locator('#pathDetails input[type=text]')).toHaveValue('Placenta sent');
    await expect(page.locator('#labSpecDetails')).toBeHidden();
    await expect(page.locator('#additional-comments textarea')).toHaveValue('Uneventful');

    // VIEW on the visit page
    // answerCodes labels differ from the concept names
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Cesarean section wound status: Surgical wound healed': 'Clean',
      'Cesarean section wound status: Wound dressing': 'Dressing in place',
      'Perineal tear: Perineal laceration, second degree': '2',
    });
    const shown = (await view.valueTexts()).join(' | ');
    expect(shown).toContain('Nylon');
    expect(shown).toContain('Placenta sent');
    expect(shown).toContain('Uneventful');
    await expect(view.root.locator('#buttons, #next, #submit, h2')).toHaveCount(0);
  });
});

test.describe('section-c-section VIEW of a small save', () => {
  test('VIEW shows the surgeon and the one comment that were saved, and no heading or buttons', async ({ page, api, createSectionEncounter }) => {
    const section = await createSectionEncounter({ encounterTypeUuid: DELIVERY_ENCOUNTER_TYPE_UUID, patient: female });
    await addAttendingSurgeon(api, section.encounter.uuid);
    await open(page, section);
    await page.locator('#additional-comments textarea').fill('Only a comment');
    await save(page);
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {});
    // the first value is the attending surgeon (the provider widget prints the provider's name), the second the comment
    const shown = await view.valueTexts();
    expect(shown).toHaveLength(2);
    expect(shown[0]).not.toBe('');
    expect(shown[1]).toBe('Only a comment');
    await expect(view.root.locator('#pathDetails .value, #transfusionDetails .value, #description .value')).toHaveCount(0);
    // ifMode VIEW include=false :168, :620
    await expect(view.root.locator('h2, #buttons, #next, #submit')).toHaveCount(0);
  });
});

test.describe('section-c-section next to section-delivery on the same encounter', () => {
  let section: SectionEncounter;
  test.beforeEach(async ({ page, api, createSectionEncounter }) => {
    section = await createSectionEncounter({ encounterTypeUuid: DELIVERY_ENCOUNTER_TYPE_UUID, patient: female });
    await addAttendingSurgeon(api, section.encounter.uuid);
    await page.goto(SectionFormPage.editUrl(DELIVERY_FORM, section));
    await expect(page.locator(SAVE)).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test.fixme('V1: saving the c-section keeps the procedures the delivery section saved (both use Procedure performed, CIEL:1651)', async ({ page, api }) => {
    // remove test.fixme() when fixed. section-delivery saves CIEL:1651 as two checkboxes (suture of the perineum, episiotomy); section-c-section edits the same concept
    // as a radio. HFE hands the first existing CIEL:1651 obs to the radio, so saving a caesarean REPLACES "Suture of female perineum" (checked on zl-ci: episiotomy stays,
    // the suture answer is gone and the delivery section opens without it).
    await pickDate(page.locator('#deliveryDate input[readonly]'), isoDate(-1));
    await tick(page, 'Suture of female perineum');
    await tick(page, 'Episiotomy');
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'procedure performed: suture of female perineum', 'procedure performed: episiotomy');

    await open(page, section);
    await tick(page, 'Caesarean section', '#description');
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'procedure performed: caesarean section', 'procedure performed: suture of female perineum', 'procedure performed: episiotomy');
  });

  test('saving the delivery section keeps the procedure and the adhesion the c-section saved', async ({ page, api }) => {
    await pickDate(page.locator('#deliveryDate input[readonly]'), isoDate(-1));
    await save(page);
    await open(page, section);
    await tick(page, 'Caesarean section', '#description');
    await tick(page, 'Adhesion of urinary bladder', '#description');
    await save(page);
    await page.goto(SectionFormPage.editUrl(DELIVERY_FORM, section));
    await expect(page.locator(SAVE)).toBeVisible();
    await tick(page, 'Episiotomy');
    await tick(page, 'Fetal distress');
    await save(page);
    expectObs(
      await obsDisplays(api, section.encounter.uuid),
      'procedure performed: caesarean section',
      'diagnosis: adhesion of urinary bladder',
      'procedure performed: episiotomy',
      'diagnosis: fetal distress',
    );
  });

  test('the diagnoses of the adhesions get no "Diagnosis order" (V2), those of the delivery section do', async ({ page, api }) => {
    // section-delivery has postSubmissionAction CleanDiagnosisConstructAction (adds Secondary), section-c-section has none
    await tick(page, 'Fetal distress');
    await pickDate(page.locator('#deliveryDate input[readonly]'), isoDate(-1));
    await save(page);
    expectObs(await obsDisplays(api, section.encounter.uuid), 'diagnosis order: secondary');

    await open(page, section);
    await tick(page, 'Adhesion of urinary bladder', '#description');
    await save(page);
    const displays = await obsDisplays(api, section.encounter.uuid);
    expectObs(displays, 'diagnosis: adhesion of urinary bladder');
    // one construct per diagnosis: the delivery's (fetal distress) has its order, the adhesion's has none
    expect(displays.filter((d) => d === 'diagnosis order: secondary')).toHaveLength(1);
  });
});
