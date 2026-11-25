import { type Locator, type Page, expect } from '@playwright/test';
import { visitPagePath } from './visit-urls';

// The visit page, where a form sends the browser after a successful save (see EntryFormPage and SectionFormPage), and
// where users read what was saved: one <encounter> per encounter, each with <encounter-section> children for the
// multi-section forms. Everything is collapsed on load; an entry's "expand" link loads its long view.
// What an entry's expand link is, and where its long view sits. An <encounter> holds its own view in div.visit-element
// and its sections after it, so the selectors start at that div ("> .visit-element") to not pick up a section's.
const OWN_ELEMENT = ':scope > .visit-element';
const LONG_VIEW = `${OWN_ELEMENT} .encounter-summary-long`;

// Marks (data-e2e-view) the <encounter> or <encounter-section> element that shows the form's VIEW of the encounter: the one
// whose templateModelUrl (visit.js: getAsHtml.action) names this form file (or has no definitionUiResource, so that it renders
// the form the encounter was saved with) and whose encounter is this one. Read from the
// Angular scopes; the visit page runs with debug info on. Returns what it saw when nothing matches.
const markViewElement = (page: Page, encounterUuid: string, formFile: string) =>
  page.evaluate(
    ({ encounterUuid, formFile }) => {
      type Scope = { encounter?: { uuid: string; form?: unknown }; section?: { id?: string; templateModelUrl?: string }; templateModelUrl?: () => string };
      const ng = (window as unknown as { angular: { element: (e: Element) => { isolateScope: () => Scope | undefined } } }).angular;
      document.querySelectorAll('[data-e2e-view]').forEach((e) => e.removeAttribute('data-e2e-view'));
      const seen: string[] = [];
      let found = false;
      document.querySelectorAll('encounter, encounter-section').forEach((el) => {
        const scope = ng.element(el).isolateScope();
        if (!scope || !scope.encounter) {
          return;
        }
        const isSection = el.tagName === 'ENCOUNTER-SECTION';
        const url = (isSection ? scope.section?.templateModelUrl : scope.templateModelUrl?.()) || '';
        const resource = (url.split('definitionUiResource=')[1] || '').split('&')[0];
        // A getAsHtml.action URL without definitionUiResource (the Vitals entries of encounterTypeConfig.js) renders the form the
        // encounter was saved with (encounter.form), which for an encounter saved through the form is this form.
        const ownForm = !resource && url.includes('viewEncounterWithHtmlForm/getAsHtml.action') && !!scope.encounter.form;
        const sameEncounter = scope.encounter.uuid === encounterUuid;
        seen.push(`${el.tagName.toLowerCase()}${isSection ? ' ' + (scope.section?.id ?? '') : ''} ${sameEncounter ? '(this encounter)' : ''} templateModelUrl=${resource || (ownForm ? "(the encounter's own form)" : 'none')}`);
        if (!found && sameEncounter && (resource.endsWith('/' + formFile) || ownForm)) {
          el.setAttribute('data-e2e-view', 'true');
          found = true;
        }
      });
      return { found, seen };
    },
    { encounterUuid, formFile },
  );

export class VisitPage {
  private static marks = 0;

  constructor(readonly page: Page) {}

  // Opens the visit and waits for Angular to have built its encounters.
  static async open(page: Page, visitUuid: string): Promise<VisitPage> {
    // Leave the current page first: right after a form's save redirect the browser is still loading the visit page, and
    // going to the same URL aborts that navigation (net::ERR_ABORTED).
    await page.goto('about:blank');
    await page.goto(visitPagePath(visitUuid));
    await page.locator('encounter').first().waitFor();
    // Angular builds the <encounter> elements first, then fetches each encounter and the sections it lists, and rebuilds the
    // elements it replaces (an attribute set on one in between is lost): wait for the requests to stop before reading it.
    await page.waitForLoadState('networkidle');
    return new VisitPage(page);
  }

  // Opens the visit that holds the given encounter (for tests that only have the encounter, such as the section forms').
  static async openOfEncounter(page: Page, encounterUuid: string): Promise<VisitPage> {
    const res = await page.request.get(`/openmrs/ws/rest/v1/encounter/${encounterUuid}?v=custom:(visit:(uuid))`);
    expect(res.ok(), `get encounter ${encounterUuid}: ${res.status()}`).toBeTruthy();
    const visitUuid = (await res.json()).visit?.uuid as string | undefined;
    expect(visitUuid, `encounter ${encounterUuid} is in a visit`).toBeTruthy();
    return VisitPage.open(page, visitUuid!);
  }

