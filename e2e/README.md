# @pih/pihemr-e2e

Playwright specs for forms that are defined in pihemr, written once and run from each config repo (`zl-emr`, `pihsl-emr`, ...) against that
site's server. The specs do not run from here: this package has no `playwright.config.ts` and no server to point at.

| Path | What |
|---|---|
| `src/specs/<form>.spec.ts` | One spec: an ordinary spec file (`test.describe(...)`) that imports `test` from `../fixtures/test`. |
| `src/fixtures/test.ts` | The `test` with all the fixtures: `api`, `createSectionEncounter`, `createEntryContext`, `attachDiagnostics`, `failOnJsError`, `allowedJsErrors`, `site`. |
| `src/fixtures/commands.ts` | The REST commands behind them: create a patient, visit and encounter, and void it all afterwards (`cleanupPatient`; nothing is purged). |
| `src/contract.ts` | `SiteSettings`, `PihemrWorkerOptions` and the fixture types. |
| `src/include-specs.ts` | `includeSpecs()`: how a config repo takes the specs into its run (step 4 below). |
| `src/availability.ts` | `loadAvailability()`: reads the config repo's `_availability.e2e.json` (which forms each profile offers, below). **Loads no Playwright code** either. |
| `src/spec-facts.ts` | `specFacts(site, '<spec>')`: what a spec needs to know about the site beyond `SiteSettings` (below). |
| `src/site.ts` | What a config needs to describe its site (the types). **Loads no Playwright code**, see below. |
| `src/pages/`, `src/rest.ts` | Page objects (section / entry form, VIEW, visit page, registration summary, form widgets, provider select, shell-form helpers) and REST reads and writes (`getPatientEncounters`, `getEncounterObs`, `getEncounterHeader`, `addObs`, `getLocationName`) that behave the same on every site. The config repos re-export them from their own `pages/index.ts` and `commands/index.ts`. |
| `src/encounter-types.ts` | The encounter types of the forms pihemr defines (metadata of pihemr's own content, the same on every site). |

What a config repo provides is its **site**: `SiteSettings`. It is all data: the REST user, the identifier type and the idgen identifier source that
issues a test patient's identifier, the visit and session locations, the provider name. The harness never makes up an identifier: it asks the server's
identifier source for one (and a test fails when the server does not issue one), so it always has the format the site's identifier type expects.
A spec only declares which fixtures it needs; it never names a site's uuid.

| `playwright.config.ts`, `global-setup.ts`, `src/site-from-env.ts` | For running the specs from here (next section): the config, the login step, and the site read from `.env` (samples: `zl.env`, `sierra-leone.env`). |

## Running the specs from pihemr (for anyone, in VS Code)

You need Node 22+ and the **Playwright Test for VS Code** extension. Once:

1. In VS Code, *File → Open Folder…* and choose `pihemr/e2e`. (Open this folder, not the whole repo, so that the config and the specs are one workspace.)
2. In a terminal there: `npm install`, then `npx playwright install chromium`.
3. Copy the sample of your site to `.env`: `zl.env` (Haiti) or `sierra-leone.env`. It has the site's metadata filled in; set the server's URL, the user and
   password, and the provider name. **Use a server with test data only**: the tests create synthetic patients ("AutoE Tester", ...) and void them afterwards.

Then open the *Testing* sidebar (the flask icon). It lists the specs; click the play button next to a test or a spec, or the green play button in the
gutter next to a `test(...)` in the spec file. Tick *Show browser* at the bottom of the sidebar to watch it run. A failure shows the reason in the
Test Results panel, and a trace and a video are kept for failed tests. On a slow server, set `E2E_TIMEOUT_FACTOR=3` in `.env`.

From a terminal, `npm test` runs everything and `npx playwright test -g "part of a test title"` runs some.

To add a site, add a sample `<site>.env` next to these with its metadata: the identifier type and its idgen identifier source (`GET idgen/identifiersource`
on the server lists them), a location with the Visit Location tag, and the session location. The config repos still hold their own copy of these uuids in
`core/constants.ts`.

The same tests are also listed by the extension when you open a config repo (`zl-emr/e2e`, `pihsl-emr/e2e`), under `specs/shared/shared.spec.ts`;
each test reports its location in the spec file in pihemr, which opens when you click it.

## Using the specs from a config repo

1. Add the dependency. Until it is published, a sibling checkout works (it must be the pihemr version that the repo's `distro/pom.xml` pins):

   ```json
   "devDependencies": { "@pih/pihemr-e2e": "file:../../pihemr/e2e" }
   ```

2. Make `@playwright/test` resolve to **the repo's own copy**, from the shared files too. `npm` links a `file:` dependency, and Node resolves a
   linked file by its real path, so without this the shared code either cannot find `@playwright/test` or loads a second copy
   (`Requiring @playwright/test second time`). In the repo's `e2e/tsconfig.json`:

   ```json
   "compilerOptions": { "paths": { "@playwright/test": ["./node_modules/@playwright/test"] } }
   ```

   and in `playwright.config.ts`, so that the mapping applies to files outside the repo as well (needs Playwright 1.44+):

   ```ts
   export default defineConfig({ tsconfig: './tsconfig.json', /* ... */ });
   ```

3. Describe the site and hand it over in `playwright.config.ts`. Write the settings in a module of the repo, `core/site.ts`:

   ```ts
   import type { SiteSettings } from '@pih/pihemr-e2e/src/site';

   export const getSite = (): SiteSettings => ({
     api: { baseUrl: process.env.E2E_BASE_URL!, username: process.env.E2E_USER_ADMIN_USERNAME!, password: process.env.E2E_USER_ADMIN_PASSWORD! },
     patientIdentifier: { typeUuid: '<identifier type uuid>', sourceUuid: '<uuid of the idgen identifier source that issues it>' },
     visitLocationUuid: '<a location with the Visit Location tag>',
     sessionLocationUuid: '<the session location of the run>',
     defaultProviderName: process.env.E2E_DEFAULT_PROVIDER_NAME,
   });
   ```

   and pass it in the config. The function is wrapped in `siteConfig` on purpose: Playwright takes a bare function given as an option for a
   fixture function. It is called once per worker, when a test first needs the site, so a setting that is missing from the environment fails that
   test and does not break `playwright test --list`:

   ```ts
   import type { PihemrWorkerOptions } from '@pih/pihemr-e2e/src/site';
   import { getSite } from './core/site';

   const config: PlaywrightTestConfig<{}, PihemrWorkerOptions> = {
     use: { siteConfig: { getSite }, /* ... */ },
   };
   ```

   **Facts for specs that depend on the site.** A spec for a form that sits under different parent encounters per site, or that needs a drug that exists in the
   site's formulary, reads them from `specs` in the site settings (typed in `SiteSpecFacts`, `src/contract.ts`), for example:

   ```ts
   specs: {
     'section-chief-complaint': { parents: [{ name: 'outpatient followup', encounterTypeUuid: OUTPATIENT_FOLLOWUP_ENCOUNTER_TYPE_UUID }] },
     'section-prescriptions-print': { parent: { name: '...', encounterTypeUuid: '...' }, drugs: ['Acetazolamide', 'Amoxicillin'], planFormMedication: 'Acetazolamide, 250mg tablet' },
     admissionNote: { ward: 'Sal Gason', otherWard: 'Sal Fanm' },   // Admission Location wards; `ward` has a wristband printer
     edNote: { location: 'Ijans' },                                 // the one location with the ED Note Location tag
     drugOrder: { drug: 'Paracetamol, 500mg tablet' },              // a formulary drug as the medication widget lists it (also 'section-obgyn-plan', 'section-oncology-plan')
   },
   ```

   The name of the session location (what a form's location select shows for `sessionLocationUuid`) is not a fact: a spec asks the server (`getLocationName(api, site.sessionLocationUuid)`).
   The encounter types of the forms pihemr defines are not facts either: they are the same everywhere and are in `src/encounter-types.ts`.

   A site that does not give a spec's facts either leaves the spec out (`includeSpecs({ except: [...] })`) or fails it with a message that says which fact is missing.
   What is the site's alone (the sections its visit page lists for a parent, say) stays in a spec of the repo.

   **Import `@pih/pihemr-e2e/src/site` from the config and from what the config imports, never the package root.** The `tsconfig` option of step 2
   takes effect only after the config has loaded, so a runtime import of anything that reaches `@playwright/test` fails there with "Cannot find module
   '@playwright/test'". `src/site.ts` loads none; `import type` is erased, so types may come from anywhere.

4. Take the specs into the repo's run with one file in its `testDir` (Playwright and the VS Code extension find tests only in the files of the
   `testDir`, so this is the file that brings the shared ones there):

   ```ts
   // e2e/specs/shared/shared.spec.ts
   import { includeSpecs } from '@pih/pihemr-e2e/src/include-specs';

   includeSpecs();                                   // every spec in the package
   // includeSpecs({ except: ['somethingThisSiteLacks'] });   // all but some
   // includeSpecs({ only: ['patientRegistration-rs'] });     // only some
   ```

   Specs are named by their file without `.spec.ts`. A spec added to the package runs in every repo that calls `includeSpecs()` without `only`, with no
   change in the repo, **unless the site does not offer the spec's form** (next paragraph); a name that matches no spec is an error, so a renamed spec does not drop out of a run unnoticed. Tests report their location in the
   shared file, and appear in the Testing sidebar under `specs/shared/shared.spec.ts`. The repo keeps its single `chromium` project.

   **Which forms the site offers.** Most forms of pihemr exist on every server (the htmlforms of pihemr are merged into every distro), but each site offers only some
   of them to a user: a form is reachable only when the site's app configuration, the user's privileges, the session location's tags and the patient fit. The
   site says which in `documentation/_availability.e2e.json` next to its `_availability.e2e.md` (the skill `hfe-e2e-specs.skill.md`, section "The same findings as
   data", says how it is written and checked; `inventory.py --write-availability-json` makes a first version). It lists, per *profile* (a way the site is
   deployed: Harper or Pleebo, KGH or Wellbody, ...), whether each form is offered. `includeSpecs()` reads it, and skips a spec whose form (the file name the
   spec is named after) the profile of the run does not offer; the skip is listed in the report with the reason, so a site needs no `except` list for the
   specs of forms it does not have. The profile is `E2E_PROFILE`, else the file's `defaultProfile`. A form the file does not mention, or does not say for the
   profile, runs. `includeSpecs({ runUnoffered: ['<spec>'] })` runs one anyway. A repo with no JSON skips nothing. The file is found at
   `../content/configuration/backend_configuration/pih/htmlforms/documentation/_availability.e2e.json` from the directory the run starts in (`e2e/`);
   `E2E_AVAILABILITY_FILE` names another.

   The spec `form-reachability` checks the data against the real app. For each form that the JSON says the profile offers as a visit action, it logs in at a
   location that carries the form's session tag (with its own login, so the shared one is not touched), opens the visit page of a new patient with an active visit,
   and expects the form in the visit-actions menu, no form that the JSON says is not offered, and the click on the action to arrive at the form. So the JSON
   cannot drift from what users get without a test failing.

5. In the repo's own specs, use the same `test` and `expect`: `export { test, expect } from '@pih/pihemr-e2e'` in `core/test.ts`. Extend it with
   `test.extend(...)` for anything that is only this repo's.

## Adding a spec

Write it in `src/specs/<form>.spec.ts` like any Playwright spec, importing `test` and `expect` from `../fixtures/test`, and ask only for fixtures
that exist there. When a spec needs a fact about the site, first try to read it from the server (as `getEncounterLocation` does); add a field to
`SiteSettings` only when the server cannot tell. Run `npm install && npm run typecheck` in this directory.
