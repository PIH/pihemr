import * as path from 'path';
import { request } from '@playwright/test';
import { siteFromEnv } from './src/site-from-env';

export const STORAGE_STATE = path.resolve(__dirname, 'storageState.json');

// Logs the browser in once, as the REST user of the site, with the site's session location (the HTML Form Entry UI needs one), and saves the session.
async function globalSetup() {
  const site = siteFromEnv();
  const requestContext = await request.newContext();
  const token = Buffer.from(`${site.api.username}:${site.api.password}`).toString('base64');

  const res = await requestContext.post(`${site.api.baseUrl}/ws/rest/v1/session`, {
    data: { locale: 'en', sessionLocation: site.sessionLocationUuid },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${token}`,
    },
  });

  if (!res.ok()) {
    throw new Error(
      `Login to ${site.api.baseUrl} failed (${res.status()}): check E2E_BASE_URL, E2E_USER_ADMIN_USERNAME and E2E_USER_ADMIN_PASSWORD in .env, and that the server is running`,
    );
  }

  await requestContext.storageState({ path: STORAGE_STATE });
  await requestContext.dispose();
}

export default globalSetup;
