import { type APIRequestContext, type Page, expect } from '@playwright/test';
import { EntryFormPage } from './entry-form-page';
import { SectionFormPage } from './section-form-page';
import { VISIT_PAGE_URL } from './visit-urls';
import { getPatientEncounters } from '../rest';
import type { EntryContext } from '../contract';

// Helpers for the entry forms that are only a shell around the sections of the visit page (the four primary-care-*.xml forms): they
// auto-submit when provider, location and date have a value, so "entering" one is opening the URL and waiting for the encounter.

// Opens the shell form in the context's visit, waits for the auto-submit to land on the visit page, and returns the new encounter's uuid.
export const enterShellForm = async (page: Page, api: APIRequestContext, formFile: string, context: EntryContext): Promise<string> => {
  await EntryFormPage.open(page, formFile, context);
  await expect(page).toHaveURL(VISIT_PAGE_URL);
  let uuid = '';
  await expect
    .poll(async () => {
      const encounters = await getPatientEncounters(api, context.patient.uuid);
      uuid = encounters[0]?.uuid ?? '';
      return encounters.length;
    })
    .toBe(1);
  return uuid;
};

// The EDIT URL of an encounter a form created (the encounter edit link of the visit page opens it with the form's own file).
export const editEncounterUrl = (formFile: string, context: EntryContext, encounterUuid: string): string =>
  SectionFormPage.editUrl(formFile, { patient: context.patient, encounter: { uuid: encounterUuid, visitUuid: context.visitUuid } });
