# Verify findings for forms defined in pihemr

Findings of the forms defined in `pihemr`, recorded **once** for every site config repo (see `hfe-e2e-specs.skill.md`, "Findings with no test"). A site spec for an inherited form says `// Findings: see pihemr _findings.e2e.md#<form>` and tags its tests with the V-ids. IDs are numbered per form; format and severity scale as in the skill ("Verify mode"). Findings are verified against the server named in the Source column unless marked unconfirmed.

## section-plan.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-plan.xml (`formUuid`) | `formUuid` `ed673783-ec75-49de-a19f-3976d031aec0` is also the `formUuid` of `ncd-initial.xml` | the server has one Form for both files: on zl-ci `GET form/<uuid>` returns "Plan" with encounter type NCD Initial Consult; an NCD initial encounter and a plan section can be opened as each other | give one of them a new `formUuid` together with a new `formVersion` | zl-ci, ZL spec |
| V2 | Low | section-plan.xml | `id="clinical-management-plan"` is on both the `<section>` and the `<obs>` | duplicate id: selectors and `toggle`/`when` targets are ambiguous | rename one | zl-ci |
| V3 | Info | section-plan.xml | the radiology block depends on the `radiology` component | only the "At HUM, use Radiology order" arm was tested (component on at zl-ci) | | zl-ci. The other arm was tested on the local Liberia server (component off, Family Medicine encounters): the Chest, 1 view (X-ray) checkbox saves `Radiology image order (coded): Chest, 1 view (X-ray)` and the VIEW shows it as `[X]` |

## section-history.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-history.xml (family planning rows) | the "Tubal ligation" row's toggle target id contains a space | its start and end dates are never dimmed/undimmed (`test.fixme` in the ZL spec) | remove the space from the id/target | zl-ci |
| V2 | Low | section-history.xml | `$patient.age < 12` uses the current age, not the age at the encounter date | an encounter entered late for a child who has since turned 12 gets the adult block | use the age at `$encounter.encounterDatetime` | read only, not tested |
| V3 | Low | section-history.xml | typing in the "Specify" text and then clicking a family member's box shifts the layout, so the first click is lost | a click is lost | reserve the space or lay out without shifting | zl-ci |
| V4 | Info | section-history.xml :288, :408 | the adult arm of :408 also lists adult followup, whose visit-page sections have no history; a stale comment at :288 says "NCD only" | none | update the comment | read only |

The shared EDD validators are findings in `_shared.e2e.md` of the site repo (`see _shared V1`).

## section-exam.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-exam.xml (`hasValue()`) | looks for the class `fetus-name`, which does not exist | fetus 2 to 4 are always hidden on load, so a fetus saved in position 2 to 4 is not shown in EDIT (`test.fixme` in the ZL spec) | look for the class the fields really have | zl-ci |
| V2 | Low | section-exam.xml | the seven STI checkboxes render the literal class `{switch}` | the class is never substituted | use the intended class | zl-ci |
| V3 | Low | section-exam.xml | the Obstetrical Exam block shows for every female patient, including a 3-year-old | irrelevant block for children | add an age condition | zl-ci |

## section-chief-complaint.xml, section-peds.xml
No findings: the server behaved as the XML says.

## section-ncd.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-ncd.xml :358-:395 (diabetes diagnosis radio) | the "Type 2 Diabetes requiring insulin" answer is `CIEL:165207` ("Insulin dependent type 2 diabetes mellitus") in the female list and `PIH:12251` ("Type 2 Diabetes requiring insulin") in the male list | the same label saves two different concepts by sex (checked on zl-ci: F saves 165207AAAA..., M saves 855dd525-...), so counts and reports by diagnosis concept split the group (`test.fixme` in the ZL spec) | use the same answer concept in both lists | zl-ci |

## section-sickle-cell.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-sickle-cell.xml :233, :271 | seven `<when value="PIH:YES" thenDisplay="#scd-fui-<tog>-details">` rules (malaria prophylaxis, understands treatment, titrate, adherence, aware, family awareness, "condition improved") point to ids that do not exist; only `#scd-fui-miss-details` does | answering Yes to those questions shows nothing: dead rules, probably missing detail boxes | add the detail boxes or drop the rules | zl-ci |

## section-oncology-history.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-oncology-history.xml :714 | `toggle="pregnant"` on the pregnancy checkbox has no target: there is no `#pregnant` or `.pregnant` element | the LMP / EDD fields are always shown, whether the box is ticked or not (section-history wraps them in `#pregnant`) | wrap the LMP / EDD block in `<div id="pregnant">` or drop the toggle | zl-ci |
| V2 | Low | section-oncology-history.xml :206-264 | typing in the "Cancer / Other, specify" text of the family history and then clicking a member's box loses the click: the blur shows "Select family member(s)" and the layout shifts under the pointer | the first click is lost (same as section-history V3) | reserve the space for the message | zl-ci |

