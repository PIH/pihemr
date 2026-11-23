import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { birthdateYearsAgo } from '../fixtures/commands';
import { type SectionEncounter } from '../contract';
import { OBGYN_ENCOUNTER_TYPE_UUID } from '../encounter-types';
import { SectionFormPage, expectViewShowsSavedObs } from '../pages';
import { expectObs, isoDate, obsDisplays, pickDate, pickerDate, viewDate } from '../pages/form-widgets';

// section-obgyn-initial.xml (pihemr, v1.0): "OB/GYN Overview": the OB/GYN intake / follow-up note in one form: type of visit (Gynecology, Prenatal, Postpartum,
// Family planning) and of consultation (New, Follow-up), referral, vitals (most recent of the visit shown), chief complaint, habits, medications, patient /
// family / family-planning history, infectious diseases (HIV, TB, syphilis), the OB/GYN block (LMP, pregnancy, EDD, gravida/para/abortus/living, trimester),
// cancer screening, prenatal / postpartum areas, high-risk factors, mental health. On the visit page it is the `section-obgyn-initial` section of the OB/GYN
// encounter; the specs create the parent encounter over REST (a female patient) and open the section's edit URL directly (skips the gating of
// _availability.e2e.md). Written on zl-ci (ZL, the site that offers the form: _availability.e2e.json skips it elsewhere). Most of the form is hidden until the two radios at the top are answered.
//
// Conditions in the form, from documentation inventory (section-obgyn-initial.inv.md):
//   when PIH:8879 type of visit = Prenatal :807 shows #prenatal-area;  = Postpartum :808 shows #postpartum-area (Gynecology and Family planning show neither)
//   when CIEL:164181 consultation = New :826 JS: shows #intake-only (habits, medications, patient / family / FP history, infectious diseases, OB/GYN, cancer,
//          risk, mental health), hides #obgyn-initial-div and #obgyn-section-followup; any other answer hides #intake-only
//   when consultation = Follow-up :827 JS: shows #obgyn-initial-div (the "last OB/GYN intake" summary) and hides #obgyn-section; any other answer does the reverse
//   when CIEL:159777 condoms provided = Yes :1387 shows #num-condoms;  toggle CIEL:164401 HIV test :1414 shows #hiv-test;  when on ARV = Yes :1528 shows
//          #art-startdate;  when TB treatment = completed :1560 shows #tb-treatment-end-date;  toggle CIEL:163560 cervical cancer screening :2201 shows #cerv-cancer-date;
//          when CIEL:163092 high risk from previous pregnancy = Yes :2300 shows #risk-message;  when pregnant (CIEL:5272) = Yes :1978 JS: shows #dueDateDiv and
//          #gestationalDateDiv;  toggle family-planning method boxes :1310 dims the row's start / end dates
//   includeIf latestObs(CIEL:163722 | 856 | 5497 | 159427) :1423-:1463  the grey "last HIV test" lines (same as section-oncology-history; not repeated here)
//   includeIf current workflow state PIH:11699 :1125 / excludeIf :1132  (the type-of-treatment workflow of the patient's program; needs an enrolment in that workflow: not covered)
//   includeIf latestObs(CIEL:5599, $encounterDate) :2218  "previous delivery date" in the postpartum area
//   ifMode VIEW include=false :71, :77, :455, :1036, :1666, :2366   CSS, scripts, the non-VIEW vitals inputs, the #buttons row;  ifMode VIEW :447, :1022  VIEW-only blocks
// Scripts: :78-446 on load, GET ws/rest/v1/visit/<visit> (vitals of the visit into the "most recent vitals" block) and ws/rest/v1/encounter?s=byObs (OB/GYN intake
//   encounters, newest first, dated not after this one): fills the grey "last OB/GYN intake" summary (#obgyn_initial_*: LMP, EDD, gravida/para/abortus/living,
//   trimester, menstruation, pregnancy history) from the FIRST qualifying encounter (it breaks after it) and pre-fills the EDD of an intake from the last known one;
//   :455-:526 setUpEdd + EDD validators (shared, see _shared.e2e.md) and the family / past history text rule (same as section-history); :527 beforeSubmit: clears the EDD /
//   gestational-age obs of the other consultation type; :677 validateTrimester() (beforeSubmit :784): blocks the save (no message; focuses the first missing radio) when the type of
//   visit or of consultation is blank, Prenatal + New without trimester at enrollment / pregnant / "LMP known", Prenatal + Follow-up without pregnancy trimester,
//   Family planning without patient type or method, an HIV test ticked without a date; addAndRemoveMandatory() :560 on change of the two radios sets which are required.
// Side effects on save: enrollInProgram MCH :790 (always); postSubmissionActions CleanDiagnosisConstructAction and TransitionToPrenatalGroupAction (pihcore;
//   not exercised beyond a Gynecology / Prenatal save).
// VIEW is tested on the visit page, which shows the section's own VIEW (`section-obgyn-initial` has an active templateModelUrl in encounterTypeConfig.js,
//   longTemplate viewSectionWithHtmlFormLong.page): expectViewShowsSavedObs.
// Findings: see pihemr _findings.e2e.md#section-obgyn-initial
//   V1 Low :1738 vs :2018 the calculated gestational age / EDD block (calculated-edd-and-gestational and its six inner ids) is defined twice, once in the
//          #obgyn_initial summary and once in the OB/GYN block: duplicate ids in the rendered form (the scripts update both through the class, but id
//          selectors find only the first). The inventory's bp_systolic / bp_diastolic duplicates are in mutually exclusive ifMode blocks: not a finding.
//   V2 Low :560, :755-:762 addAndRemoveMandatory() writes "[required]" into the `.field-error` of #pregnancyTrimester and #trimesterAtEnrollment, and the change
//          handlers only hide the separate ...Msg spans, so the red "[required]" stays next to the radio after the user has answered it.
// Not covered here: the workflow-state includeIf :1125 / :1132 (needs an enrolment in the type-of-treatment workflow), the previous delivery date :2218,
//   the EDD validators (shared), #next, the pregnancy-history table rows (:1337 prior-procedure-widget), Family planning and Postpartum saves.

