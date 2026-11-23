import * as fs from 'fs';
import * as path from 'path';

// What a site offers, as data: `_availability.e2e.json` of the config repo, next to its `_availability.e2e.md` (the same findings, written for people). The
// skill hfe-e2e-specs.skill.md (pihemr) says how both are written; `inventory.py --check-coverage` checks that the JSON and the md agree.
//
// A *profile* is one way the site is deployed (SL: KGH or Wellbody; ZL: central, hiv, hsn; Liberia: Harper or Pleebo). Which forms are offered differs between
// profiles, so the JSON says it per profile, and a run says which profile its server is (`E2E_PROFILE`, else `defaultProfile` of the JSON).
//
// Playwright-free on purpose, like site.ts: includeSpecs() reads it while the config repo's spec files are being loaded.

export interface VisitActionEntry {
  kind: 'visit-action';
  // The location tag the user's session location must carry for the action to show (`sessionLocationHasTag` in the app loader). The reachability spec logs in
  // at a location that has it. Omit when no tag is required.
  sessionTag?: string;
  // The patient the action is offered for (default: an adult, 30 years, any sex). Fill in what the form's "Patient / visit requirement" says.
  // `ageDays` is for the forms of newborns (age < 42 days); it wins over `ageYears`.
  patient?: { gender?: 'M' | 'F'; ageYears?: number; ageDays?: number };
}

export interface OtherEntry {
  // `section`: a section of a visit-page encounter, edited through its pencil, not an action. `other`: a home app, the registration app, or anything else
  // that is not a visit action. The reachability spec does not look at these.
  kind: 'section' | 'other';
  note?: string;
}

export interface AvailabilityEntry {
  // The `formUuid` of the form XML: how the form is known on the server (REST `form/<uuid>`).
  formUuid: string;
  // The file, relative to the htmlforms directory of the merged config.
  path: string;
  // Per profile: does the site's app configuration offer the form to a user there? A profile that is not listed is not stated: the specs run.
  offered: Record<string, boolean>;
  // Why no profile offers it (the `Reason` and `Detail` of the md's "Not reachable" row).
  reason?: string;
  detail?: string;
  // Offered, but no spec can show it on the server the specs run on (the md's "Not covered" row): the reason.
  notCovered?: string;
  entry?: VisitActionEntry | OtherEntry;
}

export interface Availability {
  schema: 1;
  site: string;
  // The profile of the server the specs normally run on.
  defaultProfile: string;
  // Profile name -> what it is (the stacks and servers).
  profiles: Record<string, string>;
  // Keyed by the form file without `.xml`, relative to the htmlforms directory (`checkin`, `hiv/section-eid-plan`).
  forms: Record<string, AvailabilityEntry>;
}

const DEFAULT_RELATIVE = path.join('..', 'content', 'configuration', 'backend_configuration', 'pih', 'htmlforms', 'documentation', '_availability.e2e.json');

// The JSON of the config repo whose `e2e` directory the run starts in, or the file named by E2E_AVAILABILITY_FILE.
export const availabilityFile = (): string => process.env.E2E_AVAILABILITY_FILE ?? path.resolve(process.cwd(), DEFAULT_RELATIVE);

let cached: { file: string; value: Availability | undefined } | undefined;

// The site's availability, or undefined when the repo has none (pihemr itself): then nothing is skipped and nothing is checked.
export const loadAvailability = (): Availability | undefined => {
  const file = availabilityFile();
  if (cached?.file !== file) {
    cached = { file, value: fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as Availability) : undefined };
  }
  return cached.value;
};

export const currentProfile = (availability: Availability): string => {
  const profile = process.env.E2E_PROFILE ?? availability.defaultProfile;
  if (!(profile in availability.profiles)) {
    throw new Error(`E2E_PROFILE "${profile}" is not a profile of ${availabilityFile()}: ${Object.keys(availability.profiles).join(', ')}`);
  }
  return profile;
};

// The entry of a form, found by its key or by its file name (a spec is named by the file name, the key of a form in a subdirectory has the directory).
export const findForm = (availability: Availability, name: string): { key: string; entry: AvailabilityEntry } | undefined => {
  const key = name in availability.forms ? name : Object.keys(availability.forms).find((k) => k.endsWith('/' + name));
  return key === undefined ? undefined : { key, entry: availability.forms[key] };
};