  // The ids of the sections the visit page shows for the entry it has expanded, in page order: the `id` of every `encounter-section` and
  // `include-section` element (the vaccinations of the peds forms is an include-section) that is displayed. A section whose `require`
  // is false is not rendered, so it is not listed. Read from the Angular scopes (the page runs with debug info on).
  async shownSectionIds(): Promise<string[]> {
    return this.page.evaluate(() => {
      const ng = (window as unknown as { angular: { element: (e: Element) => { isolateScope: () => { section?: { id?: string } } | undefined } } }).angular;
      const ids: string[] = [];
      document.querySelectorAll('encounter-section, include-section').forEach((el) => {
        const id = ng.element(el).isolateScope()?.section?.id;
        if (id && (el as HTMLElement).offsetParent !== null && !ids.includes(id)) {
          ids.push(id);
        }
      });
      return ids;
    });
  }

  // The nth encounter of the given type (the page lists them newest first).
  encounterOfType(encounterTypeUuid: string, nth = 0): Locator {
    return this.page.locator(`encounter.encounterType-${encounterTypeUuid}`).nth(nth);
  }

  // A section of an encounter, by the id of its header (the `id` of the section in encounterTypeConfig.js, such as
  // `pihcore-diagnosis`).
  section(sectionId: string): Locator {
    return this.page.locator(`encounter-section:has(.header#${sectionId})`);
  }

  // The same section, found once and marked, for a test that expands it: the id is on the header of the section's SHORT template only (the
  // long templates, dxLong.page and viewSectionWithHtmlFormLong.page, have a header without it), so `section(id)` stops matching as soon as
  // the section is expanded.
  async expandableSection(sectionId: string): Promise<Locator> {
    await this.section(sectionId).evaluate((el, id) => el.setAttribute('data-e2e-section', id), sectionId);
    return this.page.locator(`encounter-section[data-e2e-section="${sectionId}"]`);
  }

  // Expands an <encounter> or <encounter-section> the way a user does (its parent encounter first, when its sections are
  // still hidden) and returns the locator of its long view (an encounter that only has sections has none of its own). Already
  // expanded: nothing to click. A section is found by the id of its collapsed header (`section(id)`), and the long view of a
  // section has no such id, so the element is marked first and the returned locator keeps pointing at it.
  async expand(element: Locator): Promise<Locator> {
    const mark = `e2e-expanded-${VisitPage.marks++}`;
    await element.first().evaluate((e, m) => e.setAttribute('data-e2e-mark', m), mark);
    const marked = this.page.locator(`[data-e2e-mark="${mark}"]`);
    if (!(await marked.locator(OWN_ELEMENT).first().isVisible())) {
      await this.clickExpand(marked.locator('xpath=ancestor::encounter'));
    }
    await this.clickExpand(marked);
    return marked.locator(LONG_VIEW).first();
  }

  // The header holds each link up to three times (one per heading variant); only the visible one counts. Angular decides
  // which that is once the encounter has loaded, so wait for either link (an encounter whose entry cannot expand has neither
  // and times out here).
  private async clickExpand(entry: Locator): Promise<void> {
    const link = entry.locator(`${OWN_ELEMENT} .header :is(a.expand-encounter, a.contract-encounter):visible`).first();
    await link.waitFor();
    if (await link.evaluate((e) => e.classList.contains('expand-encounter'))) {
      await link.click();
    }
  }

  // The long view of the entry that shows the form's VIEW of the encounter, expanded and with the form's HTML in it. Throws
  // when the visit page shows no VIEW of this form for this encounter: that is a form whose entry in encounterTypeConfig.js
  // has no templateModelUrl (it renders the encounter with its own template, which is what the visit-page tests of such a form
  // assert instead: see the skill, "Visit-page display").
  async expandFormView(encounterUuid: string, formFile: string): Promise<Locator> {
    const { found, seen } = await markViewElement(this.page, encounterUuid, formFile);
    if (!found) {
      throw new Error(
        `The visit page shows no VIEW of ${formFile} for encounter ${encounterUuid}: no <encounter>/<encounter-section> has a ` +
          `templateModelUrl naming it. Entries on the page:\n  ${seen.join('\n  ') || '(none)'}`,
      );
    }
    const element = this.page.locator('[data-e2e-view]');
    const longView = await this.expand(element);
    await expect(longView, 'the long view of the expanded entry').toBeVisible();
    // The HTML is bound after the getAsHtml request returns; the form's own scripts run when it is inserted.
    await this.page.waitForFunction(() => {
      const el = document.querySelector('[data-e2e-view]');
      const ng = (window as unknown as { angular: { element: (e: Element) => { isolateScope: () => { html?: unknown } | undefined } } }).angular;
      return !!el && !!ng.element(el).isolateScope()?.html;
    });
    return longView;
  }
}
