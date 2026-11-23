import type { APIRequestContext } from '@playwright/test';

// What a shared spec asks of the config repo that runs it. The fixtures are implemented once, in fixtures/test.ts
// (`test`); the config repo only describes its site (`SiteSettings`) and hands it over with `use: { getSite }`.

export interface CreatePatientOptions {
  givenName?: string;
  familyName?: string;
  gender?: 'M' | 'F';
  birthdate?: string;
}

export interface TestPatient {
  uuid: string;
  person: { uuid: string; gender: string; birthdate: string };
}

export interface TestEncounter {
  uuid: string;
  visitUuid: string;
}

export interface SectionEncounterOptions {
  encounterTypeUuid: string;
  patient?: CreatePatientOptions;
}

export interface SectionEncounter {
  patient: TestPatient;
  encounter: TestEncounter;
}

export interface EntryContext {
  patient: TestPatient;
  visitUuid: string;
}

// Everything that differs between sites: the REST user and the metadata uuids. It is all data. The harness never makes up a patient identifier:
// the server's own identifier source issues it (see `patientIdentifier`), so it always has the format the site's identifier type expects.
export interface SiteSettings {
  // The REST API of the server under test, as the harness user.
  api: {
    // The server's context path, e.g. `http://localhost:7070/openmrs` (no trailing slash). The REST path is added.
    baseUrl: string;
    username: string;
    password: string;
  };
  // The identifier every synthetic patient gets, as its preferred identifier. It is created at the visit location.
  patientIdentifier: {
    typeUuid: string;
    // The idgen identifier source that issues it (POST idgen/identifiersource/<uuid>/identifier): the source the site registers patients from, or a
    // sequential generator of the identifier type. A test fails when the server does not issue an identifier.
    sourceUuid: string;
  };
  // A location that has the Visit Location tag: visits are started here.
  visitLocationUuid: string;
  // The session location of the run (the one global-setup logs in with): the location of the encounters the harness creates.
  sessionLocationUuid: string;
  // The visit type of the visits the harness starts (default: "Clinic or Hospital Visit").
  visitTypeUuid?: string;
  // Display name of the provider that the harness user acts as, as listed in a form's provider select. When a form does
  // not list it, the first provider is chosen instead.
  defaultProviderName?: string;
  // The fewest locations tagged "Registration Location" that the site's registration forms must offer (default 1).
  minRegistrationLocations?: number;
  // What only some shared specs need to know about the site, by spec name (see SiteSpecFacts). A spec that needs a fact the site does not give fails
  // with a message that says which one.
  specs?: SiteSpecFacts;
}

// An encounter type that a section form is part of at this site: the shared specs of a section form create the parent encounter over REST and open the
// section's edit URL, so they need to know which parents the site has. `name` is for the test titles.
export interface ParentEncounter {
  name: string;
  encounterTypeUuid: string;
}

export interface SiteSpecFacts {
  // `pihcore-chief-complaint` is a section of these encounter types (their visit-page entries; encounterTypeConfig.js). Every test runs under each.
  'section-chief-complaint'?: { parents: ParentEncounter[] };
  // `parent` is an encounter type with the `pihcore-plan` section, which the print icon belongs to. `drugs` are the names of two drugs that exist in the
  // site's formulary (searched with `drug?q=`); `planFormMedication` is the label of a medication the section-plan form offers, as its widget lists it.
  // `pihcore-review-of-systems` is a section of this encounter type (its visit-page entry; encounterTypeConfig.js). The tests open the section's edit URL on
  // an encounter of that type.
  'section-review-of-systems'?: { parent: ParentEncounter };
  'section-prescriptions-print'?: { parent: ParentEncounter; drugs: [string, string]; planFormMedication: string };
  // The Admission Location wards of the site (the ward select of admissionNote.xml, and of the Admission disposition of a consult): `ward` has a wristband printer,
  // so Save asks "Print wristband?"; `otherWard` does not need to differ in anything but its name.
  admissionNote?: { ward: string; otherWard: string };
  // The one location with the ED Note Location tag (the location select of edNote.xml starts empty and lists only it).
  edNote?: { location: string };
  // A drug of the site's formulary, as the form's medication widget lists and saves it ("Paracetamol, 500mg tablet"). Each spec of a form that orders drugs
  // names its own fact so that a site can differ per form.
  drugOrder?: { drug: string };
  'section-obgyn-plan'?: { drug: string };
  'section-oncology-plan'?: { drug: string };
}

export interface PihemrFixtures {
  // Auto fixture: when the test fails, attaches what the server answered (see its definition).
  attachDiagnostics: void;
  // Auto fixture: fails the test on any uncaught JavaScript error in its pages.
  failOnJsError: void;
  // Uncaught JavaScript errors that failOnJsError tolerates: each pattern is tested against "<page url>\n<stack>". For an error a spec documents as a bug of
  // the form that cannot be avoided in the UI it opens; keep the pattern as narrow as possible. Set it with `test.use({ allowedJsErrors: [...] })`.
  allowedJsErrors: RegExp[];
  // Creates a synthetic patient with a visit and an empty encounter of the given type. Everything it creates is voided after the test (see cleanupPatient).
  createSectionEncounter: (opts: SectionEncounterOptions) => Promise<SectionEncounter>;
  // Creates a synthetic patient with an active visit and no encounter, for the entry forms that create the encounter themselves. Everything it creates is
  // voided after the test.
  createEntryContext: (patient?: CreatePatientOptions) => Promise<EntryContext>;
}

export interface PihemrWorkerFixtures {
  // The settings of the site under test, from `getSite`.
  site: SiteSettings;
  // REST client of the harness user, with baseURL .../ws/rest/v1/
  api: APIRequestContext;
}

// Set by the config repo in its playwright.config.ts: `use: { siteConfig: { getSite } }`. The shared specs read the site from it.
// It is an object around the function on purpose: Playwright takes a function given as an option (its default or a `use` value) for a fixture
// function, and would call it with the fixtures instead of handing it over.
export interface PihemrWorkerOptions {
  siteConfig: {
    // Returns the settings of the site under test. It is called once per worker, when a test first needs the site, not when the config loads: a
    // setting read from the environment (a missing E2E_BASE_URL, say) then fails the test that needs it and does not stop `playwright test --list`.
    getSite: () => SiteSettings;
  };
}
