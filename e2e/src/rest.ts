import { type APIRequestContext, expect } from '@playwright/test';

// Reads over the REST API. Only reads that behave the same on every site live here; creating and cleaning up test data is
// site-specific and is provided by each config repo's fixtures (see contract.ts).

export interface PatientEncounter {
  uuid: string;
  encounterType: { uuid: string };
}

// Encounters of one test patient (never call this with a patient the test did not create).
export const getPatientEncounters = async (api: APIRequestContext, patientUuid: string): Promise<PatientEncounter[]> => {
  const res = await api.get(`encounter?patient=${patientUuid}&v=custom:(uuid,encounterType:(uuid))&limit=100`);
  expect(res.ok(), `get encounters: ${res.status()}`).toBeTruthy();
  return (await res.json()).results;
};

export interface EncounterObs {
  display: string;
  concept: { uuid: string; display: string };
  value: unknown;
}

// Obs recorded on one encounter (the encounter belongs to a patient this test created).
// `limit` (default 200) is the most obs it reads: a form with more answers than that needs a larger one.
export const getEncounterObs = async (api: APIRequestContext, encounterUuid: string, limit = 200): Promise<EncounterObs[]> => {
  const res = await api.get(`obs?encounter=${encounterUuid}&v=custom:(display,concept:(uuid,display),value)&limit=${limit}`);
  expect(res.ok(), `get obs: ${res.status()}`).toBeTruthy();
  return (await res.json()).results;
};

// The display names of the locations tagged "Registration Location" on the server (metadata, not patient data).
export const getRegistrationLocations = async (api: APIRequestContext): Promise<string[]> => {
  const res = await api.get('location?tag=Registration%20Location&v=custom:(display)&limit=100');
  expect(res.ok(), `get locations: ${res.status()}`).toBeTruthy();
  return ((await res.json()).results as Array<{ display: string }>).map((l) => l.display);
};

// The display name of an encounter's location. For an encounter the harness created, that is the site's session location, so
// a spec can ask the server for it instead of hard-coding the site's location uuid or name.
export const getEncounterLocation = async (api: APIRequestContext, encounterUuid: string): Promise<string> => {
  const res = await api.get(`encounter/${encounterUuid}?v=custom:(location:(display))`);
  expect(res.ok(), `get encounter location: ${res.status()}`).toBeTruthy();
  return (await res.json()).location.display;
};

// The display name of a location (metadata). For the site's session location it is the name the form's location select shows, so a spec can
// ask the server for it instead of hard-coding the site's location name.
export const getLocationName = async (api: APIRequestContext, locationUuid: string): Promise<string> => {
  const res = await api.get(`location/${locationUuid}?v=custom:(display)`);
  expect(res.ok(), `get location: ${res.status()}`).toBeTruthy();
  return (await res.json()).display;
};

// Every datetime the harness sends is 60 seconds in the past. The server rejects an encounter (and a visit start, and an obs)
// dated after its own clock ("Encounter.datetimeShouldBeBeforeCurrent", HTTP 400), and a developer machine's clock that leads the
// server's by even 200 ms made about one create in ten fail at random. Do not use a bare new Date() for these.

// The value of an obs added over REST: text or a number as they are, `{ coded: 'CIEL:1912' }` for a coded answer (any concept
// reference the REST concept resource accepts: `source:code` or a uuid), `{ date: '2026-09-07' }` for a date.
export type ObsValue = string | number | { coded: string } | { date: string };

const conceptUuid = async (api: APIRequestContext, reference: string): Promise<string> => {
  const res = await api.get(`concept/${encodeURIComponent(reference)}?v=custom:(uuid)`);
  expect(res.ok(), `get concept ${reference}: ${res.status()}`).toBeTruthy();
  return (await res.json()).uuid;
};

const encounterLocationUuid = async (api: APIRequestContext, encounterUuid: string): Promise<string> => {
  const res = await api.get(`encounter/${encounterUuid}?v=custom:(location:(uuid))`);
  expect(res.ok(), `get encounter location: ${res.status()}`).toBeTruthy();
  return (await res.json()).location.uuid;
};

// Records one obs on a test encounter the way an app outside the form (the community-health app) would. Several calls with the same
// concept add several obs (a multi-answer checkbox question). Dated 60 seconds in the past (see above). The obs gets the encounter's
// location, as an obs saved by a form has it: an obs without one makes an HTML form that re-saves the encounter fail with
// "Editing the fields [location] on Obs is not allowed".
export const addObs = async (
  api: APIRequestContext,
  section: { patient: { uuid: string }; encounter: { uuid: string } },
  concept: string,
  value: ObsValue,
): Promise<void> => {
  let sent: string | number;
  if (typeof value === 'string' || typeof value === 'number') {
    sent = value;
  } else if ('coded' in value) {
    sent = await conceptUuid(api, value.coded);
  } else {
    // noon UTC: the same calendar day in the server's and the browser's time zones
    sent = `${value.date}T12:00:00.000+0000`;
  }
  const res = await api.post('obs', {
    data: {
      person: section.patient.uuid,
      concept: await conceptUuid(api, concept),
      encounter: section.encounter.uuid,
      location: await encounterLocationUuid(api, section.encounter.uuid),
      obsDatetime: new Date(Date.now() - 60_000).toISOString(),
      value: sent,
    },
  });
  expect(res.ok(), `create obs ${concept}: ${res.status()}`).toBeTruthy();
};

export interface EncounterHeader {
  form: { uuid: string; name: string } | null;
  location: { uuid: string };
  visit: { uuid: string } | null;
  encounterDatetime: string;
  encounterType: { uuid: string };
  encounterProviders: Array<{ encounterRole: { uuid: string } }>;
}

// The encounter's own fields as the server stored them (the encounter belongs to a patient this test created): the form HFE linked, the
// location, visit and datetime, and the roles of its providers (no provider names).
export const getEncounterHeader = async (api: APIRequestContext, encounterUuid: string): Promise<EncounterHeader> => {
  const res = await api.get(
    `encounter/${encounterUuid}?v=custom:(form:(uuid,name),location:(uuid),visit:(uuid),encounterDatetime,encounterType:(uuid),encounterProviders:(encounterRole:(uuid)))`,
  );
  expect(res.ok(), `get encounter: ${res.status()}`).toBeTruthy();
  return res.json();
};
