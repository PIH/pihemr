import * as fs from 'fs';
import * as path from 'path';
import { currentProfile, findForm, loadAvailability } from './availability';
import { test } from './fixtures/test';

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

function specNames(dir: string, prefix = ''): string[] {
  const names: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      names.push(...specNames(path.join(dir, entry.name), prefix + entry.name + '/'));
    } else if (entry.name.endsWith('.spec.ts')) {
      names.push(prefix + entry.name.slice(0, -'.spec.ts'.length));
    }
  }
  return names;
}

/**
 * Registers the specs of this package in the file that calls it. Call it from a `*.spec.ts` file in the config repo's `testDir`: Playwright
 * and the VS Code extension find tests only in the files of the `testDir`, and this is the one file that takes the shared specs there.
 *
 *   // e2e/specs/shared/shared.spec.ts
 *   import { includeSpecs } from '@pih/pihemr-e2e/src/include-specs';
 *   includeSpecs();   // or includeSpecs({ except: ['somethingThisSiteLacks'] })
 *
 * A spec added to the package runs in every repo that calls this without `only`, unless the site's `_availability.e2e.json` says that the profile of the
 * run (`E2E_PROFILE`, else the JSON's `defaultProfile`) does not offer the spec's form (the spec is named by the form's file name): it is then skipped, and
 * the skip is listed in the report with the reason. A form the JSON does not mention, or does not say for the profile, runs. A name that matches no spec is an
 * error, so that a renamed or misspelled spec does not drop out of a run unnoticed.
 */
export function includeSpecs(options: IncludeSpecsOptions = {}): void {
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
      test.describe(name, () => {
        test.skip(unoffered, () => {});
      });
      continue;
    }
    require(path.join(specsDir, name + '.spec.ts'));
  }
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
