# PIH EMR HTML Forms Documentation

This document describes all XML forms in `pihemr/content/configuration/backend_configuration/pih/htmlforms/`, organized by clinical area.  These forms are shared by multiple implementations (ZL, Liberia, Mexico, and Sierra Leone) and the default forms.  Not all of these forms are used by each implementation.  Many of them are replaced by the country configurations (ie. NCD, vitals, etc).  The majority of these forms are used by ZL (Haiti).  

---

## Table of Contents

1. [Core Clinical Forms](#1-core-clinical-forms)
2. [Maternal & Child Forms](#2-maternal--child-forms)
3. [NCD Forms](#3-ncd-forms)
4. [Oncology Forms](#4-oncology-forms)
5. [Mental Health Forms](#5-mental-health-forms)
6. [Primary Care & Pediatrics Forms](#6-primary-care--pediatrics-forms)
7. [COVID Forms](#7-covid-forms)
8. [Patient Registration Forms](#8-patient-registration-forms)
9. [Reusable Section Forms](#9-reusable-section-forms)
10. [Retired Forms](#10-retired-forms)

---

## 1. Core Clinical Forms

### admissionNote.xml
**Form Name:** Admission | **Version:** 2.0

Records inpatient admission. Captures admitting clinician, location, date, and diagnoses. Includes wristband printing with location-based conditional logic and automatic location population from the most recent admission request in the active visit. Post-submission action reopens the visit. Requires location, provider, date, and at least one diagnosis.

---

### cancelAdmission.xml
**Form Name:** Cancel Admission | **Version:** 1.0

Documents cancellation or denial of hospital admission. Captures reason not admitted (coded dropdown) and a free-text clinical impression. A hidden obs sets the admission decision to "Deny Admission." Contains JavaScript validation that cross-references the selected reason against the most recent disposition, showing a confirmation dialog if they don't match.

---

### dischargeNote.xml
**Form Name:** Discharge | **Version:** 1.0

Minimal form recording hospital discharge: date, discharging clinician, and discharge location. No conditional logic.

---

### transferNote.xml
**Form Name:** Transfer | **Version:** 1.1

Records intra-hospital patient transfers: date, transferring clinician, and destination location. Parallel structure to dischargeNote.xml.

---

### edNote.xml
**Form Name:** ED Note | **Version:** 1.0

Emergency department consultation and disposition. Captures coded diagnoses (with non-coded option), encounter disposition, optional trauma assessment (type shown conditionally when trauma = yes), return visit date, and clinical comments. Post-submission actions apply disposition and optionally redirect to the death certificate form. Two-pane layout: data entry left, diagnoses right.

---

### outpatientConsult.xml
**Form Name:** Clinical Consult (Outpatient) | **Version:** 1.0

Outpatient consultation note. Captures coded diagnoses (required), outpatient procedures (autocomplete), encounter disposition, return visit date, and clinical comments. Post-submission actions apply disposition and optionally redirect to death certificate. Two-pane layout.

---

### surgicalPostOpNote.xml
**Form Name:** Brief Post-Operative Note | **Version:** 2.0

Comprehensive post-op surgical documentation. Five tabs:
- **Service/Team** — surgical service, attending/assistant surgeons, anesthesiologists, nurses
- **Description** — pre/post-op diagnoses, procedures, anesthesia type, wound classification, emergency vs. scheduled
- **Ins/Outs** — IV fluids, transfusions (whole blood, packed cells, plasma, platelets), estimated blood loss, urine output, antibiotics, VTE prophylaxis
- **Pathology/Complications** — specimens, lab, implants, complications
- **Plan** — surgical findings and comments

Bilingual (English/French), print view with timestamps, textarea auto-expansion via JavaScript.

---

### comment.xml
**Form Name:** Comment | **Version:** 1.0

Minimal form for free-text clinical notes. Captures provider, location, date/time, and a required clinical impression comments field. Encounter details hidden in VIEW mode.

---

### vitals.xml
**Form Name:** Vitals | **Version:** 2.2

Records vital signs and anthropometrics with unit conversion helpers (°F↔°C, lbs↔kg, in↔cm). Age-dependent fields:
- BMI displayed if age > 5 years
- MUAC shown if age < 13 or female
- Head circumference and MUAC/HC ratio shown if age < 3

Also captures chief complaint. Conditional provider/location/date editing based on visit status and retro-entry privileges.

---

### labResults.xml
**Form Name:** Lab Results | **Version:** 2.0

Comprehensive laboratory results entry across six sections:
- **Hematology** — CBC, hemoglobin, CD4/CD8, ESR, sickling, blood type, coagulation
- **Biochemistry** — glucose (fasting/prandial), electrolytes, renal/liver panels, lipids, hormones, enzymes
- **Infectious Disease** — HIV (rapid test, PCR for <5yo, viral load), hepatitis B/C, malaria, syphilis, typhoid, COVID-19
- **Urine** — dipstick (color, clarity, pH, protein, glucose, ketones, bilirubin, blood), microscopy (RBC, WBC, casts, crystals, bacteria)
- **Microbiology** — wet mount, gram stain
- **Parasitology** — stool exam, H. pylori

Requires specimen collection date and test date. Post-submission sets all obs dates to specimen collection date. Conditional numeric vs. detection-limit fields for viral load (default 839 copies/mL when below limit). Age- and gender-specific fields.

---

### labResults_v1.0.xml
**Form Name:** Lab Results | **Version:** 1.0

Earlier version of labResults.xml with reduced scope: fewer biochemistry panels, simplified infectious disease section, reduced crystal/cast options in urine, no COVID-19 section. Same date validation and viral load conditional logic.

---

### dispensing.xml
**Form Name:** Dispensing | **Version:** 1.0

Pharmacy dispensing record for up to 8 medications. Captures dispensed-by (pharmacist/aide/manager), location, date, prescription type (discharge vs. inpatient), prescription location, and prescriber. Each medication slot captures: drug name (autocomplete), dose, dose unit, frequency, duration, duration unit, quantity dispensed, and optional instructions. Duration optional when frequency is STAT. Pre-submission JavaScript validates that all fields in a partially-filled medication row are completed.

---

### drugOrder.xml
**Form Name:** Order Medication | **Version:** 1.0

Thin wrapper form that delegates medication ordering to the `drug-order-widget` subform. Captures provider, location, and date via subform.

---

## 2. Maternal & Child Forms

### ancIntake.xml
**Form Name:** Prenatal Intake | **Version:** 1.1
**Encounter Type:** Prenatal Intake

Lightweight wrapper that delegates to `encounter-with-sections.xml` for modular section rendering.

---

### ancFollowup.xml
**Form Name:** Prenatal Followup | **Version:** 1.1
**Encounter Type:** Prenatal Followup

Lightweight wrapper that delegates to `encounter-with-sections.xml`.

---

### delivery.xml
**Form Name:** MCH Delivery | **Version:** 3.0
**Encounter Type:** MCH Delivery

Comprehensive delivery documentation wrapper that delegates to `encounter-with-sections.xml`. See `section-delivery.xml` for full section content.

---

### delivery_v1.1.xml
**Form Name:** MCH Delivery | **Version:** 1.1

Previous version of the delivery form wrapper with simplified newborn data collection and delivery type selection. See `section-delivery_v1.1.xml`.

---

### obGyn.xml
**Form Name:** ObGyn Consult | **Version:** 2.0
**Encounter Type:** Obstetric/Gynecology Consult

Wrapper form with encounter metadata (provider, location, date). In ENTER mode, auto-submits if default values are available. Print-friendly formatting with datestamps.

---

### obGyn_1.0.xml
**Form Name:** ObGyn Consult | **Version:** 1.0

Earlier version of obGyn.xml with identical structure.

---

### infantDocumentation.xml
**Form Name:** HIV Infant Documentation | **Version:** 1.0
**Encounter Type:** Infant Visit

Captures HIV status (positive/negative/unknown) with test date, and caregiver information (name, gender, relationship). Enrolls patient in OVC program.

---

### section-delivery.xml
**Form Name:** MCH Delivery Section | **Version:** 3.0

Comprehensive delivery section with six major areas:

1. **Labor & Delivery** — delivery date/time (required), gestational age (calculated), partogram use, delivery complications (dystocia, prolapsed cord, hemorrhage with blood-loss estimate and transfusion), cord clamping, AMTSL, placenta delivery, perineal laceration, procedures (episiotomy, suture)
2. **Findings** — maternal diagnoses (hemorrhage, pre-eclampsia, eclampsia, chorioamnionitis, GBV, mental health, etc.); fetal findings (abnormal presentation, prematurity, birth asphyxia, respiratory distress, congenital malformation, meconium)
3. **Newborns** (up to 4) — live/stillborn status; for live births: gender, birth weight, APGAR (1/5/10 min), height, head circumference, vitamin K, resuscitation, delivery type (vaginal/instrumental/c-section with reasons); for stillbirths: maceration status
4. **Postpartum Exam** — lochia (type, odor, quantity), postpartum hemorrhage, uterine involution, perineum assessment, breast findings
5. **KPI & Counseling** — prenatal visit count, referral source (TBA/CHW/other), baby nutrition counseling, family planning adoption
6. **Disposition** — encounter disposition and return visit date

Post-submission: ApplyDispositionAction, CleanDiagnosisConstructAction.

---

### section-delivery_v1.1.xml
**Form Name:** MCH Delivery Section | **Version:** 1.1

Simplified version of section-delivery.xml. Uses checkboxes instead of nested conditionals for delivery type, integrates vacuum/c-section toggling, places newborn data within the labor section, adds "resumed sex" to postpartum, and includes a `setUpGestationalAgeAtBirth()` calculation.

---

### section-c-section.xml
**Form Name:** C-Section | **Version:** 1.0

Detailed cesarean section operative note with seven sections:

1. **Surgery Team** — attending surgeon (required), up to 2 assistant surgeons, 2 anesthesiologists, 2 nurses, other assistants
2. **Surgery Description** — procedure type (c-section ± hysterectomy, tubal ligation, oophorectomy, myomectomy), adhesion findings, emergency vs. scheduled, anesthesia type, wound classification
3. **Sutures** — size, material, count, uterine incision location
4. **Lacerations** — count, location, perineal grade
5. **Ins/Outs** — IVF volume, transfusion details (whole blood/RBCs/plasma/platelets) with volumes, pre-op antibiotics, VTE prophylaxis, estimated blood loss, urine output
6. **Pathology/Lab** — specimen types and comments
7. **Findings/Complications** — complications, wound status, additional comments

Bilingual (English/French), print-friendly, textarea auto-expansion.

---

### section-maternal-vital-signs.xml
**Form Name:** Maternal Vital Signs | **Version:** 1.0

Captures blood pressure (excluded for pediatric), temperature, pulse, and respiratory rate. For pediatric encounters: weight, height, head circumference, MUAC, and meals per day.

---

### section-maternal-danger-signs.xml
**Form Name:** Maternal Danger Signs | **Version:** 1.0

Yes/No checkboxes for danger signs, conditionally displayed by encounter type:
- **Prenatal** — fluids, decreased fetal movement, severe headache, vision problems, edema, abdominal pain, vaginal infection, bleeding, fever
- **Postpartum** — postpartum hemorrhage, severe headache, vision problems, facial/hand edema, abdominal pain, vaginal infection, fever
- **Pediatric** — fever, diarrhea, jaundice, cough, seizures

Bilingual (English/French).

---

### section-mch-referral.xml
**Form Name:** Referrals | **Version:** 1.0

Tabular display of MCH referral requests sourced from CommCare. Tracks referral type (hospital, mental health, family member, tetanus/pediatric vaccination, malnutrition program), details, fulfillment status (unmet/completed/pending/no-show/cancelled/other), and remarks. Conditional row visibility and JavaScript-set defaults.

---

### section-postpartum-counsel.xml
**Form Name:** Postpartum Training | **Version:** 1.0

Checkboxes for counseling topics provided, conditional by encounter type:
- **Postpartum/Followup** — danger signs, breastfeeding, nutrition, hygiene, family planning, other
- **Pediatric** — same six topics

---

### section-family-planning.xml
**Form Name:** Family Planning | **Version:** 1.0

Table-based contraceptive history for methods: pill, Depo-Provera, condoms, Norplant, IUD, tubal ligation, vasectomy, other. Tracks start and end dates per method.

---

### section-family-planning-simple.xml
**Form Name:** Maternal Family Planning | **Version:** 1.0

Simplified checkbox list (no date tracking): Jadelle, tubal ligation, Depo-Provera, IUD, condoms, pill, natural, none, N/A. Designed for quick entry.

---

### section-obgyn-initial.xml
**Form Name:** OB/GYN Initial Assessment | **Version:** 1.0

Comprehensive initial OB/GYN assessment (large file). Captures full gynecologic and obstetric history for new patients.

---

### section-obgyn-plan.xml
**Form Name:** OB/GYN Plan | **Version:** 2.0

Treatment plan for OB/GYN encounters. Sections:
1. **Consult Type** — visit type (gynecology/prenatal/postnatal/family planning), new vs. follow-up (required)
2. **Procedures** — up to 5 autocomplete selections from WHprocedures concept set
3. **Test Orders** — pihLabOrder widget
4. **Drug Orders** — drug-order-widget subform plus remarks
5. **Other Support** — counseling topics (breastfeeding, hygiene, nutrition, family planning, delivery prep, danger signs, other); treatment status
6. **Delivery Plan** — CHW accompaniment, mom club, PMTCT club, delivery location (home/hospital), home ARV plan for newborn
7. **Referral** — clinic, family planning, nutrition, psychologist, NCD program, community health, other
8. **Disposition** — encounter disposition, comments, return visit date

Post-submission: ApplyDispositionAction.

---

### section-obgyn-plan_v1.0.xml
**Form Name:** OB/GYN Plan | **Version:** 1.0

Earlier version of section-obgyn-plan.xml. Uses inline lab test checkboxes (3-column layout: hematology, parasitology, ANC, chemistry, serology, TB, HIV, other) with age/gender-specific visibility, instead of the pihLabOrder widget.

---

### section-dx-obgyn.xml
**Form Name:** Diagnosis with OB/GYN History | **Version:** 1.0

Combines encounter diagnosis entry (left column) with a dynamically fetched OB/GYN historical summary (right column): most recent OB/GYN intake date, LMP, EDD, gravida/para/abortus/living counts, and calculated gestational age. Uses JavaScript API calls to retrieve prior encounter data. Gender- and age-conditional display.

---

## 3. NCD Forms

### ncd-initial.xml / ncd-initial_v0.5.xml / ncd-initial_v1.0.xml
**Form Name:** NCD Initial | **Versions:** v0.5, v1.0, v2.0
**Encounter Type:** NCD Initial

Lightweight wrappers delegating to `encounter-with-sections.xml`. v0.5 is the REDCap study integration variant; v1.0 and v2.0 are the standard versions. Actual content is in `section-ncd.xml`.

---

### ncd-followup.xml / ncd-followup_v0.5.xml / ncd-followup_v1.0.xml
**Form Name:** NCD Followup | **Versions:** v0.5, v1.0, v2.0
**Encounter Type:** NCD Followup

Same wrapper pattern as NCD Initial forms. v0.5 is REDCap variant. Actual content is in `section-ncd.xml`.

---

### section-ncd.xml
**Form Name:** NCD (Current) | **Version:** 2.0

Comprehensive NCD consultation note with nine disease-specific areas:

1. **NCD Info** — program enrollment, disease awareness, prior treatment; NCD categories: hypertension, diabetes, respiratory, epilepsy, heart failure, cerebrovascular disease, renal/liver failure, sickle cell, other
2. **NCD Vitals** — waist/hip circumference with JavaScript-calculated waist-hip ratio
3. **Hypertension** — blood pressure staging (normal, elevated, stage 1/2, crisis) with protocol guidance
4. **Diabetes** — type 1/2 classification, glucose testing, fasting status, foot care risk; gestational DM option for females
5. **Respiratory** — asthma severity, COPD grading, inhaler education
6. **Epilepsy** — seizure frequency
7. **Heart Failure** — cardiomyopathy classification, NYHA class, fluid status, echocardiography findings
8. **Other Diagnoses** — DVT, PE, atrial fibrillation, hyperlipidemia, obesity
9. **NCD Plan** — medication compliance, hospitalization history, medication orders (organized by system: cardiovascular, respiratory, endocrine, other), return visit date

Conditional sections for initial vs. follow-up encounters. Post-submission: CleanDiagnosisConstructAction, CleanPrescriptionConstructAction. Bilingual (English/French).

---

### section-sickle-cell.xml
**Form Name:** Sickle Cell | **Version:** 1.0

Sickle cell disease management section (embedded in NCD forms):
1. **Diagnosis & Confirmation** (NCD Intake only) — genotype/diagnosis type (5 options), confirmation test (9 methods)
2. **Clinical Indicators** — asymptomatic vs. 8 specific symptoms (pain, fever, jaundice, anemia, ascites, splenomegaly/hepatomegaly, dyspnea, chest pain)
3. **Complications Since Last Visit** — yes/no with 9 complication types (vaso-occlusive crisis, acute chest syndrome, stroke, etc.)
4. **Transfusion History** — 3-month status, count, and date
5. **Treatment** — folic acid and penicillin use
6. **Treatment Adherence** — 7 yes/no questions (adherence, understanding, missed doses per week, patient/family awareness)
7. **Disease Control** — patient condition improved, overall disease control status
8. **Hydroxyurea** — indications, current use, 6 tracked side effects

---

### section-ncd_v0.5.xml
**Form Name:** NCD (REDCap) | **Version:** 0.5

REDCap study variant of section-ncd.xml. Adds: BMI calculation, referral source tracking, HIV status/ART information, simplified respiratory disease handling.

---

### section-ncd_v1.0.xml
**Form Name:** NCD V1 | **Version:** 1.0

Identical to section-ncd.xml; provides backward compatibility for v1.0 form references.

---

### echocardiogram.xml
**Form Name:** Echocardiogram | **Version:** 1.0
**Encounter Type:** Echocardiogram

Records echocardiographic findings and diagnoses (with primary/secondary designation). JavaScript handles primary/secondary diagnosis toggling.

## 4. Oncology Forms

### oncologyConsult.xml
**Form Name:** Oncology Consult Note | **Version:** 1.0
**Encounter Type:** Oncology Consult

Documents initial oncology consultation. Captures up to 3 cancer diagnoses (from PIH concept sets) with primary/secondary designation, disease status (complete/partial remission, stable, progressive, recurrent), ECOG performance status (0–5 with descriptive reference table), presenting history, and clinical impression. JavaScript handles diagnosis validation and primary/secondary toggling.

---

### oncologyIntakeConsult.xml / oncologyIntakeConsult_v2.0.xml
**Form Name:** Oncology Initial Consult | **Versions:** 1.0, 2.0
**Encounter Type:** Oncology Consult

Minimal intake form designed for rapid encounter creation. Auto-submits in ENTER mode when location is available; shows the form only if location is missing. Enrolls patient in the Oncology program.

---

### oncologyTreatment.xml
**Form Name:** Oncology Treatment Plan | **Version:** 1.0
**Encounter Type:** Oncology Treatment

Documents oncology treatment plan. Captures up to 3 diagnoses with primary/secondary designation, cancer stage (I–IV, unknown, N/A), treatment intent (curative or palliative as a workflow state), and free-text treatment plan. Post-submission: CleanDiagnosisConstructAction, CleanPrescriptionConstructAction.

---

### chemotherapyTreatment.xml
**Form Name:** Oncology Chemotherapy Treatment Session | **Version:** 1.0
**Encounter Type:** Chemotherapy Treatment

Tracks individual chemotherapy sessions. Sections:
- **Treatment** — protocol (from a list including AC, BEP, FAC, etc.), current cycle and total planned cycles
- **Treatment Received** — yes/no; conditional reason for non-completion
- **Side Effects** — standardized checklist (fatigue, hair loss, nausea, vomiting, rash, etc.)
- **Pain Assessment** — 0–10 pain scale with location/comment
- **Patient Plan** — continue, change protocol, stop, other
- **Visit Documentation** — clinical notes

Enrolls patient in Oncology program.

---

### section-oncology-history.xml
**Form Name:** Oncology History | **Version:** 1.0

Comprehensive oncology-specific history section:
1. **Vital Signs** — auto-populated from most recent vitals encounter in the same visit (height, weight, BMI, BP, HR, temp, RR, O2 sat) via JavaScript API calls
2. **Risk Factors** — smoking (current/former/never, years, packs/year), secondhand smoke, alcohol, drug use
3. **HIV Testing** — status, test date, rapid test results, viral load, CD4 count, ARV regimen
4. **Past Medical History** — diabetes, HTN, asthma, other conditions
5. **Family History** — breast, ovarian, colon, prostate, and other cancers by relative type
6. **OB/GYN** (females only) — gravida/para/abortus/living, contraception, menopausal status, pregnancy status, LMP, due date, menstrual regularity
7. **Current Illness** — chief complaint, presenting history, current medications, referral source

---

### section-oncology-plan.xml
**Form Name:** Oncology Plan | **Version:** 3.0

Comprehensive treatment plan and disposition:
1. **Radiology/Pathology Orders** — chest X-ray, imaging via autocomplete or radiology app integration
2. **Miscellaneous** — ECOG performance status, mental health assessment (ZLDSI), psychosocial referral
3. **Diagnosis** — encounterDiagnosesByObs widget, non-coded option, clinical impression
4. **Clinical Management Plan** — free-text narrative
5. **Drug Orders** — drug-order-widget subform
6. **Lab Orders** — predefined common tests (hCG, HIV, syphilis, hepatitis, liver function, clotting, lipids, electrolytes, renal)
7. **Assistance** — socioeconomic aid (transport, food, financial) with received/recommended tracking
8. **Disposition** — encounter disposition and return visit date (skipped for NCD encounters)

Post-submission: ApplyDispositionAction.

---

### section-oncology-plan_v2.0.xml
**Form Name:** Oncology Plan | **Version:** 2.0

Earlier version of section-oncology-plan.xml. Uses show/hide medication rows with inline validation (dose, units, frequency, duration) instead of the drug-order-widget subform.

## 5. Mental Health Forms

### mentalHealth.xml / mentalHealth_v1.0.xml
**Form Name:** Mental Health Assessment | **Versions:** 1.0, 2.0
**Encounter Type:** Mental Health

Comprehensive mental health assessment using collapsible/expandable CSS sections for different mental health conditions and psychosocial interventions. Post-submission: ApplyDispositionAction. v1.0 and v2.0 share identical structure.

---

### drugRehab.xml
**Form Name:** Drug Rehab | **Version:** 1.0
**Encounter Type:** Drug Rehabilitation

Assesses drug rehabilitation program participation using a three-column flex layout with yes/no radio buttons for: psychosocial support, rehabilitation program participation, support group attendance, planned visit compliance, and support network evaluation.

## 6. Primary Care & Pediatrics Forms

### primary-care-adult-initial.xml / primary-care-adult-initial_v1.0.xml
**Form Name:** Outpatient Intake (Adult) | **Versions:** 1.0, 2.0
**Encounter Type:** Primary Care Consult

Wrapper forms delegating to `encounter-with-sections.xml` for modular section composition. v1.0 is the legacy version maintained for backward compatibility.

---

### primary-care-adult-followup.xml / primary-care-adult-followup_v1.0.xml
**Form Name:** Outpatient Followup (Adult) | **Versions:** 1.0, 2.0
**Encounter Type:** Primary Care Followup

Same wrapper pattern as adult initial forms. v1.0 is the legacy version.

---

### primary-care-peds-initial.xml / primary-care-peds-initial_v1.0.xml
**Form Name:** Outpatient Intake (Peds) | **Versions:** 1.0, 2.0
**Encounter Type:** Pediatric Outpatient Intake

Pediatric-specific wrapper forms using the same subform architecture as adult forms.

---

### primary-care-peds-followup.xml / primary-care-peds-followup_v1.0.xml
**Form Name:** Outpatient Followup (Peds) | **Versions:** 1.0, 2.0
**Encounter Type:** Pediatric Outpatient Followup

Pediatric follow-up wrapper forms.

---

### ovcIntake.xml
**Form Name:** OVC Intake | **Version:** 1.0
**Encounter Type:** OVC Intake

Enrolls patients in the Orphaned and Vulnerable Children (OVC) program. Captures:
- HIV status and test date
- Services/programs offered (16 checkboxes: nutritional aid, school expenses, housing, financial aid, credit union, adolescent club, HIV testing, etc.; other with free text)
- Two caregiver contacts (name, gender, relationship)

---

### ovcFollowup.xml
**Form Name:** OVC Follow-up | **Version:** 1.0
**Encounter Type:** OVC Followup

Follow-up for OVC participants. Same HIV status and services/programs tracking as ovcIntake.xml; omits contact information (already captured at intake).

---

### vaccination-only.xml
**Form Name:** Vaccination | **Version:** 1.0
**Encounter Type:** Vaccination

Minimal encounter form for quick vaccination recording. Auto-submits in ENTER mode when location is available. Primary purpose is encounter creation; no detailed obs capture.

---

### socio-econ.xml
**Form Name:** Socioeconomics Note | **Version:** 1.0
**Encounter Type:** Socioeconomic Encounter

Comprehensive socioeconomic assessment. Seven sections:
1. **Education** — education level (5 levels), literacy
2. **Housing** — household composition, amenities (radio, TV, fridge, bank account), utilities, construction materials (floor, roof, walls)
3. **Transportation** — money for transport, method (9 options), cost, travel time to clinic
4. **Daily Activity** — main occupation, employment status
5. **Prenatal** (females only) — traditional healer use, financial/non-financial support during pregnancy
6. **Assistance** — received/recommended tracking for 7 aid types (transport, food, school, housing, etc.)
7. **Multidimensional Poverty Index (MPI)** — 10 poverty indicators (nutrition, infant mortality, school attendance, cooking fuel, sanitation, water, electricity, housing, assets)

---

## 7. COVID Forms

### covid19Intake.xml
**Form Name:** COVID-19 Admission | **Version:** 1.0
**Encounter Type:** COVID-19 Admission

Initial COVID-19 patient intake. Captures COVID-19 status (confirmed/suspected/no, required), vital signs and health condition assessment, and encounter disposition. Uses COVID-19-specific location tag. EDD calculation for pregnant patients. Enrolls patient in COVID-19 program. Post-submission: ApplyDispositionAction.

---

### covid19Followup.xml
**Form Name:** COVID-19 Progress Note | **Version:** 1.0
**Encounter Type:** COVID-19 Progress Note

Follow-up assessment for COVID-19 patients. Tracks ongoing symptoms, health status updates, and disposition. Post-submission: ApplyDispositionAction.

---

### covid19Discharge.xml
**Form Name:** COVID-19 Discharge | **Version:** 1.0
**Encounter Type:** COVID-19 Discharge

Final COVID-19 encounter. Captures final COVID-19 status (required), discharge plan and disposition. Two post-submission actions: ApplyDispositionAction and ExitPatientFromCovidProgramAction.

## 8. Patient Registration Forms

### patientRegistration.xml
**Form Name:** Patient Registration | **Version:** 1.0
**Encounter Type:** Patient Registration

Core demographic registration. Captures registration date, occupation, and civil status (6 options: single/child, married, living with partner, separated, divorced, widowed). JavaScript removes auto-generated title element.

---

### patientRegistration-social.xml
**Form Name:** Patient Registration Social | **Version:** 1.0

Social demographics supplement. Captures birthplace, civil status, and occupation (detailed 22-option classification with PIH/CIEL codes). No religion field (per code comment).

---

### patientRegistration-contact.xml
**Form Name:** Patient Registration Contact Person | **Version:** 1.0

Emergency contact capture as a single obsgroup. Records contact name, relationship to patient, address (textarea), and phone number.

---

### patientRegistration-rs.xml
**Form Name:** Patient Registration (Metadata) | **Version:** 1.0

Registration encounter metadata for retrospective check-in. Captures registration date (required), registering provider (required), and location.

---

## 9. Reusable Section Forms

These `section-*.xml` files are included into full forms via subform inclusion, not used standalone (except where noted).

### section-chief-complaint.xml
Single free-text chief complaint field (CIEL:160531).

---

### section-comments.xml
Single clinical comments/remarks field (PIH:1364). Reformats layout in VIEW mode.

---

### section-dx.xml
**Form Name:** Diagnosis Section | **Version:** 1.0

Encounter diagnosis entry using the `encounterDiagnosesByObs` widget (left column, 58%) with clinical impression comments textarea (right column). Conditional "Next" button hidden for Mental Health encounter type.

---

### section-exam.xml
**Form Name:** Physical Exam | **Version:** 1.0

Comprehensive physical examination across 17 systems:
- General, Skin, HEENT, Lymph, Cardiac, Chest, Abdominal, Urogenital, Mental, Neurologic, Peripheral Reflex, Musculoskeletal, Other (Tanner stage)
- Specialty: Urology/Gynecology (for OB/GYN encounters), Women's/Obstetrical (females: fundal height, uterine contractions, fetal presentation/position/heart rate for up to multiple fetuses), Postpartum (for OB/GYN encounters)
- Pediatric Development (age <15): Denver test screening, motor skills (gross/fine), language, social skills

Each system tracks normal/abnormal/other with comments. JavaScript enforces mutual exclusion between normal and abnormal checkboxes.

---

### section-history.xml
**Form Name:** History | **Version:** 1.0

Comprehensive patient history with 12 subsections:
1. Chief complaint (skipped for NCD Intake)
2. Presenting history
3. Referral information (NCD Intake only) — source, date, service
4. Family history — 8 diseases (heart disease, diabetes, cancer, etc.) by relative (father, mother, sibling, other)
5. Past medical history — 22+ conditions including asthma, epilepsy, hemoglobinopathy, TB, congenital malformations; maternal health for females
6. Birth history (NCD patients <12 years) — gestational age, delivery location, birthweight, maternal/neonatal disease
7. Blood type — 8 options
8. Habits (NCD Intake) — tobacco, alcohol, drug use with detailed smoking history
9. Sexual/Reproductive history — varies by encounter type; pregnancy status, family planning table with dates
10. Previous hospitalizations — 3 rows (admission date, discharge date, facility, reason)
11. Current medications — narrative
12. Prior diagnostic tests — narrative

Extensive JavaScript validation ensures checkbox/comment field consistency. Conditional by encounter type, gender, and age.

---

### section-lab-order.xml
**Form Name:** Test Order | **Version:** 1.0

Laboratory and imaging test ordering. Eight lab categories (3-column layout):
- Hematology (8 tests), Parasitology (3), ANC (3, females only), Chemistry (6), Serology (8), TB (3), HIV (5+, including PCR for infants <2 years), Other (PAP for females, urine, gram stain, H. pylori, non-coded)
- Radiology: chest X-ray and autocomplete imaging (or message to use Radiology app if component enabled)

---

### section-plan.xml
**Form Name:** Plan | **Version:** 2.0

Treatment plan section:
1. Clinical management plan (free-text)
2. Test orders — pihLabOrder widget
3. Radiology orders (conditional based on component enablement)
4. Drug orders — drug-order-widget subform; NCD encounters show a suggested treatment list (20+ medications by system: cardiovascular, respiratory, endocrine, other)
5. Socioeconomic assistance (NCD Followup only) — 7 aid types with received/recommended columns
6. Disposition — encounter disposition with return visit date (skipped for NCD encounters)

Post-submission: ApplyDispositionAction. JavaScript validates disposition completeness.

---

### section-plan_v1.0.xml
**Form Name:** Plan | **Version:** 1.0

Earlier version of section-plan.xml. Medication entry is inline (up to 8 slots with show/hide buttons) rather than using the drug-order-widget. Same validation and disposition logic.

---

### section-prescriptions-print.xml
**Form Name:** Prescriptions | **Version:** 1.0

Print-optimized prescription form for up to 8 medications. Each slot: drug name, dose + units (12 options), frequency (18 options), duration + units, and instructions. CSS prevents medication boxes from splitting across page breaks. Includes provider signature line.

---

### section-return-visit-date.xml
Single return visit date field (PIH:RETURN VISIT DATE) restricted to future dates.

---

### section-education-subjects.xml
**Form Name:** MCH Education Topics | **Version:** 1.0

MCH education tracking. Six checkbox options: danger signs, breastfeeding, good nutrition, general hygiene, family planning, other. Bilingual (English/French).

---

### section-peds.xml
Reusable section for pediatric-specific clinical content; included in other forms.

---

### section-peds-feeding.xml
**Form Name:** Pediatric Feeding and Supplements | **Version:** 1.0

Two tables:
- **Supplements** — 6 types (vitamin A, vitamin K, ferrous sulfate, iodine, deworming, zinc) with age received
- **Feeding** — 4 methods (exclusive breastfeeding, formula, mixed feeding, weaned) with yes/no and age started/stopped

JavaScript: selecting "yes" auto-unchecks "no" for the same item; age fields enable/disable based on checkbox state.

---

### section-peds-supplements.xml
**Form Name:** Pediatric Supplements | **Version:** 1.0

Standalone version of the supplements table from section-peds-feeding.xml (6 supplement types with age received). Same JavaScript validation.

---

## 10. Retired Forms

### retired/deathCertificate.xml
**Form Name:** Death Certificate (Retired) | **Version:** 2.1

Official death certificate for the Haitian Ministry of Health. Captures:
- Patient demographics (auto-populated), habitat, civil status, occupation, maternal death flag
- Date/time of death, form signer and role
- Location of death (institutional vs. non-institutional, with branching logic for each)
- Institutional: hospitalization duration, cause of death (primary/contributing), diagnosis confirmation method (surgery, autopsy)
- Non-institutional: whether provider was visited during illness, information source (family, police, undertaker), death circumstances narrative
- Burial certificate number, ICD-10 code (computed)

Marks patient as dead in the system. Custom date-picker UI. Formal certificate layout in VIEW mode.

---

### retired/checkin_old.xml
**Form Name:** Check-in (Retrospective) | **Version:** 2.0

Retrospective patient check-in. Captures date, provider, location, and visit type. Conditionally shows either appointment scheduling fields (hospital service, future-only appointment date) or payment amount based on selected visit type. Uses exit handlers for conditional field visibility; the inline comment notes this as a useful example of that pattern.

---

### retired/section-anc-followup.xml
**Form Name:** Prenatal Followup Section (Retired) | **Version:** 1.0

Superseded by the current modular ANC followup architecture. Captured: consult type (gynecology/prenatal/postnatal, intake vs. follow-up), danger signs (13 items), mental health screening (depression, PTSD, schizophrenia), risk factors (HIV, hypertension, diabetes, multiple gestation, prior c-section, GBV, syphilis, etc.), EDD and gestational age (calculated from LMP via JavaScript), and return visit date.

---

### retired/section-anc-intake.xml
**Form Name:** Prenatal Intake Section (Retired) | **Version:** 1.0

Superseded by the current modular ANC intake architecture. Added to retired section-anc-followup.xml content: MCH program enrollment, mother's group ID, trimester at enrollment, HIV test, gravida/para/abortus/living counts (required), LMP date, EDD (calculated from LMP).

---

### retired/physicalRehab.xml
**Form Name:** Physical Rehabilitation Evaluation (Retired) | **Version:** 1.4
**Encounter Type:** Rehabilitation Evaluation

Comprehensive physical rehabilitation assessment. Five parts:
1. **Basic Information** — patient demographics, health center, visit type, referring service/physician, rehabilitation diagnoses (8+)
2. **History and Interview** — paper form section, not online
3. **Objective** — vital signs in 3 positions (supine/sitting/standing for orthostatic changes), O2 sat, orientation assessment, communication/swallowing screening, pain score (face scale pre/post), ROM assessment, functional outcome measures (FIM, Berg Balance Scale, TUG, other)
4. **Assessment** — rehabilitation problem list: 15 impairment types, 20+ functional limitation items (ADL, mobility, communication)
5. **Plan** — 15+ intervention types, short/long-term goals (paper-based), equipment needed, provider signature

Designed as hybrid paper/electronic form.

---

## Architecture Notes

### Form Patterns
- **Wrapper forms** (e.g., ncd-initial.xml, ancFollowup.xml) are thin shells that reference `encounter-with-sections.xml` for modular section composition.
- **Section forms** (section-*.xml) are reusable building blocks included via subform tags; they are not typically standalone encounters.
- **Full forms** (e.g., surgicalPostOpNote.xml, retired/deathCertificate.xml) embed all content directly.

### Versioning
Many forms have versioned siblings (v1.0, v2.0, _v1.1, etc.). The unversioned filename is typically the current production version; versioned files represent prior versions retained for backward compatibility or active parallel use (e.g., REDCap study variants).

### Common Technical Features
- **Post-submission actions:** `ApplyDispositionAction`, `CleanDiagnosisConstructAction`, `CleanPrescriptionConstructAction`, `ExitPatientFromCovidProgramAction`
- **Subform inclusion** for encounter metadata (provider/location/date) and drug orders
- **Velocity/Freemarker** conditionals for role-, gender-, age-, and encounter-type-based field visibility
- **JavaScript** for unit conversions, calculated fields (gestational age, BMI, waist-hip ratio), cross-form data fetching, and form validation
- **Bilingual support** — most forms have French and English label translations
- **Print view** — distinct CSS styling for print layout; surgical/delivery forms include timestamps