## section-oncology-plan.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-oncology-plan.xml :229, :232 | `id="clinical-management-plan"` is on both the `<section>` and the `<obs>`; the drug and lab order widgets both render `id="order-action-button-NEW"` | duplicate ids in the rendered form: selectors are ambiguous (same as section-plan V2) | rename one of each | zl-ci |

## section-obgyn-initial.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-obgyn-initial.xml :1738 and :2018 | the calculated gestational age / EDD block (`calculated-edd-and-gestational` and its six inner ids) is defined twice, in the "last OB/GYN intake" summary and in the OB/GYN block | duplicate ids in the rendered form: id selectors find only the first (the class-based updates reach both). The inventory's `bp_systolic` / `bp_diastolic` duplicates are in mutually exclusive `ifMode` blocks and are not a finding | give the second block its own ids | zl-ci |
| V2 | Low | section-obgyn-initial.xml :560, :755-:762 | `addAndRemoveMandatory()` writes "[required]" into the `.field-error` of `#pregnancyTrimester` and `#trimesterAtEnrollment`; the change handlers only hide the separate `...Msg` spans | the red "[required]" stays next to the radio after the user has answered it | hide the same element the required text was written to | zl-ci |

## section-obgyn-plan.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | High | section-obgyn-plan.xml :247 (counselling checkboxes, `<repeat>`) | every counselling checkbox carries the same `<when value="CIEL:5622" thenDisplay="#support-freetext">`, so the handlers of the six other boxes hide the target (and clear its text) whenever they run | ticking Hygiene after Other hides "Other support" while Other stays ticked; on EDIT load the div is shown but its textarea is EMPTY although the obs is saved, so the next Save voids the saved obs (confirmed on zl-ci by saving twice and reading the obs back; both `test.fixme` in the ZL spec) | put the `<when>` on the Other checkbox only | zl-ci |
| V2 | Low | section-obgyn-plan.xml :40-88, :110-139 | the medication validation and the show-more / show-less code select `fieldset.medication`, `#medication-2..8` and `#show-more-medications-button`, none of which exist in this form (the order widget has its own markup) | dead code copied from an older plan form: the "dose without units" rules never run | remove it or point it at the order widget | zl-ci |

## section-dx-obgyn.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-dx-obgyn.xml :20-125 | the script loops over all prior OB/GYN intakes (newest first) and overwrites the summary for each one; `section-obgyn-initial.xml` breaks after the first | the summary labelled "most recent OB/GYN intake" shows the OLDEST prior intake (checked on zl-ci: intakes with gravida 1 (5 days ago) and 3 (2 days ago) show 1; `test.fixme` in the ZL spec) | `break` after the first qualifying encounter | zl-ci |
| V2 | Info | encounterTypeConfig.js `pihcore-diagnosis-obgyn` | the entry has an active `templateModelUrl` for this form, but its `longTemplate` `dxLong.page` renders the encounter's obs itself | the form's own VIEW (`ifMode`) is never shown on the visit page (same as section-dx) | none needed | zl-ci |

## labResults.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | labResults.xml :1659, :1792 | `id="urine-leuko"` is on two obs: the dipstick leukocytes radio (CIEL:161441) and the microscopy leukocyte count (PIH:14284), both from `urine-{message}` templates (2 elements with that id in the rendered form) | the labels' `for` and any `#urine-leuko` selector or link reach only the first; E2E locators are ambiguous | give the microscopy row its own message key, e.g. `leuko-count` | kgh-ci |
| V2 | Low | labResults.xml :103-111 | the min/max coupling of the two dates runs only in the `change` handlers: on load the date of test results has no `minDate` (checked: `datepicker('option','minDate')` is null) and the specimen date defaults to now in ENTER; `const encounterDate` (:109) is computed and never used | until the specimen date is touched (always, in EDIT), a date of test results earlier than the specimen collection date can be picked and saved (checked on kgh-ci: specimen today, results date 3 days earlier, saved) | set `minDate` from the specimen date on load (use the unused `encounterDate`) | kgh-ci |
| V3 | Low | labResults.xml :156, :179, :1080, :1335, :793-794 | `<label for="location">`, `for="specimen-collection-date"`, `for="tb-skin-test"`, `for="parasitemia"` and the `T3`/`T4` labels name ids that do not exist in the rendered form | clicking those labels focuses nothing | point `for` at the real ids (`encounter-date`, ...) or drop it | kgh-ci |
| V4 | Info | labResults.xml :4 | `SetObsDatesToSpecimenCollectionDateAction` looks for a PIH:3038 "specimen collection date" obs; this form has none (the specimen date is the encounter date, :185) | the action never changes anything; the obs dates already equal the encounter date (checked on kgh-ci) | remove the action, or keep it knowing it is dead | kgh-ci |
| V5 | Info | labResults.xml :124-134 | choosing "Beyond detectable limit" fills the lower limit with 839 copies/mL, "the standard for the Haiti national" (comment), in ENTER | a Sierra Leone user gets a Haiti default that is saved unless changed | make the default configurable per country, or drop it for SL | kgh-ci |
| V6 | Low | labResults.xml :1003-1007 in pihemr (:1004-1008 in the ZL copy) (`hiv-rapid-control`) | the "Control test" checkbox is `CIEL:164860` answered `CIEL:1065`; that concept is named "Rapid HIV antibody test result at 18 months of age" (unconfirmed that it is not the intended one) | the saved obs reads "Rapid HIV antibody test result at 18 months of age: Yes" for a ticked "Control test" (checked in the REST obs of a ZL test encounter); a report or the obs list of the chart shows the 18-month meaning | confirm the concept with the lab team; use a dedicated concept (e.g. a control-test marker) if it is not meant to be the 18-month result | zl-ci |

