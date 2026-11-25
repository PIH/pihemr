import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { SectionFormPage, ViewFormPage, expectViewShowsSavedObs } from '../pages';
import { getEncounterObs } from '../rest';
import { specFacts } from '../spec-facts';
import type { ParentEncounter, PihemrFixtures, SectionEncounter, SiteSettings } from '../contract';

// section-chief-complaint.xml (pihemr): "Chief Complaint" section, one free-text obs (CIEL:160531, `#chief-complaint`). On the visit page it is the
// `pihcore-chief-complaint` section of some encounter types of each site (`site.specs['section-chief-complaint'].parents`); the tests create the parent
// encounter over REST (so it has no `form`) and open the section's edit URL directly (that skips the visit-page gating of the site's _availability.e2e.md).
// Every test runs under each parent of the site, as a step.
//
// Conditions in the form, from documentation inventory (section-chief-complaint.inv.md):
//   ifMode VIEW include=false :16, :37   heading + script, and the #buttons row (Next, Save, Cancel); absent in VIEW
// Scripts: :21 setUpNextAndSubmitButtons() only (see _shared.e2e.md). No validation, default or derived value; nothing is required.
// Side effects on save: none (no postSubmissionAction, program, order).
// VIEW is tested on the visit page, which shows the section's own VIEW (`pihcore-chief-complaint` has an active templateModelUrl in
//   encounterTypeConfig.js): expectViewShowsSavedObs.
// Not covered here: #next (moves to the next section of the parent entry form; needs the entry form, see _shared.e2e.md); which sections a site's visit page
//   lists for a parent (the site's own spec).

const FORM = 'section-chief-complaint.xml';
const COMPLAINT = 'Fever and headache for three days';

const complaint = (page: Page) => page.locator('#chief-complaint textarea');

test.describe('section-chief-complaint', () => {
  // Runs `body` once per parent encounter of the site, with a new patient and the section's edit form open.
  const underEachParent = async (
    site: SiteSettings,
    page: Page,
    createSectionEncounter: PihemrFixtures['createSectionEncounter'],
    body: (section: SectionEncounter, parent: ParentEncounter) => Promise<void>,
  ) => {
    for (const parent of specFacts(site, 'section-chief-complaint').parents) {
      await test.step(`under ${parent.name}`, async () => {
        const section = await createSectionEncounter({
          encounterTypeUuid: parent.encounterTypeUuid,
          patient: { givenName: 'AutoChiefComplaint', familyName: 'Tester', gender: 'F' },
        });
        await SectionFormPage.openEdit(page, FORM, section);
        await body(section, parent);
      });
    }
  };

  test('ENTER/EDIT shows the heading, the textarea and the Next, Save and Cancel buttons', async ({ page, site, createSectionEncounter }) => {
    await underEachParent(site, page, createSectionEncounter, async () => {
      // ifMode VIEW include=false :16, :37
      await expect(page.locator('#htmlform h1')).toBeVisible();
      await expect(complaint(page)).toBeVisible();
      await expect(page.locator('#next')).toBeVisible();
      await expect(page.locator('#submit')).toBeVisible();
      await expect(page.locator('#cancel')).toBeVisible();
    });
  });

  test('saves with the complaint blank (nothing is required) and records no obs', async ({ page, api, site, createSectionEncounter }) => {
    await underEachParent(site, page, createSectionEncounter, async (section) => {
      await new SectionFormPage(page, FORM).save();
      await new SectionFormPage(page, FORM).expectSaved();
      expect(await getEncounterObs(api, section.encounter.uuid)).toEqual([]);
    });
  });

  test('saves the complaint, EDIT shows it again, VIEW shows it on the visit page', async ({ page, api, site, createSectionEncounter }) => {
    test.slow(); // saves, reopens EDIT and loads the visit page, once for each parent of the site: about 20 s under two parents on a CI server
    await underEachParent(site, page, createSectionEncounter, async (section) => {
      await complaint(page).fill(COMPLAINT);
      await new SectionFormPage(page, FORM).save();
      await new SectionFormPage(page, FORM).expectSaved();

      const obs = await getEncounterObs(api, section.encounter.uuid);
      expect(obs).toHaveLength(1);
      expect(obs[0].concept.display).toBe('Chief complaint (text)');
      expect(obs[0].value).toBe(COMPLAINT);

      // EDIT starts from the saved value
      await SectionFormPage.openEdit(page, FORM, section);
      await expect(complaint(page)).toHaveValue(COMPLAINT);

      // VIEW (ifMode VIEW include=false :16, :37: no heading script, no buttons)
      const view = await expectViewShowsSavedObs(page, api, FORM, section.encounter.uuid);
      expect(await view.valueTexts()).toContain(COMPLAINT);
      await expect(view.page.locator('#buttons, #submit, #next, #cancel')).toHaveCount(0);
    });
  });

  test('blanking the complaint in EDIT voids the obs, and VIEW then shows no value', async ({ page, api, site, createSectionEncounter }) => {
    test.slow(); // saves, reopens EDIT and loads the visit page, once for each parent of the site: about 20 s under two parents on a CI server
    await underEachParent(site, page, createSectionEncounter, async (section) => {
      await complaint(page).fill(COMPLAINT);
      await new SectionFormPage(page, FORM).save();
      await new SectionFormPage(page, FORM).expectSaved();
      await SectionFormPage.openEdit(page, FORM, section);
      await complaint(page).fill('');
      await new SectionFormPage(page, FORM).save();
      await new SectionFormPage(page, FORM).expectSaved();
      expect(await getEncounterObs(api, section.encounter.uuid)).toEqual([]);

      const view = await ViewFormPage.open(page, FORM, section.encounter.uuid);
      await expect(view.values).toHaveCount(0);
      await expect(view.root.locator('#chief-complaint .emptyValue')).toHaveCount(1);
    });
  });
});
