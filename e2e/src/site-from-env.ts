import type { SiteSettings } from './contract';

// The site settings for running the specs from pihemr itself (playwright.config.ts here), read from the environment (the `.env` file of this directory,
// loaded by playwright.config.ts). A config repo (zl-emr, pihsl-emr, ...) describes its site itself, in its core/site.ts, and does not use this.
// Loads no Playwright code.
//
// Start from the sample of the site: `zl.env` (Haiti) or `sierra-leone.env` have the metadata of that site's configuration filled in. Copy one to `.env` and
// add the server and the user.
//   E2E_BASE_URL                         e.g. http://localhost:7070/openmrs
//   E2E_USER_ADMIN_USERNAME / E2E_USER_ADMIN_PASSWORD
//   E2E_PATIENT_IDENTIFIER_TYPE_UUID     the identifier type every test patient gets (ZL EMR ID, KGH EMR ID, ...)
//   E2E_PATIENT_IDENTIFIER_SOURCE_UUID   the idgen identifier source that issues it: a test patient's identifier comes from the server, never from the harness
//   E2E_VISIT_LOCATION_UUID              a location with the Visit Location tag: visits are started here
//   E2E_SESSION_LOCATION_UUID            a Login Location that carries the tags the forms need: the location of the run
//   E2E_DEFAULT_PROVIDER_NAME            optional: the provider the forms select (the first one is chosen when it is not listed)
//   E2E_MIN_REGISTRATION_LOCATIONS       optional: the fewest locations tagged "Registration Location" the registration forms must offer (default 1)
const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set: copy zl.env or sierra-leone.env to .env and fill it in (see README.md)`);
  }
  return value;
};

export const siteFromEnv = (env: NodeJS.ProcessEnv = process.env): SiteSettings => {
  const minRegistrationLocations = env.E2E_MIN_REGISTRATION_LOCATIONS;
  return {
    api: {
      baseUrl: required(env, 'E2E_BASE_URL').replace(/\/+$/, ''),
      username: required(env, 'E2E_USER_ADMIN_USERNAME'),
      password: required(env, 'E2E_USER_ADMIN_PASSWORD'),
    },
    patientIdentifier: {
      typeUuid: required(env, 'E2E_PATIENT_IDENTIFIER_TYPE_UUID'),
      sourceUuid: required(env, 'E2E_PATIENT_IDENTIFIER_SOURCE_UUID'),
    },
    visitLocationUuid: required(env, 'E2E_VISIT_LOCATION_UUID'),
    sessionLocationUuid: required(env, 'E2E_SESSION_LOCATION_UUID'),
    defaultProviderName: env.E2E_DEFAULT_PROVIDER_NAME || undefined,
    minRegistrationLocations: minRegistrationLocations ? Number(minRegistrationLocations) : undefined,
  };
};
