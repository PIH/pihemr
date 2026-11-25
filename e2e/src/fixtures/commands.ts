import { type APIRequestContext, expect } from '@playwright/test';
import type { CreatePatientOptions, SiteSettings, TestEncounter, TestPatient } from '../contract';

// The REST commands behind the fixtures: they create a synthetic patient with a visit (and an encounter) and void it all afterwards.
// What differs per site comes from `site` (see SiteSettings); there is no purge anywhere, so the harness user does not need the Purge privileges.

// "Clinic or Hospital Visit"
export const CLINIC_OR_HOSPITAL_VISIT_TYPE_UUID = 'f01c54cb-2225-471a-9cd5-d348552c337c';

// A new identifier for the site's patient identifier type, issued by the server's idgen identifier source. It fails when the server does not issue one
// (a wrong source uuid, an exhausted pool, a harness user without the privilege), so that the test says why it could not create a patient.
export const generatePatientIdentifier = async (api: APIRequestContext, site: SiteSettings): Promise<string> => {
  const res = await api.post(`idgen/identifiersource/${site.patientIdentifier.sourceUuid}/identifier`, { data: {} });
  expect(res.ok(), `generate a patient identifier from idgen source ${site.patientIdentifier.sourceUuid}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).identifier;
};

// Creates a synthetic patient. Names contain no digits.
export const createPatient = async (api: APIRequestContext, site: SiteSettings, opts: CreatePatientOptions = {}): Promise<TestPatient> => {
  const res = await api.post('patient', {
    data: {
      identifiers: [
        {
          identifier: await generatePatientIdentifier(api, site),
          identifierType: site.patientIdentifier.typeUuid,
          location: site.visitLocationUuid,
          preferred: true,
        },
      ],
      person: {
        gender: opts.gender ?? 'F',
        birthdate: opts.birthdate ?? '1990-01-01',
        birthdateEstimated: false,
        names: [{ givenName: opts.givenName ?? 'AutoE', familyName: opts.familyName ?? 'Tester', preferred: true }],
        addresses: [],
        attributes: [],
      },
    },
  });
  expect(res.ok(), `create patient: ${res.status()}`).toBeTruthy();
  return res.json();
};

// Every datetime the harness sends is 60 seconds in the past. The server rejects an encounter (and a visit start, and an obs)
// dated after its own clock ("Encounter.datetimeShouldBeBeforeCurrent", HTTP 400), and a developer machine's clock that leads the
// server's by even 200 ms made about one create in ten fail at random. Do not use a bare new Date() for these.

// Starts a visit for the patient. Entry forms (the ones that create the encounter) open inside a visit.
export const createVisit = async (api: APIRequestContext, site: SiteSettings, patientUuid: string): Promise<string> => {
  const res = await api.post('visit', {
    data: {
      patient: patientUuid,
      visitType: site.visitTypeUuid ?? CLINIC_OR_HOSPITAL_VISIT_TYPE_UUID,
      location: site.visitLocationUuid,
      startDatetime: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  expect(res.ok(), `create visit: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};

// Starts a visit for the patient and records an empty encounter of the given type in it, at the session location. The section
// forms are edit forms for an existing encounter, so the encounter has to exist before the form opens.
export const createVisitWithEncounter = async (
  api: APIRequestContext,
  site: SiteSettings,
  patientUuid: string,
  encounterTypeUuid: string,
): Promise<TestEncounter> => {
  const now = new Date(Date.now() - 60_000).toISOString();

  const visitRes = await api.post('visit', {
    data: {
      patient: patientUuid,
      visitType: site.visitTypeUuid ?? CLINIC_OR_HOSPITAL_VISIT_TYPE_UUID,
      location: site.visitLocationUuid,
      startDatetime: now,
    },
  });
  expect(visitRes.ok(), `create visit: ${visitRes.status()}`).toBeTruthy();
  const visit = await visitRes.json();

  const encRes = await api.post('encounter', {
    data: {
      patient: patientUuid,
      encounterType: encounterTypeUuid,
      location: site.sessionLocationUuid,
      encounterDatetime: now,
      visit: visit.uuid,
    },
  });
  expect(encRes.ok(), `create encounter: ${encRes.status()}`).toBeTruthy();
  const encounter = await encRes.json();

  return { uuid: encounter.uuid, visitUuid: visit.uuid };
};

// Voids what the test created for the patient: encounters (which voids their obs and orders), then visits.
// Saving a section form twice voids the first save's obs, so listing the encounters and visits is enough; there is no foreign key to work around.
export const voidClinicalDataForPatient = async (api: APIRequestContext, patientUuid: string): Promise<void> => {
  const encRes = await api.get(`encounter?patient=${patientUuid}&limit=100`);
  expect(encRes.ok()).toBeTruthy();
  for (const encounter of (await encRes.json()).results) {
    const res = await api.delete(`encounter/${encounter.uuid}`);
    expect(res.ok(), `void encounter ${encounter.uuid}: ${res.status()} ${await res.text()}`).toBeTruthy();
  }

  const visitRes = await api.get(`visit?patient=${patientUuid}&includeInactive=true&limit=100`);
  expect(visitRes.ok()).toBeTruthy();
  for (const visit of (await visitRes.json()).results) {
    const res = await api.delete(`visit/${visit.uuid}`);
    expect(res.ok(), `void visit ${visit.uuid}: ${res.status()} ${await res.text()}`).toBeTruthy();
  }
};

// Saving some section forms enrolls the patient in a program (e.g. section-ncd-followup enrolls in NCD).
// Enrollments are voided with the patient, so they stop counting in program reports.
export const voidProgramEnrollments = async (api: APIRequestContext, patientUuid: string): Promise<void> => {
  const res = await api.get(`programenrollment?patient=${patientUuid}&v=custom:(uuid)&limit=100`);
  expect(res.ok()).toBeTruthy();
  for (const enrollment of (await res.json()).results) {
    const del = await api.delete(`programenrollment/${enrollment.uuid}`);
    expect(del.ok(), `void enrollment: ${del.status()}`).toBeTruthy();
  }
};

// Voids the patient (DELETE without `purge=true`).
export const deletePatient = async (api: APIRequestContext, uuid: string): Promise<void> => {
  const res = await api.delete(`patient/${uuid}`);
  expect(res.ok(), `void patient: ${res.status()}`).toBeTruthy();
};

// Voids a synthetic patient with everything the test created: encounters (with their obs and orders), visits and
// program enrollments, then the patient. Nothing is purged, so the user does not need the Purge privileges; the voided
// patients keep their `Auto… Tester` name, so a name-filtered cleanup can still find them.
export const cleanupPatient = async (api: APIRequestContext, patientUuid: string): Promise<void> => {
  await voidClinicalDataForPatient(api, patientUuid);
  await voidProgramEnrollments(api, patientUuid);
  await deletePatient(api, patientUuid);
};

// Birthdate for a patient who is `years` old today. The date is two days before the birthday: the browser
// machine, the test runner and the server may be in different timezones, and a patient born exactly
// `years` ago would read as `years - 1` on a server whose date is a day behind.
export const birthdateYearsAgo = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
};

// Birthdate for a patient who is `days` old today (a newborn: forms for age < 42 days). One day earlier, for the same timezone reason; `days` must be at least 1.
export const birthdateDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days - 1);
  return d.toISOString().slice(0, 10);
};
