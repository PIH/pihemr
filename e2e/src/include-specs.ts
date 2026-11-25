import * as fs from 'fs';
import * as path from 'path';
import { currentProfile, findForm, loadAvailability, setAvailabilityStartDir } from './availability';
import { test } from '@playwright/test';

export interface IncludeSpecsOptions {
  /** Run only these specs, named by their file without `.spec.ts` (`patientRegistration-rs`). */
  only?: string[];
  /** Run every spec but these. */
  except?: string[];
  /**
   * Run a spec even when the site's availability data (`_availability.e2e.json`) says the profile of the run does not offer its form. By default a spec
   * is skipped then, with the reason in its title, so a site needs no `except` list for the forms it does not have.
   */
  runUnoffered?: string[];
}

const specsDir = path.join(__dirname, 'specs');

// The spec files are `.spec.ts` when the package is used from its source (a checkout of pihemr, linked with `file:`), and `.spec.js` (next to `.spec.d.ts`
// and `.spec.js.map`) in the published package, which holds the compiled output: Playwright does not compile files under node_modules.
const SPEC_FILE = /\.spec\.(ts|js)$/;
const isSpecFile = (file: string): boolean => SPEC_FILE.test(file) && !file.endsWith('.d.ts');

function specNames(dir: string, prefix = ''): string[] {
  const names: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      names.push(...specNames(path.join(dir, entry.name), prefix + entry.name + '/'));
    } else if (isSpecFile(entry.name)) {
      names.push(prefix + entry.name.replace(SPEC_FILE, ''));
    }
  }
  return names;
}

// The file of the spec `name`, whichever of the two forms the package is in.
const specFile = (name: string): string => {
  const base = path.join(specsDir, name);
  return fs.existsSync(base + '.spec.ts') ? base + '.spec.ts' : base + '.spec.js';
};

/**
 * Registers the specs of this package in the file that calls it. Call it from a `*.spec.ts` file in the config repo's `testDir`: Playwright
 * and the VS Code extension find tests only in the files of the `testDir`, and this is the one file that takes the shared specs there.
 *
 *   // e2e/specs/shared/pihemr.spec.ts
 *   import { includeSpecs } from '@pih/pihemr-e2e/src/include-specs';
 *   includeSpecs();   // or includeSpecs({ except: ['somethingThisSiteLacks'] })
 *
 * A spec added to the package runs in every repo that calls this without `only`, unless the site's `_availability.e2e.json` says that the profile of the
 * run (`E2E_PROFILE`, else the JSON's `defaultProfile`) does not offer the spec's form (the spec is named by the form's file name): it is then skipped, and
 * the skip is listed in the report with the reason. A form the JSON does not mention, or does not say for the profile, runs. A name that matches no spec is an
 * error, so that a renamed or misspelled spec does not drop out of a run unnoticed.
 */
export function includeSpecs(options: IncludeSpecsOptions = {}): void {
  // The config repo's JSON is found from the file that calls this (its parent module), whatever the working directory is.
  setAvailabilityStartDir(path.dirname(module.parent?.filename ?? process.cwd()));
  const all = specNames(specsDir);
  for (const name of [...(options.only ?? []), ...(options.except ?? []), ...(options.runUnoffered ?? [])]) {
    if (!all.includes(name)) {
      throw new Error(`includeSpecs: there is no spec "${name}" in @pih/pihemr-e2e. The specs are: ${all.join(', ')}`);
    }
  }
  for (const name of all) {
    if (options.only && !options.only.includes(name)) {
      continue;
    }
    if (options.except?.includes(name)) {
      continue;
    }
    const unoffered = options.runUnoffered?.includes(name) ? undefined : notOffered(name);
    if (unoffered) {
      // One placeholder in the list, so that the skip is visible. It is a test that runs (it needs no fixtures: no browser, no site settings) and skips
      // itself, and not a test declared as skipped: a declared skip never runs, so it reports no output and nothing says why, in the VS Code extension
      // as well as in the terminal. This one prints the reason, and it is the skip's annotation in the report.
      test.describe(name, () => {
        // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern as the first argument
        test(unoffered, async ({}, testInfo) => {
          const others = profilesOffering(name);
          const elsewhere = others.length ? `set E2E_PROFILE to one that offers it (${others.join(', ')}), or ` : '';
          console.log(`${unoffered}\nTo run it anyway: ${elsewhere}includeSpecs({ runUnoffered: ['${name}'] }) in the spec file that calls it.`);
          testInfo.skip(true, unoffered);
        });
      });
      continue;
    }
    require(specFile(name));
  }
}

// The profiles of the site that offer the form `name` (for the hint a skipped spec prints).
function profilesOffering(name: string): string[] {
  const availability = loadAvailability();
  const form = availability && findForm(availability, name);
  if (!availability || !form) {
    return [];
  }
  return Object.keys(availability.profiles).filter((profile) => form.entry.offered[profile] !== false);
}

// The reason to skip the spec of the form `name`, when the site's availability data says the profile of the run does not offer it.
function notOffered(name: string): string | undefined {
  const availability = loadAvailability();
  const form = availability && findForm(availability, name);
  if (!availability || !form) {
    return undefined;
  }
  const profile = currentProfile(availability);
  if (form.entry.offered[profile] !== false) {
    return undefined;
  }
  const why = form.entry.reason ? `: ${form.entry.reason}` : '';
  return `not run: profile ${profile} does not offer ${form.key}.xml${why} (_availability.e2e.json)`;
}
