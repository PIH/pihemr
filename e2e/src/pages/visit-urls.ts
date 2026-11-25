// The visit page that every form returns to after a save (pihcore visit.page). Same in every PIH config.
export const VISIT_PAGE_URL = /pihcore\/visit\/visit\.page/;

export const visitPagePath = (visitUuid: string): string => `/openmrs/pihcore/visit/visit.page?visit=${visitUuid}`;