## patientRegistration-rs.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | patientRegistration-rs.xml :2-3, :53 | the file's comment says "Provides form for 'retrospective' check-in" and the location heading uses `mirebalais.retrospectiveCheckin.location.label`, but the form is the registration encounter's who/when/where | none visible (the labels resolve on kgh-ci: "Registration Details", "Date", "Provider", "Location"); the stale comment misleads maintainers | correct the comment | kgh-ci |

## section-prescriptions-print.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | section-prescriptions-print.xml :23 | the template prints "Prescription construct" obs groups, and the printer icon of the plan section (`defaultPlanSectionActions.gsp`, `ng-show` on those obs) depends on them too, but `section-plan.xml` and `section-plan-medication.xml` now save medications as drug orders (`drug-order-widget.xml`), never as that obs group (only the legacy `section-plan_v1.0`, `section-plan-medication_v1.1` and a few older forms still do) | for every encounter entered with the current forms the printer icon is hidden and the print template returns no "Medication n" block (checked on kgh-ci with a saved drug order: the section heading lists the drug, no icon; `test.fixme` in the SL spec) | show the icon when the encounter has drug orders, and render the orders in the print form | kgh-ci, zl-ci (same on zl-ci: with a saved drug order the print template returns an empty "Medication orders" block and the icon is hidden; with a REST-created `Prescription construct` group the template and the icon work; `test.fixme` in the ZL spec); same on the local Liberia server (Family Medicine Intake; `test.fixme` in the Liberia spec) |
| V2 | Low | section-prescriptions-print.xml :80-86 | the printed prescription has no patient name or id, date or prescriber, only the medications and an empty signature line | a paper prescription cannot be tied to a patient or an encounter | add patient, date and provider | kgh-ci |
| V3 | Low | section-prescriptions-print.xml :4-16 | the `<style>` rules (`form fieldset { display: block }`, `p.radio > *`) are unscoped and the HTML is bound into the visit page | they apply to the whole visit page while the print template is shown | scope them under `#prescriptionsDiv` | kgh-ci |
| V4 | Low | section-prescriptions-print.xml :82 | "Signature:" is hard-coded English; every other label uses a message code | not translated | use a message code | kgh-ci |

## section-c-section.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | High | section-c-section.xml :251 (and section-delivery.xml :420-426) | the "Procedure performed" radio (CIEL:1651, answers C-section variants) and the delivery section's two procedure checkboxes (CIEL:1651 answers "suture of the perineum" and "episiotomy") edit the same concept on the same MCH Delivery encounter; HFE hands the radio the first existing CIEL:1651 obs | saving the C-section after the delivery section REPLACES "Suture of female perineum" with the chosen caesarean answer (the episiotomy stays): obs of the delivery section are lost with no message, and the delivery section opens without it (checked on zl-ci by saving both and reading the obs back; `test.fixme` in the ZL spec). The other direction (delivery re-save after the c-section) keeps both | give the c-section procedures their own concept (or answers the delivery section does not use), or merge the two forms | zl-ci |
| V2 | Low | section-c-section.xml :269-275 | the adhesion diagnoses are saved as `Visit Diagnoses` groups but the form has no `CleanDiagnosisConstructAction` (section-delivery has it) | the groups carry no "Diagnosis order" (checked on zl-ci: delivery diagnoses get "Secondary", the adhesion none); the visit page still lists them, whether reports that read the order skip them is unverified | add the postSubmissionAction | zl-ci |
| V3 | Low | section-c-section.xml :157, :162 | the script resizes the textareas of `#post-op-surgical-note`, an id the form does not have | dead code: the textareas do not grow with their content | use an existing container or remove the script | zl-ci |

