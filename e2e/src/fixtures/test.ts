import { expect, test as base } from '@playwright/test';
import type { PihemrFixtures, PihemrWorkerFixtures, PihemrWorkerOptions } from '../contract';
import { cleanupPatient, createPatient, createVisit, createVisitWithEncounter } from './commands';

// The `test` of the shared specs, and the one a config repo's own specs can use or extend (`test.extend(...)`). The config repo describes its site
// in `playwright.config.ts`: `use: { siteConfig: { getSite } }` (see PihemrWorkerOptions and README.md).
export const test = base.extend<PihemrFixtures, PihemrWorkerFixtures & PihemrWorkerOptions>({
  siteConfig: [
    {
      getSite: () => {
        throw new Error(
          'The site is not set: add `use: { siteConfig: { getSite } }` to playwright.config.ts (getSite returns the SiteSettings; see the README of @pih/pihemr-e2e)',
        );
      },
    },
    { option: true, scope: 'worker' },
  ],

  site: [
    async ({ siteConfig }, use) => {
      await use(siteConfig.getSite());
    },
    { scope: 'worker' },
  ],

  api: [
    async ({ playwright, site }, use) => {
      const ctx = await playwright.request.newContext({
        baseURL: `${site.api.baseUrl}/ws/rest/v1/`,
        httpCredentials: {
          username: site.api.username,
          password: site.api.password,
        },
      });

      await use(ctx);
    },
    { scope: 'worker' },
  ],

  // When a test fails, attaches what the browser saw of the server: every failed /openmrs request (such as the
  // `create visit: 400`), the form submit request and its response (the `errors` name the widget the server rejected),
  // the console errors and warnings, and the uuids of the API user's providers (a form without a provider cannot be saved). Declared
  // before failOnJsError so that it is torn down after it, when the test's status is final.
  attachDiagnostics: [
    async ({ context, api }, use, testInfo) => {
      const requests: Promise<string>[] = [];
      const consoleMessages: string[] = [];
      context.on('response', (response) => {
        const request = response.request();
        const isSubmit = request.method() === 'POST' && request.url().includes('/submit.action');
        if (response.status() < 400 && !isSubmit) {
          return;
        }
        requests.push(
          response
            .text()
            .catch(() => '(no body)')
            .then((body) => {
              const posted = isSubmit ? `\n  request: ${request.postData() ?? ''}` : '';
              return `${response.status()} ${request.method()} ${request.url()}${posted}\n  response: ${body.slice(0, 2000)}`;
            }),
        );
      });
      context.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          consoleMessages.push(`${message.type()} ${message.page()?.url() ?? ''}: ${message.text()}`);
        }
      });

      await use();

      if (testInfo.status === testInfo.expectedStatus) {
        return;
      }
      let user = '(not read)';
      try {
        const session = await (await api.get('session')).json();
        const providers = await (await api.get(`provider?user=${session.user.uuid}&v=custom:(uuid)`)).json();
        // uuids only: names are staff data and must not end up in logs or CI output
        user = `user ${session.user.uuid}, provider uuids: ${JSON.stringify(providers.results.map((p: { uuid: string }) => p.uuid))}`;
      } catch (e) {
        user = `(failed: ${e})`;
      }
      const body = [
        '== requests with an error status, and the form submit ==',
        ...(await Promise.all(requests)),
        '== console errors and warnings ==',
        ...consoleMessages,
        '== API user and its providers ==',
        user,
      ].join('\n');
      await testInfo.attach('server-diagnostics', { body, contentType: 'text/plain' });
    },
    { auto: true },
  ],

  allowedJsErrors: [[], { option: true }],

  // Fails every test on an uncaught JavaScript exception in any of its pages (including popups). Listening on the
  // context means a page that fails during navigation is covered too. console.error is not counted: a failed
  // request logs one too, and the forms log harmless ones.
  failOnJsError: [
    async ({ context, allowedJsErrors }, use) => {
      const errors: string[] = [];
      context.on('weberror', (webError) => {
        const error = webError.error();
        errors.push(`${webError.page()?.url() ?? '(no page)'}\n${error.stack || `${error.name}: ${error.message}`}`);
      });

      await use();

      expect(
        errors.filter((error) => !allowedJsErrors.some((allowed) => allowed.test(error))),
        'uncaught JavaScript errors in the page',
      ).toEqual([]);
    },
    { auto: true },
  ],

  createSectionEncounter: [
    async ({ api, site }, use) => {
      const created: string[] = [];

      await use(async (opts) => {
        const patient = await createPatient(api, site, opts.patient);
        created.push(patient.uuid);
        const encounter = await createVisitWithEncounter(api, site, patient.uuid, opts.encounterTypeUuid);
        return { patient, encounter };
      });

      for (const uuid of created) {
        await cleanupPatient(api, uuid);
      }
    },
    { scope: 'test' },
  ],

  createEntryContext: [
    async ({ api, site }, use) => {
      const created: string[] = [];

      await use(async (patientOpts) => {
        const patient = await createPatient(api, site, patientOpts);
        created.push(patient.uuid);
        const visitUuid = await createVisit(api, site, patient.uuid);
        return { patient, visitUuid };
      });

      for (const uuid of created) {
        await cleanupPatient(api, uuid);
      }
    },
    { scope: 'test' },
  ],
});

export { expect } from '@playwright/test';
