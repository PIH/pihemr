// Everything a config repo needs to *describe its site* from `playwright.config.ts` and the modules the config imports (core/site.ts): the types.
//
// This entry loads no Playwright code, and has to stay that way. The config's `tsconfig` option (which maps `@playwright/test` to the config repo's own
// copy for the shared files) only takes effect after the config has been loaded, so anything the config imports at runtime that reaches
// `@playwright/test` from here fails with "Cannot find module '@playwright/test'". Import the package root (`@pih/pihemr-e2e`) only from specs and
// from files that only specs import. `import type` is erased, so types may come from anywhere.
export * from './contract';