## section-delivery.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | High | section-delivery.xml :420-426 (with section-c-section.xml :251) | both sections save "Procedure performed" (CIEL:1651) on the same encounter; the c-section's radio takes over the delivery's first answer | see section-c-section V1 (tested in the c-section spec) | see section-c-section V1 | zl-ci |
| V2 | Medium | section-delivery.xml :133-170 | `hasValue()` reads `.baby-name input`, a class no element has, so it is always empty and `hideOtherBabies()` runs on every load | on EDIT newborns 2-4 are hidden even when saved (confirmed on zl-ci: the saved answer is in the hidden newborn 2; the user must press "Show More" to see it; `test.fixme` in the ZL spec) | test the real inputs of `#baby-N` (any `input[type=text]` value or checked radio) | zl-ci |
| V3 | Medium | section-delivery.xml :191-211 | the script parses the 'yyyy-MM-dd' EDD (UTC midnight) and reads the LOCAL date parts | in browsers west of UTC (Haiti) the calculated EDD is shown one day early: saved 6 Dec 2026, shown 5 Dec 2026 (checked on zl-ci with the browser in America/Port-au-Prince; `test.fixme`) | build the date with `new Date(y, m-1, d)` or use UTC getters | zl-ci |
| V4 | Medium | section-delivery.xml :214 | on load `displayGestationalAge(new Date(deliveryDateField.text()), lastEddDate)` passes the calculated EDD itself as the delivery date | the gestational age reads "40 weeks" on every load, whatever the (saved) delivery date; only right after the delivery date is changed (checked on zl-ci: delivery 31 days before the EDD shows 40 weeks on load and 35 4/7 after a change; `test.fixme`) | pass the delivery date field's value (and hide the age while it is empty) | zl-ci |
| V5 | Low | section-delivery.xml :565-579 | the Apgar labels are `<uimessage code="1 minute"/>`, `"5 minutes"`, `"10 minutes"`: not message codes | English in every locale | use message codes | zl-ci |
| V6 | Low | section-delivery.xml :518-761 | a newborn group saved with newborn 1 empty (only newborn 2, 3 or 4 filled) is not loaded into any newborn on EDIT | checked on zl-ci: the group stays saved and a re-save keeps it, but the user who fills only the second twin sees an empty form when coming back | unconfirmed cause (HFE group matching); fill newborn 1 first or key the groups on the birth-order obs | zl-ci |

## section-comments.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-comments.xml (whole file); encounterTypeConfig.js `section-comments` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the remark can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci); the parent home-assessment encounters come from outside this repo (how: unverified) | none needed if the CHW app enters it | zl-ci |
| V2 | Low | section-comments.xml :65, :68 | `headerCode` and `<uimessage code="pihcore.comments.title"/>` have no message on zl-ci | the entry page prints the raw code as the section title and legend (the VIEW hides them by style) | add the message or use `pihcore.remarks` | zl-ci |

## section-return-visit-date.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-return-visit-date.xml (whole file); encounterTypeConfig.js `section-return-visit-date` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the date can be shown (VIEW) but not entered or corrected from the EMR (checked on zl-ci); Maternal Follow-up (`690670E2`) does not list the section at all | none needed if the CHW app enters it | zl-ci |
| V2 | Low | section-return-visit-date.xml :66 | `headerCode="pihcore.returnVisitDate.title"` has no message on zl-ci | the entry page prints the raw code as the section title (the VIEW hides it by style) | add the message or use `pihcore.consult.returnVisitDate` | zl-ci |

## section-education-subjects.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-education-subjects.xml :79-107 | the six `<obs ... answerConceptId="..." answerCodes="...">` use the plural `answerCodes` with a singular `answerConceptId`, so HFE ignores the labels (the mechanical scan does not flag it) | the checkboxes and the VIEW print the concept names ("Counseling, danger signs of pregnancy", "Antenatal counseling, good nutrition", "Family planning counseling") instead of the form's messages ("Danger signs", "Good nutrition", "Family planning"); `section-postpartum-counsel.xml` uses the singular `answerCode` and shows its messages (checked on zl-ci) | use `answerCode="..."` on each of the six obs | zl-ci |
| V2 | Info | section-education-subjects.xml (whole file); encounterTypeConfig.js `section-education-subjects` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the subjects can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci); only the Prenatal type (`91DDF969`) lists the section | none needed if the CHW app enters it | zl-ci |

## section-family-planning-simple.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-family-planning-simple.xml (whole file); encounterTypeConfig.js `maternal-family-planning` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the methods can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci); only Maternal Post-partum (`0E7160DF`) and Maternal Follow-up (`690670E2`) list the section | none needed if the CHW app enters it | zl-ci |

## section-maternal-danger-signs.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-maternal-danger-signs.xml (whole file); encounterTypeConfig.js `section-maternal-danger-signs` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has `editUrl: ""` | the signs can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci for the Prenatal, Post-partum and Pediatric types, which are the ones that list the section; Maternal Follow-up matches no `includeIf` and renders the heading only) | none needed if the CHW app enters it | zl-ci |

## section-maternal-vital-signs.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-maternal-vital-signs.xml (whole file); encounterTypeConfig.js `section-maternal-vital-signs` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the vital signs can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci for all four home-assessment types) | none needed if the CHW app enters it | zl-ci |

