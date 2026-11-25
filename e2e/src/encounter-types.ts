// Encounter types of the forms that pihemr defines (the `formEncounterType` of the form, or the encounter type its visit-page entry
// is configured for in encounterTypeConfig.js). They are metadata of pihemr's own content, so they are the same on every site that has the form:
// a spec of a pihemr form may name them. Metadata that differs by site (locations, identifier types, the visit location) is not here: it comes
// from the site's settings (contract.ts, `SiteSettings`).
//
// Playwright-free on purpose, like site.ts: a config repo's core/constants.ts re-exports them and the config imports that file.

// Vitals (vitals.xml) and the consult encounter type shared by outpatientConsult.xml and edNote.xml.
export const VITALS_ENCOUNTER_TYPE_UUID = '4fb47712-34a6-40d2-8ed3-e153abbd25b7';
export const CONSULT_ENCOUNTER_TYPE_UUID = '92fd09b4-5335-4f7e-9f63-b2a663fd09a6';

// formEncounterType of primary-care-*.xml and ncd-*.xml: the parents of section-exam / -history / -chief-complaint / -plan / -peds.
export const PRIMARY_CARE_ADULT_INITIAL_ENCOUNTER_TYPE_UUID = '27d3a180-031b-11e6-a837-0800200c9a66';
export const PRIMARY_CARE_ADULT_FOLLOWUP_ENCOUNTER_TYPE_UUID = '27d3a181-031b-11e6-a837-0800200c9a66';
export const PRIMARY_CARE_PEDS_INITIAL_ENCOUNTER_TYPE_UUID = '5b812660-0262-11e6-a837-0800200c9a66';
export const PRIMARY_CARE_PEDS_FOLLOWUP_ENCOUNTER_TYPE_UUID = '229e5160-031b-11e6-a837-0800200c9a66';
export const NCD_INITIAL_ENCOUNTER_TYPE_UUID = 'ae06d311-1866-455b-8a64-126a9bd74171';
export const NCD_FOLLOWUP_ENCOUNTER_TYPE_UUID = '5cbfd6a2-92d9-4ad0-b526-9d29bfe1d10c';

// obGyn.xml (OB/GYN) and oncologyIntakeConsult.xml: parents of section-exam (and of the oncology / obgyn sections).
export const OBGYN_ENCOUNTER_TYPE_UUID = 'd83e98fd-dc7b-420f-aa3f-36f648b4483d';
export const ONCOLOGY_INTAKE_CONSULT_ENCOUNTER_TYPE_UUID = 'a936ae01-6d10-455d-befc-b2d1828dad04';

// echocardiogram.xml and oncologyTreatment.xml ("Oncology Treatment Plan"): top-level forms with their own obs.
export const ECHOCARDIOGRAM_ENCOUNTER_TYPE_UUID = 'fdee591e-78ba-11e9-8f9e-2a86e4085a59';
export const ONCOLOGY_TREATMENT_PLAN_ENCOUNTER_TYPE_UUID = 'f9cfdf8b-d086-4658-9b9d-45a62896da03';

// MCH Delivery (delivery.xml): parent of section-delivery, section-c-section and (on the visit page) section-dx.
export const DELIVERY_ENCOUNTER_TYPE_UUID = '00e5ebb2-90ec-11e8-9eb6-529269fb1459';

// The four community-health home-assessment encounter types: no form creates them; they are the parents of section-comments,
// section-return-visit-date and the other home-assessment sections.
export const PRENATAL_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID = '91DDF969-A2D4-4603-B979-F2D6F777F4AF';
export const PEDIATRIC_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID = '0CF4717A-479F-4349-AE6F-8602E2AA41D3';
export const MATERNAL_POSTPARTUM_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID = '0E7160DF-2DD1-4728-B951-641BBE4136B8';
export const MATERNAL_FOLLOWUP_HOME_ASSESSMENT_ENCOUNTER_TYPE_UUID = '690670E2-A0CC-452B-854D-B95E2EAB75C9';

// ADT forms: admissionNote.xml, cancelAdmission.xml, drugOrder.xml.
export const ADMISSION_ENCOUNTER_TYPE_UUID = '260566e1-c909-4d61-a96f-c1019291a09d';
export const CANCEL_ADMISSION_ENCOUNTER_TYPE_UUID = 'edbb857b-e736-4296-9438-462b31f97ef9';
export const DRUG_ORDER_ENCOUNTER_TYPE_UUID = 'e0b41238-905a-497b-a2b6-885994701b99';

// socio-econ.xml (Socioeconomics Note) and comment.xml (Comment).
export const SOCIO_ECONOMICS_ENCOUNTER_TYPE_UUID = 'de844e58-11e1-11e8-b642-0ed5f89f718b';
export const COMMENT_ENCOUNTER_TYPE_UUID = 'c30d6e06-0f00-460a-8f81-3c39a1853b56';

// chemotherapyTreatment.xml ("Chemotheraphy treatment session": the spelling of the encounter type's own name) and covid19Intake.xml /
// covid19Followup.xml / covid19Discharge.xml ("COVID-19 Admission", "COVID-19 Progress", "COVID-19 Discharge").
export const CHEMOTHERAPY_TREATMENT_ENCOUNTER_TYPE_UUID = '828964fa-17eb-446e-aba4-e940b0f4be5b';
export const COVID19_INTAKE_ENCOUNTER_TYPE_UUID = '8d50b938-dcf9-4b8e-9938-e625bd2f0a81';
export const COVID19_FOLLOWUP_ENCOUNTER_TYPE_UUID = 'ca65f5d3-6312-4143-ae4e-0237427f339e';
export const COVID19_DISCHARGE_ENCOUNTER_TYPE_UUID = '5e82bea0-fd7b-47f9-858a-91be87521073';
