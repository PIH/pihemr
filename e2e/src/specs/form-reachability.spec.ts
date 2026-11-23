import type { APIRequestContext, Page } from '@playwright/test';
import { currentProfile, findForm, loadAvailability, type VisitActionEntry } from '../availability';
import { birthdateDaysAgo, birthdateYearsAgo } from '../fixtures/commands';
import { expect, test } from '../fixtures/test';

// Is each form that the site's availability data (`_availability.e2e.json`) says a profile offers as a visit action really offered on that profile's
// server, on the real visit page? The form specs open a form by its URL, which skips every condition that decides whether a user can get there (the app's
// component flags, the privilege, the location tag, the patient's age and sex); this is the check that the data the skipping rests on is true.
//
// For each form with `entry.kind: 'visit-action'` that the profile of the run offers, the test
//   1. logs in at a location that carries the form's `sessionTag` (its own login: the session location is part of the server-side session, so
//      changing it in the shared login would change it for the specs running in parallel),
//   2. opens the visit page of a new synthetic patient (the sex and age of `entry.patient`) with an active visit,
//   3. expects the visit-actions menu to list the form, and no form that the data says the profile does not offer,
//   4. clicks the action and expects to arrive at the form.
// Nothing is skipped by this spec; it declares no test when the repo has no availability data.

const availability = loadAvailability();

// The files of the forms that the visit actions point at, read from the action objects of the menu (their url names `.../htmlforms/<form>.xml`).
const FORM_OF_ACTION = /\/htmlforms\/(.+?)\.xml/;

const visitActions = (page: Page) =>
  page.locator('#visit-actions-dropdown li').evaluateAll((items) =>
    items.map((item) => {
      // The action objects live on the AngularJS scope of each menu item.
      const action = (window as unknown as { angular: { element: (e: Element) => { scope: () => { action?: { url?: string } } } } }).angular.element(item).scope().action;
      return { id: item.id, url: action?.url ?? '' };
    }),
  );

// A location that carries the tag, by REST.
const locationWithTag = async (api: APIRequestContext, tagName: string): Promise<string> => {
  const tags = (await (await api.get(`locationtag?q=${encodeURIComponent(tagName)}&v=custom:(uuid,name)`)).json()).results as { uuid: string; name: string }[];
  const tag = tags.find((t) => t.name === tagName);
  expect(tag, `the server has no location tag "${tagName}"`).toBeTruthy();
  const locations = (await (await api.get(`location?tag=${tag!.uuid}&v=custom:(uuid,name)&limit=1`)).json()).results as { uuid: string }[];
  expect(locations.length, `no location carries the tag "${tagName}": the form cannot be offered here`).toBeGreaterThan(0);
  return locations[0].uuid;
};

if (availability) {
  const profile = currentProfile(availability);

  test.describe(`form-reachability (profile ${profile})`, () => {
    // Each test loads a heavy visit page after a login of its own, and a CI server under 4 workers sometimes does not render it in time (seen on kgh-ci and
    // zl-ci: the actions button missing after 45 s, or the login timing out; the same test passes alone). A wrong claim in the JSON fails every time, so one retry
    // hides only that.
    test.describe.configure({ retries: 1 });

    for (const [key, form] of Object.entries(availability.forms)) {
      if (form.entry?.kind !== 'visit-action' || form.offered[profile] !== true) {
        continue;
      }
      const entry: VisitActionEntry = form.entry;
      const who = `${entry.patient?.gender ?? 'F'}, ${entry.patient?.ageDays !== undefined ? `${entry.patient.ageDays} days` : `${entry.patient?.ageYears ?? 30} years`}`;

      test(`${key}: the visit page offers it${entry.sessionTag ? ` at a ${entry.sessionTag}` : ''} to a patient (${who})`, async ({ playwright, browser, site, api, createEntryContext }) => {
        test.slow(); // creates a patient, logs in, loads the visit page and then the form: well over 30 s on a CI server under 4 workers
        const sessionLocation = entry.sessionTag ? await locationWithTag(api, entry.sessionTag) : site.sessionLocationUuid;
        const ctx = await createEntryContext({
          givenName: 'AutoReach',
          familyName: 'Tester',
          gender: entry.patient?.gender ?? 'F',
          birthdate: entry.patient?.ageDays !== undefined ? birthdateDaysAgo(entry.patient.ageDays) : birthdateYearsAgo(entry.patient?.ageYears ?? 30),
        });

        // The user's own login, at the session location of the test (what global-setup does once for everyone, at the site's session location).
        // The empty storage state matters: the test runner gives `playwright.request.newContext()` the config's `storageState` (the shared login), and the login
        // below would then change the session location of the shared login, for every spec running in parallel.
        const login = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
        const token = Buffer.from(`${site.api.username}:${site.api.password}`).toString('base64');
        const res = await login.post(`${site.api.baseUrl}/ws/rest/v1/session`, {
          data: { locale: 'en', sessionLocation },
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}` },
          timeout: 60_000,
        });
        expect(res.ok(), `login at ${entry.sessionTag ?? 'the session location'}: ${res.status()}`).toBeTruthy();
        const browserContext = await browser.newContext({ storageState: await login.storageState() });
        await login.dispose();

        try {
          const page = await browserContext.newPage();
          await page.goto(`${site.api.baseUrl}/pihcore/visit/visit.page?visit=${ctx.visitUuid}`);
          await expect(page.locator('#visit-actions-button')).toBeVisible({ timeout: 45_000 });
          await page.locator('#visit-actions-button').click();

          // The menu fills in after the visit has loaded: wait for this form's action, then look at the whole list.
          await expect
            .poll(async () => (await visitActions(page)).map((a) => FORM_OF_ACTION.exec(a.url)?.[1]), {
              message: `the visit actions at ${entry.sessionTag ?? 'the session location'} for a patient (${who}) do not include ${key}.xml, which _availability.e2e.json says profile ${profile} offers`,
              timeout: 20_000,
            })
            .toContain(key);
          const actions = await visitActions(page);

          const unexpected = actions
            .map((a) => FORM_OF_ACTION.exec(a.url)?.[1])
            .filter((shown): shown is string => !!shown)
            .filter((shown) => {
              const shownForm = findForm(availability, shown);
              return shownForm?.entry.offered[profile] === false;
            });
          expect(unexpected, `the visit page offers forms that _availability.e2e.json says profile ${profile} does not`).toEqual([]);

          const action = actions.find((a) => FORM_OF_ACTION.exec(a.url)?.[1] === key)!;
          await page.locator(`#visit-actions-dropdown li[id="${action.id}"]`).click();
          await page.waitForURL((url) => url.href.includes(`/htmlforms/${key}.xml`));
          await expect(page.locator('body')).not.toContainText(/Internal Server Error|HTTP Status [45]\d\d|Page not found/);
        } finally {
          await browserContext.close();
        }
      });
    }
  });
}