## section-mch-referral.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | section-mch-referral.xml :61-72 and the Save at :276 | (unconfirmed for real data) the form re-saves every obs of the encounter with the encounter's location; an obs that has no location (as a plain REST client creates it) makes the Save fail with "Editing the fields [location] on Obs is not allowed" | the referral status and remark cannot be saved on an encounter whose CommCare obs carry no location (reproduced on zl-ci with REST-created obs; whether the CommCare import sets the location is unverified) | make the import write the location, or tolerate a missing location | zl-ci |
| V2 | Info | section-mch-referral.xml :61-72 | the script sets the hidden "Type of referral ordered" dropdown of every row present, so every Save writes a `Referral construct` group for every row, also for a row with no status and no remark | a Save without touching any row stores six empty referral groups (type only); the VIEW then shows those rows with no status; a re-save does not duplicate them (checked on zl-ci) | by design for referrals ordered by CommCare; document it | zl-ci |

## section-postpartum-counsel.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | section-postpartum-counsel.xml (whole file); encounterTypeConfig.js `section-postpartum-training` | the form has no Save or Cancel button and its entry in `encounterTypeConfig.js` has no `editUrl` | the counselling can be shown (VIEW) but not entered or corrected from the EMR; the edit URL opens a form with no way to save (checked on zl-ci); only the Pediatric, Maternal Post-partum and Maternal Follow-up types list the section | none needed if the CHW app enters it | zl-ci |

## drugOrder.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | drugOrder.xml (whole form) | nothing requires a medication: provider and location default, the order widget is optional | Save with no medication creates an empty "Order Medication" encounter (the visit page lists it as "NO DATA ENTERED"; no order is written) | require at least one order row, or refuse an empty save | zl-ci |
| V2 | Info | subforms/drug-order-widget.xml | the section that holds orders of earlier encounters is headed "Active Orders" in ENTER/EDIT and "Revised Orders" in VIEW | the same block has two names (probably the VIEW lists what this encounter revised or stopped; unconfirmed) | none needed if intended | zl-ci |

## edNote.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | edNote.xml :37-66, :113-124 | `validateForm()` needs a `.diagnosis` chip; the "Non-coded diagnosis" checkbox and its text (PIH:7416) do not count (`allowNonCoded="false"`), unlike `outpatientConsult.xml`, where the non-coded text alone is enough | an ED note whose only diagnosis is non-coded cannot be saved: Save stays disabled although the form offers the text box (tested; the text is an add-on to a coded diagnosis) | say so in the label, or accept the text as the diagnosis | zl-ci |
| V2 | Low | edNote.xml :7-30 | the style block is inside `<ifMode mode="EDIT">` (same as `outpatientConsult.xml`) | the disposition / checkbox layout rules are not applied on first entry (ENTER), only when editing (unconfirmed visually) | `ifMode VIEW include="false"` | zl-ci |
| V3 | Low | edNote.xml :72-78, :74 | `updateTraumaQuestions` logs `getValue("trauma.value")` with `console.log` on every change; `traumaFieldName` (:66, :82) is assigned and only used by a commented-out line | debug output in the browser console of every user | remove the log and the unused variable | zl-ci |