const FORM = 'section-obgyn-initial.xml';
const SAVE = '#submit';
const patient = { givenName: 'AutoObgynInit', familyName: 'Tester', gender: 'F' as const, birthdate: birthdateYearsAgo(28) };

const open = async (page: Page, create: (o: { encounterTypeUuid: string; patient: typeof patient }) => Promise<SectionEncounter>) => {
  const section = await create({ encounterTypeUuid: OBGYN_ENCOUNTER_TYPE_UUID, patient });
  await SectionFormPage.openEdit(page, FORM, section);
  return section;
};
const reopen = async (page: Page, section: SectionEncounter) => SectionFormPage.openEdit(page, FORM, section);
const save = async (page: Page) => {
  await new SectionFormPage(page, FORM).save();
  await new SectionFormPage(page, FORM).expectSaved();
};
const reason = (page: Page, label: 'Gynecology' | 'Prenatal' | 'Postpartum' | 'Family planning') => page.locator('#visit-reason').getByLabel(label, { exact: true });
const consultation = (page: Page, label: 'New' | 'Follow-up') => page.locator('#intake-or-followup').getByLabel(label, { exact: true });
const conceptUuid = async (api: APIRequestContext, mapping: string): Promise<string> => {
  const res = await api.get(`concept/${mapping}?v=custom:(uuid)`);
  expect(res.ok(), `get concept ${mapping}: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};
// A prior OB/GYN intake encounter in the section's visit (the visit is moved back so that it can be dated before the test encounter).
const addPriorIntake = async (api: APIRequestContext, section: SectionEncounter, daysAgo: number, gravida: number, locationUuid: string) => {
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
        { concept: '164181AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', value: '164180AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
        { concept: await conceptUuid(api, 'CIEL:5624'), value: gravida },
      ],
    },
  });
  expect(res.ok(), `create prior intake: ${res.status()} ${res.ok() ? '' : (await res.text()).slice(0, 300)}`).toBeTruthy();
};

test.describe('section-obgyn-initial', () => {
  test('ENTER/EDIT shows Next, Save and Cancel, and only the first two questions before they are answered', async ({ page, createSectionEncounter }) => {
    // ifMode VIEW include=false :1666 / :2366; when :826 (nothing chosen: #intake-only hidden)
    await open(page, createSectionEncounter);
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator(SAVE)).toBeVisible();
    await expect(page.locator('#cancel')).toBeVisible();
    await expect(page.locator('#consult-type')).toBeVisible();
    await expect(page.locator('#intake-only')).toBeHidden();
    await expect(page.locator('#prenatal-area')).toBeHidden();
    await expect(page.locator('#postpartum-area')).toBeHidden();
    await expect(page.locator('#obgyn-initial-div')).toBeHidden();
  });

  test('the type of visit shows the prenatal or the postpartum area', async ({ page, createSectionEncounter }) => {
    // when :807, :808
    await open(page, createSectionEncounter);
    await reason(page, 'Prenatal').check();
    await expect(page.locator('#prenatal-area')).toBeVisible();
    await expect(page.locator('#postpartum-area')).toBeHidden();
    await reason(page, 'Postpartum').check();
    await expect(page.locator('#postpartum-area')).toBeVisible();
    await expect(page.locator('#prenatal-area')).toBeHidden();
    await reason(page, 'Gynecology').check();
    await expect(page.locator('#prenatal-area')).toBeHidden();
    await expect(page.locator('#postpartum-area')).toBeHidden();
    await reason(page, 'Family planning').check();
    await expect(page.locator('#prenatal-area')).toBeHidden();
    await expect(page.locator('#postpartum-area')).toBeHidden();
  });

  test('New shows the intake sections; Follow-up shows the last-intake summary instead of the OB/GYN block', async ({ page, createSectionEncounter }) => {
    // when :826, :827 (JavaScript)
    await open(page, createSectionEncounter);
    await consultation(page, 'New').check();
    await expect(page.locator('#intake-only')).toBeVisible();
    await expect(page.locator('#habits')).toBeVisible();
    await expect(page.locator('#obgyn-section')).toBeVisible();
    await expect(page.locator('#obgyn-initial-div')).toBeHidden();
    await consultation(page, 'Follow-up').check();
    await expect(page.locator('#intake-only')).toBeHidden();
    await expect(page.locator('#obgyn-initial-div')).toBeVisible();
    await expect(page.locator('#obgyn-section')).toBeHidden();
    await consultation(page, 'New').check();
    await expect(page.locator('#obgyn-initial-div')).toBeHidden();
    await expect(page.locator('#obgyn-section')).toBeVisible();
  });

  test('the answers that show other fields: condoms, HIV test, ARV, TB treatment, cervical screening, high risk', async ({ page, createSectionEncounter }) => {
    // when :1387, toggle :1414, when :1528, :1560, toggle :2201, when :2300
    test.slow();
    await open(page, createSectionEncounter);
    await reason(page, 'Gynecology').check();
    await consultation(page, 'New').check();
    const toggle = async (check: () => Promise<void>, uncheck: () => Promise<void>, target: string) => {
      await expect(page.locator(target), `${target} starts hidden`).toBeHidden();
      await check();
      await expect(page.locator(target), `${target} after the answer`).toBeVisible();
      await uncheck();
      await expect(page.locator(target), `${target} after clearing`).toBeHidden();
    };
    await toggle(() => page.locator('#condom-use input[type=checkbox]').check(), () => page.locator('#condom-use input[type=checkbox]').uncheck(), '#num-condoms');
    await toggle(() => page.locator('#hiv-test-checkbox input[type=checkbox]').check(), () => page.locator('#hiv-test-checkbox input[type=checkbox]').uncheck(), '#hiv-test');
    await toggle(() => page.locator('#on-arv').getByLabel('Yes').check(), () => page.locator('#on-arv').getByLabel('No').check(), '#art-startdate');
    await toggle(() => page.locator('#tb-treatment input[type=radio]').nth(0).check(), () => page.locator('#tb-treatment input[type=radio]').nth(1).check(), '#tb-treatment-end-date'); // completed, incomplete
    await toggle(() => page.locator('#cancer-section input[type=checkbox]').check(), () => page.locator('#cancer-section input[type=checkbox]').uncheck(), '#cerv-cancer-date');
    await toggle(() => page.locator('#prev-hi-risk input[type=checkbox]').check(), () => page.locator('#prev-hi-risk input[type=checkbox]').uncheck(), '#risk-message');
  });

  test('Save is blocked, with nothing submitted, while the visit, the consultation or the prenatal answers are missing', async ({ page, createSectionEncounter }) => {
    // beforeSubmit validateTrimester :677 / :784, addAndRemoveMandatory :560
    test.slow();
    await open(page, createSectionEncounter);
    const submits: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/submit.action')) {
        submits.push(r.url());
      }
    });
    const blocked = async (why: string) => {
      await page.locator(SAVE).click();
      await page.waitForTimeout(800);
      expect(submits, why).toEqual([]);
    };
    await blocked('nothing chosen');
    await reason(page, 'Gynecology').check();
    await blocked('no consultation type');
    await reason(page, 'Prenatal').check();
    await consultation(page, 'Follow-up').check();
    await expect(page.locator('#obgyn-section-followup')).toBeVisible();
    await blocked('prenatal follow-up without a pregnancy trimester');
    await expect(page.locator('#pregnancyTrimester .field-error')).toContainText(/required/i);
    await page.locator('#pregnancyTrimester').getByLabel('Second trimester').check(); // the red "[required]" stays visible after the answer (V2)
    await consultation(page, 'New').check();
    await blocked('prenatal new without a trimester at enrollment');
    await expect(page.locator('#trimesterAtEnrollment .field-error')).toContainText(/required/i);
  });

  test('the last OB/GYN intake is summarised for a follow-up, from the most recent prior intake', async ({ site, page, api, createSectionEncounter }) => {
    // script :78-446 (REST byObs, newest first, it breaks after the first one dated not after this encounter)
    const section = await open(page, createSectionEncounter);
    await addPriorIntake(api, section, 5, 1, site.sessionLocationUuid);
    await addPriorIntake(api, section, 2, 3, site.sessionLocationUuid);
    await reopen(page, section);
    await consultation(page, 'Follow-up').check();
    await expect(page.locator('#obgyn_initial_gravidaInput')).toHaveText('3');
    await expect(page.locator('#lastObGynInitialEncounterDate')).not.toHaveText('');
  });

  test('saves a gynecology intake: EDIT and VIEW show it, and the patient is enrolled in the MCH program', async ({ page, api, createSectionEncounter }) => {
    test.slow();
    const HIV_DATE = isoDate(-90);
    const SCREEN = isoDate(-200);
    const section = await open(page, createSectionEncounter);
    await reason(page, 'Gynecology').check();
    await consultation(page, 'New').check();
    await page.locator('#chief-complaint textarea').first().fill('Pelvic pain for two weeks');
    await page.locator('#condom-use input[type=checkbox]').check();
    await page.locator('#num-condoms input').fill('10');
    await page.locator('#hiv-test-checkbox input[type=checkbox]').check();
    await pickDate(page.locator('#hiv-test-date input[readonly]'), HIV_DATE);
    await page.locator('#hiv-test').getByLabel('Negative').check();
    await page.locator('#gravidaInput input').fill('2');
    await page.locator('#paraInput input').fill('1');
    await page.locator('#cancer-section input[type=checkbox]').check();
    await pickDate(page.locator('#cerv-cancer-date input[readonly]'), SCREEN);
    await page.locator('#prev-hi-risk input[type=checkbox]').check();
    await save(page);

    expectObs(await obsDisplays(api, section.encounter.uuid), 'Pelvic pain for two weeks', 'condom', 'new visit');
    const enrolments = await api.get(`programenrollment?patient=${section.patient.uuid}&v=custom:(program:(name))`);
    expect(enrolments.ok()).toBeTruthy();
    expect(((await enrolments.json()).results as Array<{ program: { name: string } }>).map((e) => e.program.name)).toContain('MCH'); // enrollInProgram :790

    // EDIT starts from the saved values: the two top radios show their areas
    await reopen(page, section);
    await expect(reason(page, 'Gynecology')).toBeChecked();
    await expect(consultation(page, 'New')).toBeChecked();
    await expect(page.locator('#intake-only')).toBeVisible();
    await expect(page.locator('#chief-complaint textarea').first()).toHaveValue('Pelvic pain for two weeks');
    await expect(page.locator('#num-condoms')).toBeVisible();
    await expect(page.locator('#num-condoms input')).toHaveValue('10');
    await expect(page.locator('#hiv-test')).toBeVisible();
    await expect(page.locator('#hiv-test-date input[readonly]')).toHaveValue(pickerDate(HIV_DATE));
    await expect(page.locator('#hiv-test').getByLabel('Negative')).toBeChecked();
    await expect(page.locator('#gravidaInput input')).toHaveValue('2');
    await expect(page.locator('#cerv-cancer-date')).toBeVisible();
    await expect(page.locator('#risk-message')).toBeVisible();

    // VIEW on the visit page
    await page.goto('about:blank');
    const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid, {
      'Type of outpatient visit: Gynecology specialty': 'Gynecology',
      'Visit type: New visit': '[X] New',
    });
    const shown = (await view.valueTexts()).join(' | ');
    for (const text of ['Pelvic pain for two weeks', '10', viewDate(HIV_DATE), viewDate(SCREEN)]) {
      expect(shown, text).toContain(text);
    }
    await expect(view.root.locator('#buttons, #submit, #next')).toHaveCount(0);
  });
});
