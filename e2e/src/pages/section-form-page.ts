import { type Page, expect } from '@playwright/test';
import { VISIT_PAGE_URL, visitPagePath } from './visit-urls';
import type { SectionEncounter } from '../contract';

// A section-*.xml form is a standalone HTML Form Entry form that edits an existing encounter. On the
// visit page it is opened from the section's edit pencil (see scripts/visit/encounterTypeConfig.js in
// pihemr); the specs open the same URL directly, so the visit-page and app-loader gating that decides
// when a section is shown is not exercised here (see documentation/_availability.e2e.md).
export class SectionFormPage {
  constructor(
    readonly page: Page,
    readonly formFile: string,
  ) {}

  static editUrl(formFile: string, { patient, encounter }: SectionEncounter): string {
    const params = new URLSearchParams({
      patientId: patient.uuid,
      visitId: encounter.visitUuid,
      encounterId: encounter.uuid,
      definitionUiResource: `file:configuration/pih/htmlforms/${formFile}`,
      returnUrl: visitPagePath(encounter.visitUuid),
    });
    return `htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?${params.toString()}`;
  }

  static async openEdit(page: Page, formFile: string, section: SectionEncounter): Promise<SectionFormPage> {
    await page.goto(SectionFormPage.editUrl(formFile, section));
    const form = new SectionFormPage(page, formFile);
    await expect(form.submitButton).toBeVisible();
    return form;
  }

  get submitButton() {
    return this.page.locator('#submit');
  }

  async save() {
    await this.submitButton.click();
  }

  async expectSaved() {
    await expect(this.page).toHaveURL(VISIT_PAGE_URL);
  }
}

// Some forms (the patientRegistration-* ones) have their own Save button, `#buttons button.submitButton`, and no `#submit`.
export const buttonsSubmit = (page: Page) => page.locator('#buttons button.submitButton');

export async function openEditWithButtonsSubmit(page: Page, formFile: string, section: SectionEncounter): Promise<void> {
  await page.goto(SectionFormPage.editUrl(formFile, section));
  await expect(buttonsSubmit(page)).toBeVisible();
}
