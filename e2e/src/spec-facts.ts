import type { SiteSettings, SiteSpecFacts } from './contract';

// The facts a shared spec needs about the site (SiteSettings.specs). A site that does not give them cannot run the spec: leave the spec out with
// `includeSpecs({ except: [...] })`, or add the facts to the site's core/site.ts.
export const specFacts = <K extends keyof SiteSpecFacts>(site: SiteSettings, spec: K): NonNullable<SiteSpecFacts[K]> => {
  const facts = site.specs?.[spec];
  if (!facts) {
    throw new Error(`This site does not say what the spec "${spec}" needs to know: add specs['${spec}'] to getSite() (core/site.ts), or leave the spec out with includeSpecs({ except: ['${spec}'] }).`);
  }
  return facts as NonNullable<SiteSpecFacts[K]>;
};