## surgicalPostOpNote.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | surgicalPostOpNote.xml :323-375 (`encounterProviderAndRole ... autocompleteProvider="true" providerRoles=...`) | the attending surgeon is `required` but the autocomplete only offers providers with the surgeon roles (`3182ee51-...`, `556ceee6-...`); assistants, anesthesiologists and nurses are limited the same way | a clinician whose provider has none of those roles cannot be recorded in any provider field (checked on zl-ci: the harness user's name is not offered); the hidden `<id>_hid` field takes any provider id and the server saved it, so the limit is only in the search box | none needed if intended; say so for fixtures | zl-ci |
| V2 | Low | surgicalPostOpNote.xml :517-550, :585-650 | the "If yes, specify ..." text fields (transfusion type and volume, antibiotic name, pathology sample, lab specimen, implant) have no `<when>` / `toggle` tie to their yes/no radio | a text can be saved next to "no" (unconfirmed: not saved by the specs); the question is always shown | toggle the follow-up fields on "yes" | zl-ci |
| V3 | Info | surgicalPostOpNote.xml :505, :526-550, :567 | the volume fields are in litres (IVF and blood loss, at most 20 by the concept's range) and units (a transfusion, at most 12); a value such as 500 is refused on blur with "Cannot be greater than 20" and Save is blocked | users used to millilitres are stopped by the range message (tested: `volumes outside the concept range...`) | none; consider showing the unit before the field | zl-ci |

## cancelAdmission.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | cancelAdmission.xml :37 | the Confirm handler calls `('.submitButton').click()` without `jq`: `TypeError: ".submitButton".click is not a function` | every Confirm of the "reason does not match the disposition" dialog throws an uncaught error (checked on zl-ci); the cancellation is still saved only because the Confirm `<button>` has no `type` and so submits the form by itself (`test.fixme` in the ZL spec) | `jq('.submitButton').click()`, and give the button `type="button"` | zl-ci |
| V2 | Low | cancelAdmission.xml :133 (message `mirebalais.cancelAdmissionNote.confirmWhenDispositionDoesNotMatch`) | the dialog says "Cancel to return to the queue", but Cancel only closes the dialog: the user stays on the form | misleading text (tested) | reword ("return to the form") | zl-ci |
| V3 | Low | cancelAdmission.xml :54-58 | `mostRecentDispositionName` is `fn.message($visit.mostRecentDisposition.name)`: empty when the visit has no disposition | the dialog reads "... the most recent consultation note ()." with empty parentheses (tested) | print "none" / skip the dialog when there is no disposition | zl-ci |

## admissionNote.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | admissionNote.xml :201-220 | the two wristband `includeIf` blocks test different things: the first uses `$visit.mostRecentCheckInEncounter.location` for all six locations, the second uses `$visit.checkInEncounter.location` for Ijans only and `mostRecentCheckInEncounter` for the other five; a visit with no check-in has null locations in both | the buttons' order (the default focus) is Yes-first for a visit without check-in and may differ for a visit whose first and latest check-ins differ (unconfirmed; the Yes-first order was seen for a visit with no check-in) | use `mostRecentCheckInEncounter` in both | zl-ci |
| V2 | Low | admissionNote.xml :96-117 | `success = data.success` is an implicit global, set inside a callback that only runs because `jq.ajaxSetup({async:false})` makes the request synchronous (and is reset after it) | a synchronous request freezes the page while the printer answers; the "Yes" path was not run (it prints on a real printer) | declare `var success`, use a Promise / callback | zl-ci (read only) |
| V3 | Info | encounterTypeConfig.js `260566e1-...` | no `templateModelUrl` and `showOnVisitList` unset; the visit page renders only the diagnoses (`admissionLong.page`) | the form's own VIEW is never shown (the ward is in the card header; no date or provider block) | none needed if intended | zl-ci |

## socio-econ.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | socio-econ.xml :23-24 | `id="where"` is on both the wrapping `<div>` and the `<p>` inside it (ENTER and EDIT) (2 elements with that id in the rendered form; `page.locator('#where')` is a strict-mode violation) | `#where` selectors and label links reach only the first; E2E locators are ambiguous | rename one of them | zl-ci |
| V2 | Low | socio-econ.xml :270-282 | the two "daily activity" questions (what the patient did before the illness, whether the illness stops it) are plain Kreyol text in `<label>`, not `<uimessage>` codes | English and French users see Kreyol; the VIEW shows the same text | add message codes (`pihcore.socioEconomic.*`) | zl-ci |

## vaccination-only.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | vaccination-only.xml :35-43, :46-70 | in EDIT the form shows `.htmlform` with the heading and a read-only who / where / when table, the real widgets are in a `display:none` div, and nothing submits (no `<submit>`, no button; `setUpNextAndSubmitButtons()` finds none) (checked on zl-ci) | the form can be opened for EDIT by URL but nothing in it can be changed or saved; the visit page offers no edit link for this encounter (no `editUrl`), so users do not reach it | drop the EDIT branch, or add a Save button if editing the provider / location / date is wanted | zl-ci |
| V2 | Low | vaccination-only.xml :55-58 | the provider cell is `$ui.format($encounter.provider)` while the encounter provider is saved with the role `4f10ad1a-...` (cause: `Encounter.getProvider()` returning only a provider without a role, unconfirmed) | the "Provider" cell of the who / where / when block is blank in EDIT for an encounter the form itself created (tested: `test.fixme` in the spec) | format the encounter's providers by role (or the role-aware lookup the other forms use) | zl-ci |
| V3 | Info | vaccination-only.xml :22-34 (ENTER script) | the form is submitted at once when the encounter location has a value; with no location it shows the form and hides `#next`, but the form has no Save button (the comment says the case is assumed not to occur) (unconfirmed: the session location of the test user is always set) | a user whose session location cannot be used would see an empty page and no way to continue | submit a default, or show a Save button in that branch | zl-ci |

## mentalHealth.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | mentalHealth.xml :241, :250, :259 (+ :293), :511 / :663, `radio_button_container` x14 | `id="who"` is on three `<p>` in one block, `id="mh_scores"` on two sections (Scores and Status), `id="radio_button_container"` on 14 divs (and `who-when-where` / `where` / `when` / `encounterDate` once per privilege variant, only one of which renders) | `#who`, `#mh_scores` selectors, CSS and anchors reach only the first element; E2E locators are ambiguous | unique ids (`mh_status`, ...) | zl-ci |
| V2 | Low | mentalHealth.xml :945-946, :965-967 | `toggleName` of CIEL:115810, CIEL:134015 (handicapsIntellectuelsLeger / Modere) and PIH:20596-20598 (autism1-3) names no element (the autism sub-list template has no `toggle=`) | ticking those boxes shows nothing; the sub-lists they were meant to open do not exist | remove the attributes or add the sub-lists | zl-ci |
| V3 | Low | mentalHealth.xml :151-166 | the `.medication-checkbox > input:checkbox` handler (enable the row's inputs only when the box is ticked) finds no element: the form and the order subform have no such class (0 elements on zl-ci) | dead code left from the old medication table | remove it | zl-ci |
| V4 | Low | mentalHealth.xml :1002 / :1599 (CIEL:119570), :1461 / :1635 (CIEL:124258) | the same diagnosis answer of `PIH:Mental health diagnosis` is a checkbox in two groups (the two copies have the same value) | ticking both copies saves the diagnosis twice (checked on zl-ci: two identical obs "Mental health diagnosis: Delusional disorder"); a diagnosis count in a report doubles | remove one copy of each | zl-ci |
| V5 | Info | mentalHealth.xml :915 | the `<when value="CIEL:1408" thenDisplay="#high-ssi"/>` is commented out (UHM-8407), so the "if high" block (safety plan ...) is shown with every screening result | users see the high-risk questions for a low result; the comment cites UHM-8407, whose text was not read, so the intent is unverified | none if intended | zl-ci |


## primary-care-adult-initial.xml, primary-care-adult-followup.xml, primary-care-peds-initial.xml, primary-care-peds-followup.xml
No findings: the four forms are the encounter-with-sections.xml shell and the server behaved as the XML says (ENTER auto-submit, EDIT, required provider, Next, the sections of each encounter type and the age gate of the peds sections, all tested on zl-ci). `formUuid` of the four is unique across the merged htmlforms directory. Findings of the sections they compose: see the `section-*` entries above; of the shell and EPLD: `_shared.e2e.md` of the site repo.

## dispensing.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | dispensing.xml `<script>` (the `htmlForm.getBeforeValidation().push(...)` block, outside any `ifMode`) | the script is not wrapped in `<ifMode mode="VIEW" include="false">`, so it also runs in VIEW on the visit page, where `htmlForm` is not defined | "ReferenceError: htmlForm is not defined" in the console each time a saved dispensing encounter is expanded on the visit page (Angular's exception handler logs it; nothing visible breaks). TESTED (`test.fixme`, hiv-ci) | wrap the script in `<ifMode mode="VIEW" include="false">` | hiv-ci, ZL spec |
| V2 | Low | dispensing.xml `<obs id="Timing of hospital prescription">`, `<obs id="Discharge location">` | ids with spaces | `#id` selectors are invalid CSS: scripts and tests need `[id="..."]` | use ids without spaces | hiv-ci (seen) |
| V3 | Low | dispensing.xml `<script>`, the blur handler of `.medication input.emptyValue` | `jq(this).siblings('input[type="hidden"]').length = 0` assigns instead of comparing | the handler always takes the else branch: only the re-highlighting of a field that was filled after a failed save is wrong | `== 0` | by reading |
| V4 | Low | dispensing.xml `<script>`, `"All fields are required!"` | an English literal, while the other error is `<uimessage code="dispensing.error.missingRequiredFields"/>` | French / Haitian Creole users see English when the form is saved with no medication | use a message code | hiv-ci (seen) |
| V5 | Info | dispensing.xml, the sysAdmin block `<encounterProviderAndRole providerRoles="8fd1552e-...,7ec19cca-..." required="true">` | the provider select lists only providers with the role Pharmacist or Pharmacy Aide, and the provider is required | a user holding the sysAdmin role but no such provider (the `admin` account of the local hiv-ci test server, which has none) sees an empty select and cannot save; the e2e spec creates a synthetic Pharmacist provider | none needed if intended (the form is meant for pharmacy staff) | hiv-ci |

## comment.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | comment.xml `<obs conceptId="PIH:CLINICAL IMPRESSION COMMENTS">` | no `required="true"`: provider, location and date default, the remark is optional | Save with nothing typed creates an empty "Comment" encounter (the visit page lists it with no data). TESTED (asserted as the current behaviour) | require the remark, or refuse an empty save | hiv-ci |

## ncd-initial.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Medium | ncd-initial.xml (`formUuid`), consequence of section-plan V1 | the EDIT page is rendered from `ncd-initial.xml`, but its save posts `htmlFormId` (one id, since the server has one Form for the two files that share the `formUuid`); on zl-ci, saving the shell in EDIT with the required provider blanked was accepted (the page left for the visit page, no "Required") in most runs, while `ncd-followup.xml` (own `formUuid`) refused it in every run. Cause: unconfirmed, consistent with the save validating against the other file's definition (`section-plan.xml` has no provider widget) | the "required provider" rule of the NCD initial shell is not reliably enforced, and which definition validates a save can change between runs | give one of the two files a new `formUuid` together with a new `formVersion` (as for section-plan V1) | zl-ci, ZL spec (TESTED, `test.fixme`; also `test.fixme` that the encounter's Form is named "NCD Initial", it is "Plan"). The visit page's own edit link (no `definitionUiResource`) did open the NCD initial shell in every run |

## echocardiogram.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | echocardiogram.xml:287 (`ltVentDim` row) | `answerCodes="Dilitation,pihcore.normal,pihcore.cantEval"`: the first entry is a misspelled literal, not a message code | the answer is shown as "Dilitation" (also in VIEW and EDIT) in every language | add a message code ("Dilatation") like the other rows | zl-ci. TESTED (`test.fixme`) |
| V2 | Low | echocardiogram.xml:15, :190 | `id="echo"` is on both the `<htmlform>` and the study table `<div>` | duplicate id: selectors and scripts for `#echo` are ambiguous | rename one | zl-ci. TESTED |
| V3 | Low | echocardiogram.xml:45-97 | the script handles `.diagnosis`, `.diagnosis-primary` and `.diagnosis-secondary` elements; this form has none (copied from the oncology forms) | none, dead code | remove the script | read; the elements are absent from the rendered form |
| V4 | Info | echocardiogram.xml:245 | `answerConceptIds="PIH:Severe pericardial effusion,PIH:13612,,PIH:No pericardial effusion,PIH:13596"` has an empty entry | none: the pericardium row renders its four answers | remove the extra comma | zl-ci |

## oncologyTreatment.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | oncologyTreatment.xml:192 | `stateLabels="curatif,palliatif"` are hard-coded French words (the rest of the form uses message codes) | an English or Creole user sees "curatif / palliatif" as the treatment intent options | use message codes | zl-ci. TESTED (`test.fixme`) |
| V2 | Low | oncologyTreatment.xml:15 | the root `<htmlform id="oncology-intake">` (copied from the oncology intake form) | misleading id; selectors written for the intake form match this form too | rename it | zl-ci. TESTED |

## oncologyIntakeConsult.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | oncologyIntakeConsult.xml:24-49 | the ENTER and EDIT scripts call `jq('.htmlform').show()`, but this form has no `.htmlform` element (the content is not hidden, unlike `subforms/encounter-with-sections.xml` it was copied from) | none: the form is shown anyway; with no tagged session location it stays open, otherwise it auto-submits | remove the calls or add the wrapper | zl-ci |

## chemotherapyTreatment.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | chemotherapyTreatment.xml :174 | the pain scale dropdown is `answers="0,1,2,...,10"` on a numeric concept with a decimal precision | the options read "0.0", "1.0" ... "10.0" (checked on zl-ci) | list the options as the whole numbers the clinicians use (or give the concept no precision) | zl-ci. TESTED (the save test picks "4.0") |
| V2 | Info | chemotherapyTreatment.xml :58 | who / where / when is `encounter-provider-location-date.xml` with its default tag (Consult Note Location); the visit action requires the session location to be a Chemotherapy Location (2 on zl-ci) | the form's location select offers every Consult Note Location, so a chemotherapy session can be recorded at a location that cannot offer the form; at zl-ci the session location (Klinik Ekstèn, not a Chemotherapy Location) is preselected | override the location widget with `tags="Chemotherapy Location"` as the COVID forms do with their tag | zl-ci |

## obGyn.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Info | obGyn.xml:24-49 | the ENTER and EDIT scripts call `jq('.htmlform').show()`, but this form has no `.htmlform` element (same as oncologyIntakeConsult.xml V1) | none: the form is shown anyway; with no tagged session location it stays open, otherwise it auto-submits | remove the calls or add the wrapper | zl-ci |

## covid19Intake.xml, covid19Followup.xml, covid19Discharge.xml
| ID | Severity | Location | Problem | User-visible consequence | Fix | Source |
|---|---|---|---|---|---|---|
| V1 | Low | covid19Intake.xml :144-222 | `<includeIf velocityTest="$patient.gender == 'F' ">` wraps the pregnancy block (pregnant Yes / No, LMP, EDD, calculated EDD and gestational age, postpartum state) with no age condition, while the health care worker block has `age > 16` and the child blocks `age < 14` / `age < 1` | a newborn girl is asked whether she is pregnant, for her last period and due date, and whether she is postpartum (checked on zl-ci: a female patient under 1 year gets the infant block AND the pregnancy block) | add an age floor (for example `$patient.age >= 10` as `patientIsReproductiveAge()`) | zl-ci. TESTED (Intake spec) |
| V2 | Low | covid19Intake.xml :93-99, covid19Followup.xml :71-77, covid19Discharge.xml :75-81 (also oncologyTreatment.xml, echocardiogram.xml) | the hidden print block uses `<uimessage code="pih.form.created_on"/>`, `pih.form.last_updated_on`, `pih.form.printed_on`; the messages are `pihcore.form.*` (the other print blocks, e.g. chemotherapyTreatment.xml, use those) | the printed form's footer reads "pih.form.created_on: 12/May/2020" instead of "Created: ..." (checked on zl-ci for the discharge, oncologyTreatment and, as the control, chemotherapyTreatment forms) | use `pihcore.form.created_on` / `last_updated_on` / `printed_on` | zl-ci |

The three forms' shared script (the disposition validation) and `ExitPatientFromCovidProgramAction` behaved as the XML and the action say (tested on zl-ci: Transfer out without its field is refused, Discharge completes the active COVID-19 enrolment with the outcome "Treatment stopped", also for an enrolment made by an intake of the same day). The EDD scripts of the intake are `_shared` V1 / V7 of the site repo.
