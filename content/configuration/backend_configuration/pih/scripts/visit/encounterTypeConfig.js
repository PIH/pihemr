angular.module("encounterTypeConfig", [])

    .factory("EncounterTypeConfig", function() {

        var hfeSimpleEditUrl = "/htmlformentryui/htmlform/editHtmlFormWithSimpleUi.page?patientId={{encounter.patient.uuid}}&encounterId={{encounter.uuid}}&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}";
        var hfeStandardEditUrl = "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{encounter.patient.uuid}}&encounterId={{encounter.uuid}}&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}";

        var getFormResource = function(formName) {
          return "file:configuration/pih/htmlforms/" + formName;
        };

        // template model url:
        // if a template operates off an model different that the standard OpenMRS REST representation of an encounter,
        // you specify the URL of the source here; used currently for htmlFormEntry encounter templates, which
        // require the encounter to be formatted using the HFE schema

        /* Define Sections */
        var chiefComplaint = {
            type: "encounter-section",
            id: "pihcore-chief-complaint",
            label: "pihcore.chiefComplaint.title",
            icon: "fas fa-fw fa-list-ul",
            classes: "indent",
            shortTemplate: "templates/sections/chiefComplaintSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-chief-complaint.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=file:configuration/pih/htmlforms/section-chief-complaint.xml&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        // we include the edit url here because the "Next" navigator functionality uses it
        var allergies = {
            type: "include-section",
            id: "allergies",
            template: "templates/allergies/reviewAllergies.page",
            editUrl: "/allergyui/allergies.page?patientId={{patient.uuid}}&returnUrl={{returnUrl}}"
        };

        var vaccinations = {
            id: "vaccinations",
            type: "include-section",
            template: "templates/vaccination/vaccinations.page",
            editUrl: ""
        };

        var pedsVaccinations = {
            type: "include-section",
            id: "vaccinations",
            template: "templates/vaccination/vaccinations.page",
            editUrl: "",
            require: "fullMonthsBetweenDates(visit.patient.person.birthdate, visit.startDatetime) < 15*12"
        };

        var ancVaccinations = {
            type: "include-section",
            id: "vaccinations",
            template: "templates/vaccination/vaccinations.page",
            editUrl: "",
            require: "patient.person.gender == 'F'"
        };

        var generalVaccinations = {
            type: "include-section",
            id: "vaccinations",
            template: "templates/vaccination/vaccinations.page",
            editUrl: ""
        };

        var primaryCareHistory = {
            type: "encounter-section",
            id: "pihcore-history",
            label: "pihcore.history.label",
            icon: "fas fa-fw fa-history",
            classes: "indent",
            shortTemplate: "templates/sections/primaryCareHistorySectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-history.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-history.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var primaryCareExam = {
            type: "encounter-section",
            id: "physical-exam",
            label: "pihcore.exam.label",
            icon: "fas fa-fw fa-stethoscope",
            shortTemplate: "templates/sections/examSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-exam.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-exam.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var pedsFoodAndSupplements = {
            type: "encounter-section",
            id: "pihcore-peds",
            label: "pihcore.foodAndSupplements.label",
            icon: "fas fa-fw fa-utensils",
            shortTemplate: "templates/sections/pedsSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-peds.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-peds.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}",
            require: "fullMonthsBetweenDates(visit.patient.person.birthdate, visit.startDatetime) < 15*12"
        };

        var primaryCareDx = {
            type: "encounter-section",
            id: "pihcore-diagnosis",
            label: "pihcore.diagnosis.label",
            icon: "fas fa-fw fa-diagnoses",
            shortTemplate: "templates/sections/dxSectionShort.page",
            longTemplate: "templates/sections/dxLong.page",
            //templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-dx.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-dx.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var obgynDx = {
            type: "encounter-section",
            id: "pihcore-diagnosis-obgyn",
            label: "pihcore.diagnosis.label",
            icon: "fas fa-fw fa-diagnoses",
            shortTemplate: "templates/sections/dxSectionShort.page",
            longTemplate: "templates/sections/dxLong.page",
            //templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-dx-obgyn.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-dx-obgyn.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var primaryCarePlan = {
            type: "encounter-section",
            id: "pihcore-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            shortTemplate: "templates/sections/primaryCarePlanSectionShort.page",
            longTemplate: "templates/sections/viewPlanSectionWithHtmlFormLong.page",
            printTemplate: "templates/sections/printPrescriptionsWithHtmlFormLong.page",
            printTemplateUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-prescriptions-print.xml"),
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"

        };

        // Sierra Leone has one Plan section used on it's Outpatient forms, and then a medication-only
        // plans section used on other forms, so we need a separate "medication plan" section for that
        var primaryCarePlanMedication = {
          type: "encounter-section",
          id: "pihcore-plan-medication",
          label: "pihcore.visitNote.plan",
          icon: "fas fa-fw fa-list-ul",
          shortTemplate: "templates/sections/primaryCarePlanSectionShort.page",
          longTemplate: "templates/sections/viewPlanSectionWithHtmlFormLong.page",
          printTemplate: "templates/sections/printPrescriptionsWithHtmlFormLong.page",
          printTemplateUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-prescriptions-print.xml"),
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-plan-medication.xml"),
          editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-plan-medication.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"

        };

        var ncd = {
            type: "encounter-section",
            id: "pihcore-ncd",
            label: "pihcore.visitNote.ncdInitial",
            icon: "fas fa-fw fa-heart",
            shortTemplate: "templates/sections/ncdSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }

        // ToDo: ncdInitial and ncdFollowup are the same and replaced by ncd
        var ncdInitial = {
            type: "encounter-section",
            id: "pihcore-ncd",
            label: "pihcore.visitNote.ncdInitial",
            icon: "fas fa-fw fa-list-heart",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }
        var ncdFollowup = {
            type: "encounter-section",
            id: "pihcore-ncd",
            label: "pihcore.visitNote.ncdFollowup",
            icon: "fas fa-fw fa-heart",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }

        var ncdHistory = {
            type: "encounter-section",
            id: "pihcore-ncd-history",
            label: "pihcore.history.label",
            icon: "fas fa-fw fa-history",
            classes: "indent",
            shortTemplate: "templates/sections/ncdIntroSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-history.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-history.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var ncdFollowupHeader = {
            type: "encounter-section",
            id: "pihcore-ncd-followup",
            label: "pihcore.ncd.plan.title",
            icon: "fas fa-fw fa-heart",
            classes: "indent",
            shortTemplate: "templates/sections/ncdIntroSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-followup.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-followup.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var ncdPlan = {
            type: "encounter-section",
            id: "pihcore-ncd-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            classes: "indent",
            shortTemplate: "templates/sections/obgynPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var ncdHospital = {
            type: "encounter-section",
            id: "pihcore-hospital",
            label: "pihcore.hospitalized",
            icon: "fas fa-fw fa-hospital-symbol",
            classes: "indent",
            shortTemplate: "templates/sections/hospitalSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-hospital.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-hospital.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var ncdOverviewNote = {
            type: "encounter-section",
            id: "pihcore-ncd-overview",
            label: "pihcore.lab.overview",
            icon: "fas fa-fw fa-history",
            classes: "indent",
            shortTemplate: "templates/sections/ncdIntroSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-notes.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-ncd-notes.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var diabetes = {
            type: "encounter-section",
            id: "pihcore-diabetes",
            label: "pihcore.ncd.diabetes",
            icon: "icon-circle-blank",
            classes: "indent",
            shortTemplate: "templates/sections/dmSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-diabetes.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-diabetes.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var hypertension = {
            type: "encounter-section",
            id: "pihcore-hypertension",
            label: "pihcore.ncd.htn",
            icon: "fas fa-fw fa-heartbeat",
            classes: "indent",
            shortTemplate: "templates/sections/htnSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-hypertension.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-hypertension.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var heartFailure = {
            type: "encounter-section",
            id: "pihcore-heart-failure",
            label: "pihcore.ncd.heart_failure",
            icon: "fas fa-fw fa-heart-broken",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-heart-failure.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-heart-failure.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var kidney = {
            type: "encounter-section",
            id: "pihcore-kidney",
            label: "pihcore.ncd.kidney.disease",
            icon: "fas fa-fw fa-palette",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-kidney.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-kidney.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var liver = {
            type: "encounter-section",
            id: "pihcore-liver",
            label: "pihcore.ncd.liver.disease",
            icon: "icon-leaf",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-liver.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-liver.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var lung = {
            type: "encounter-section",
            id: "pihcore-lung",
            label: "pihcore.ncd.lung.disease",
            icon: "fas fa-fw fa-wind",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-lung.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-lung.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var sickleCell = {
            type: "encounter-section",
            id: "pihcore-sickle-cell",
            label: "pihcore.ncd.sickleCell",
            icon: "fas fa-fw fa-eye",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-sickle-cell.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-sickle-cell.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var palliative = {
            type: "encounter-section",
            id: "pihcore-palliative",
            label: "pihcore.ncd.palliativeCare",
            icon: "fas fa-fw fa-hand-holding-heart",
            classes: "indent",
            shortTemplate: "templates/sections/palliativeSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-palliative.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-palliative.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var otherNCDs = {
            type: "encounter-section",
            id: "pihcore-other-ncds",
            label: "pihcore.ncd.other",
            icon: "fas fa-fw fa-plus-circle",
            classes: "indent",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-other-ncd.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-other-ncd.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var hivHistory = {
            type: "encounter-section",
            id: "hiv-history",
            label: "pihcore.history.label",
            icon: "fas fa-fw fa-history",
            shortTemplate: "templates/sections/hivHistorySectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-history.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-history.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var pmtctHistory = {
            type: "encounter-section",
            id: "pmtct-history",
            label: "pihcore.pmtctHistory.label",
            icon: "fas fa-fw fa-history",
            shortTemplate: "templates/sections/pmtctHistorySectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-pmtct-history.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-pmtct-history.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var labRadOrder = {
            type: "encounter-section",
            id: "lab-rad-order",
            label: "pihcore.order.title",
            icon: "fas fa-fw fa-vial",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-lab-order.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-lab-order.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };


        var hivAssessment = {
            type: "encounter-section",
            id: "hiv-assessment",
            label: "pihcore.assessment",
            icon: "fas fa-fw fa-th-large",
            shortTemplate: "templates/sections/hivSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-assessment.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-assessment.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var familyPlanningHistory = {
            type: "encounter-section",
            id: "family-planning-history",
            label: "pihcore.familyPlanning.title",
            icon: "fas fa-fw fa-users",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-family-planning.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-family-planning.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var hivPlan = {
            type: "encounter-section",
            id: "hiv-intake-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            shortTemplate: "templates/sections/hivPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var hivState = {
            type: "encounter-section",
            id: "hiv-state",
            label: "pihcore.hiv.clinicalState.short",
            icon: "fas fa-fw fa-bolt",
            shortTemplate: "templates/sections/hivStateSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-state.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-hiv-state.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };


        var eidProtection = {
            type: "encounter-section",
            id: "eid-protection",
            label: "pihcore.prevention.label",
            icon: "fas fa-fw fa-shield-alt",
            shortTemplate: "templates/sections/eidProtectionSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-eid-protection.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-eid-protection.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}",
            require: "fullMonthsBetweenDates(visit.patient.person.birthdate, visit.startDatetime) < 24"
        };

        var eidPlan = {
            type: "encounter-section",
            id: "eid-followup-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            shortTemplate: "templates/sections/eidPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-eid-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/section-eid-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var ancInitial = {
            type: "encounter-section",
            id: "section-anc-intake",
            label: "pihcore.ancIntake.title",
            icon: "fas fa-fw fa-gift",
            shortTemplate: "templates/sections/ancIntakeSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-anc-intake.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-anc-intake.xml")+ "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }

        var ancFollowup = {
            type: "encounter-section",
            id: "section-anc-followup",
            label: "pihcore.ancFollowup.title",
            icon: "fas fa-fw fa-gift",
            shortTemplate: "templates/sections/ancIntakeSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-anc-followup.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-anc-followup.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }
        var postnatalFollowup = {
            type: "encounter-section",
            id: "section-postnatal-followup",
            label: "pihcore.postnatalFollowup.title",
            icon: "fas fa-fw fa-gift",
            shortTemplate: "templates/sections/ancIntakeSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-postnatal-followup.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-postnatal-followup.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }

        var delivery = {
            type: "encounter-section",
            id: "pihcore-delivery",
            label: "pihcore.delivery.title",
            icon: "fas fa-fw fa-baby",
            shortTemplate: "templates/sections/deliverySectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-delivery.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-delivery.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }


        var cSection = {
            type: "encounter-section",
            id: "pihcore-c-section",
            label: "pihcore.c-section",
            icon: "icon-cut",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-c-section.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-c-section.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }

        var obgynInitial = {
            type: "encounter-section",
            id: "section-obgyn-initial",
            label: "pihcore.lab.overview",
            icon: "fas fa-fw fa-female",
            shortTemplate: "templates/sections/obgynInitialSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-obgyn-initial.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-obgyn-initial.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        }


        var obgynPlan = {
            type: "encounter-section",
            id: "section-obgyn-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            shortTemplate: "templates/sections/obgynPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-obgyn-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-obgyn-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var medOrder = {
            type: "encounter-section",
            id: "section-obgyn-plan",
            label: "pihcore.visitNote.medication",
            icon: "fas fa-fw fa-pills",
            shortTemplate: "templates/sections/obgynPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("med-order.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("med-order.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var mchReferral = {
          type: "encounter-section",
          id: "section-mch-referral",
          label: "pihcore.refer.title",
          icon: "icon-share",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-mch-referral.xml"),
          editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-mch-referral.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var maternalDangerSigns = {
          type: "encounter-section",
          id: "section-maternal-danger-signs",
          label: "pihcore.mch.dangerSigns",
          icon: "icon-warning-sign",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-maternal-danger-signs.xml"),
          editUrl:""
        };

        var maternalVitalSigns = {
          type: "encounter-section",
          id: "section-maternal-vital-signs",
          label: "pihcore.vitalSigns",
          icon: "fas fa-fw fa-heartbeat",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-maternal-vital-signs.xml"),
        };

        var educationSubjects = {
          type: "encounter-section",
          id: "section-education-subjects",
          label: "pihcore.socioEconomic.education",
          icon: "fas fa-fw fa-clipboard-check",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-education-subjects.xml"),
        };

        var postpartumCounsel = {
            type: "encounter-section",
            id: "section-postpartum-training",
            label: "pihcore.socioEconomic.education",
            icon: "fas fa-fw fa-clipboard-check",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-postpartum-counsel.xml"),
        };

        var maternalFamilyPlanning = {
            type: "encounter-section",
            id: "maternal-family-planning",
            label: "pihcore.familyPlanning.title",
            icon: "icon-umbrella",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-family-planning-simple.xml"),
        };

        var comments = {
          type: "encounter-section",
          id: "section-comments",
          label: "pihcore.remarks",
          icon: "icon-comment",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-comments.xml"),
        };

        var returnVisitDate = {
          type: "encounter-section",
          id: "section-return-visit-date",
          label: "pihcore.consult.returnVisitDate",
          icon: "icon-calendar",
          shortTemplate: "templates/sections/defaultSectionShort.page",
          longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-return-visit-date.xml"),
        };

        var oncologyHistory = {
            type: "encounter-section",
            id: "section-oncology-history",
            label: "pihcore.history.label",
            icon: "fas fa-fw fa-history",
            shortTemplate: "templates/sections/defaultSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-oncology-history.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-oncology-history.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        var oncologyPlan = {
            type: "encounter-section",
            id: "section-oncology-plan",
            label: "pihcore.visitNote.plan",
            icon: "fas fa-fw fa-flag-checkered",
            shortTemplate: "templates/sections/obgynPlanSectionShort.page",
            longTemplate: "templates/sections/viewSectionWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-oncology-plan.xml"),
            editUrl: "/htmlformentryui/htmlform/editHtmlFormWithStandardUi.page?patientId={{visit.patient.uuid}}&visitId={{visit.uuid}}&encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("section-oncology-plan.xml") + "&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        /**
         * Define Encounter Types
         * Should support all of the following formats:
         *
         * encounterTypes['some-uuid'] = {
         *    // single config
         * }
         *
         * encounterTypes['some-uuid'] = {
         *    DEFAULT: {
         *      // default config
         *    }
         *    SPECIFIC_COUNTRY: {
         *      // specific country config
         *    }
         * }
         *
         *
         * encounterTypes['some-uuid'] = {
         *    DEFAULT: {
         *      // default config
         *    }
         *    SPECIFIC_COUNTRY: {
         *      DEFAULT: {
         *        // specific country config
         *      }
         *      SPECIFIC_SITE: {
         *        // specific site config
         *      }
         *    }
         * }
         *
         * encounterTypes['some-uuid'] = {
         *   versions: {
         *     DEFAULT: {
         *       // default config
         *     },
         *     "2.0": {
         *       // config to use if encounter is linked to a form with version 2.0
         *     },
         *     "1.0": {
         *       // config to use if encounter is linked to a form with version 2.0
         *     }
         *   }
         * }
         *
         * (can "nest" versions within country/site)
         * encounterTypes['some-uuid'] = {
         *    DEFAULT: {
         *      versions: {
         *        DEFAULT: {
         *          // default config
         *        },
         *        "2.0": {
         *          // config to use if encounter is linked to a form with version 2.0
         *        },
         *        "1.0": {
         *          // config to use if encounter is linked to a form with version 2.0
         *        }
         *      }
         *    }
         *    SPECIFIC_COUNTRY: {
         *      // specific country config
         *    }
         * }
         *
         *
         **/

        var encounterTypes = {
            DEFAULT: {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                showOnVisitList: true
            }
        };

        // patientRegistration
        encounterTypes["873f968a-73a8-4f9c-ac78-9f4778b751b6"] = {  // should never appear on dashboard?
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            showOnVisitList: false
        };

        // prenatalHomeAssessment
        encounterTypes["91DDF969-A2D4-4603-B979-F2D6F777F4AF"] = {
          defaultState: "short",
          shortTemplate: "templates/encounters/defaultEncounterShort.page",
          longTemplate: "templates/encounters/defaultEncounterShort.page",
          showOnVisitList: true,
          sections: [
            mchReferral,
            maternalVitalSigns,
            maternalDangerSigns,
            educationSubjects,
            comments,
            returnVisitDate
          ],
        };

        // pediatricHomeAssessment
        encounterTypes["0CF4717A-479F-4349-AE6F-8602E2AA41D3"] = {
          defaultState: "short",
          shortTemplate: "templates/encounters/defaultEncounterShort.page",
          longTemplate: "templates/encounters/defaultEncounterShort.page",
          icon: "fas fa-fw fa-baby",
          showOnVisitList: true,
          sections: [
            mchReferral,
            maternalVitalSigns,
            maternalDangerSigns,
            postpartumCounsel,
            comments,
            returnVisitDate
          ],
        };

        // maternalPostPartumHomeAssessment
        encounterTypes["0E7160DF-2DD1-4728-B951-641BBE4136B8"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-female",
            showOnVisitList: true,
            sections: [
                mchReferral,
                maternalVitalSigns,
                maternalDangerSigns,
                postpartumCounsel,
                maternalFamilyPlanning,
                comments,
                returnVisitDate
            ],
        };

        // maternalFollowUpHomeAssessment
        encounterTypes["690670E2-A0CC-452B-854D-B95E2EAB75C9"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-female",
            showOnVisitList: true,
            sections: [
                mchReferral,
                maternalVitalSigns,
                postpartumCounsel,
                maternalFamilyPlanning,
                comments
            ],
        };

        // checkIn
        encounterTypes["55a0d3ea-a4d7-4e88-8f01-5aceb2d3c61b"] = {
            DEFAULT: {
                defaultState: "short",
                shortTemplate: "templates/encounters/checkInShort.page",
                longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                icon: "fas fa-fw icon-check-in",
                editUrl: hfeSimpleEditUrl,
                showOnVisitList: false
            },
            "haiti": {
                versions : {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/checkInShort.page",
                        longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                        templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                        icon: "fas fa-fw icon-check-in",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: false
                    },
                    "3.0": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/checkInShort.page",
                        longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                        templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                        icon: "fas fa-fw icon-check-in",
                        editUrl: hfeSimpleEditUrl,
                        showOnVisitList: false
                    },
                    "2.0": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/checkInShort.page",
                        longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                        templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                        icon: "fas fa-fw icon-check-in",
                        editUrl: hfeSimpleEditUrl,
                        showOnVisitList: false
                    },
                    "1.1": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/checkInShort.page",
                        longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
                        templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
                        icon: "fas fa-fw icon-check-in",
                        editUrl: hfeSimpleEditUrl,
                        showOnVisitList: false
                    }
                }

            }
        };

        // Maternal checkIn (used for SL MCOE triage, but could be used beyond SL and MCOE)
        encounterTypes["251c03fa-a9dc-4157-855f-b016f4fae9ab"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/checkInShort.page",
            longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
            templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
            icon: "fas fa-fw icon-check-in",
            editUrl: hfeSimpleEditUrl,
            showOnVisitList: false
        };

        // MCOE OB Triage
        encounterTypes["41911448-71a1-43d7-bba8-dc86339850da"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/mchTriageShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-ambulance",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // vitals
        encounterTypes["4fb47712-34a6-40d2-8ed3-e153abbd25b7"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/vitalsShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-heartbeat",
            editUrl: hfeSimpleEditUrl,
            showOnVisitList: true
        };

        // MCOE Family Planning Intake and Followup
        encounterTypes["52fe1a29-678d-49cb-9ccd-7296d634284d"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("familyPlanningIntake.xml"),
                icon: "icon-group",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("familyPlanningIntake.xml"),
                showOnVisitList: true
            }
        };
        encounterTypes["5a1d1710-98b0-4e5f-8f6b-c9cef0c8cf05"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("familyPlanningFollowup.xml"),
                icon: "icon-group",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("familyPlanningFollowup.xml"),
                showOnVisitList: true
            }
        };

        // Gynecology Intake (and Followup)
        encounterTypes["34700f4f-c3df-4cfc-863a-bd8b92a0a485"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("gynecologyIntake.xml"),
                icon: "fas fa-fw fa-venus",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("gynecologyIntake.xml"),
                showOnVisitList: true
            }
        };
        encounterTypes["9b973514-7799-41b6-85f1-1ebc752d01f0"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("gynecologyFollowup.xml"),
                icon: "fas fa-fw fa-venus",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("gynecologyFollowup.xml"),
                showOnVisitList: true
            }
        };

        // Cervical cancer screening
        encounterTypes["820a80b0-1d59-407e-acbb-56abb69abd35"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("cervicalCancerScreening.xml"),
                icon: "fas fa-fw fa-ribbon",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("cervicalCancerScreening.xml"),
                showOnVisitList: true
            }
        };

        // AYFS Intake
        encounterTypes["1f3375af-fd9e-42a9-954e-99533ee15de9"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("ayfsIntake.xml"),
                icon: "fas fa-fw fa-venus",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("ayfsIntake.xml"),
                showOnVisitList: true
            }
        };
        // AYFS Followup
        encounterTypes["73399721-644e-494b-86c9-5dd345072db3"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("ayfsFollowup.xml"),
                icon: "fas fa-fw fa-venus",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("ayfsFollowup.xml"),
                showOnVisitList: true
            }
        };

        // vitals with glucose
        encounterTypes["2fd151a2-fbef-43e3-b82d-c3f70f1d7333"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/vitalsShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-heartbeat",
            editUrl: hfeSimpleEditUrl,
            showOnVisitList: true
        };

        // inpatient vitals
        encounterTypes["6b1c3929-f23c-423f-8cad-64b17cf10b99"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/vitalsShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-heartbeat",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // consultation / outpatientConsult
        encounterTypes["92fd09b4-5335-4f7e-9f63-b2a663fd09a6"] = {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/clinicConsultLong.page",
                icon: "fas fa-fw fa-stethoscope",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true
            };

        // initial consultation
        encounterTypes["59e55ca8-f3de-4d1e-b54c-9b880405b853"] = {
            DEFAULT: {
            defaultState: "long",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("outpatientConsultInitial.xml"),
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("outpatientConsultInitial.xml"),
            showOnVisitList: true
        },
        "peru": {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-gift",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                primaryCareHistory,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        }
    };

      // nurse consultation
      encounterTypes["e920911f-dee9-4b18-9a58-50e685806ea0"] = {
        defaultState: "long",
        shortTemplate: "templates/encounters/defaultEncounterShort.page",
        longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
        templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("nurseConsult.xml"),
        icon: "fas fa-fw fa-stethoscope",
        editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("nurseConsult.xml"),
        showOnVisitList: true
      };
      // Prescription
      encounterTypes["03546c8c-0c2c-4a58-80a0-0e5d112464ac"] = {
        defaultState: "long",
        shortTemplate: "templates/encounters/defaultEncounterShort.page",
        longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
        templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("prescription.xml"),
        icon: "fas fa-fw fa-stethoscope",
        editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("prescription.xml"),
        showOnVisitList: true
      };

        // primaryCarePedsInitialConsult
        encounterTypes["5b812660-0262-11e6-a837-0800200c9a66"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",  // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                primaryCareHistory,
                pedsVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // primaryCarePedsFollowupConsult
        encounterTypes["229e5160-031b-11e6-a837-0800200c9a66"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                chiefComplaint,
                pedsVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // primaryCareAdultInitialConsult
        encounterTypes["27d3a180-031b-11e6-a837-0800200c9a66"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                primaryCareHistory,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // primaryCareAdultFollowupConsult
        encounterTypes["27d3a181-031b-11e6-a837-0800200c9a66"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                chiefComplaint,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // liberiaFamilyMedicineIntake
        encounterTypes["1d1faf4f-a848-44c8-ac44-ada8aa5ae40c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",  // no expanded view, instead there are individual sections
            icon: "icon-group",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                primaryCareHistory,
                generalVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // liberiaFamilyMedicineFollowup
        encounterTypes["84d5e978-66d1-4a2c-b209-95d47c911dd8"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "icon-group",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                chiefComplaint,
                generalVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan
            ]
        };

        // ncdInitialConsult
        encounterTypes["ae06d311-1866-455b-8a64-126a9bd74171"] = {
            DEFAULT: {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    primaryCareHistory,
                    primaryCareExam,
                    pedsVaccinations,
                    pedsFoodAndSupplements,
                    ncd,
                    sickleCell,
                    primaryCareDx,
                    primaryCarePlan
                ]
            },
            "haiti": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            primaryCareHistory,
                            primaryCareExam,
                            pedsVaccinations,
                            pedsFoodAndSupplements,
                            ncd,
                            sickleCell,
                            primaryCareDx,
                            primaryCarePlan
                        ]
                    },
                    "0.5": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            ncd
                        ]
                    }
                }
            },
            "liberia": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            ncdHistory,
                            ncdHospital,
                            diabetes,
                            hypertension,
                            heartFailure,
                            lung,
                            kidney,
                            liver,
                            palliative,
                            sickleCell,
                            primaryCareDx,
                            generalVaccinations,
                            ncdPlan
                        ]
                    },
                    "1.0": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                        templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("ncd-initial_v1.0.xml"),
                        icon: "fas fa-fw fa-user",
                        editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("ncd-initial_v1.0.xml"),
                        showOnVisitList: true
                    }
                }
            },
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    ncdHistory,
                    ncdHospital,
                    diabetes,
                    hypertension,
                    heartFailure,
                    lung,
                    kidney,
                    liver,
                    palliative,
                    sickleCell,
                    otherNCDs,
                    primaryCareDx,
                    generalVaccinations,
                    ncdPlan
                ]
            },
        };

        // ncdFollowupConsult
        encounterTypes["5cbfd6a2-92d9-4ad0-b526-9d29bfe1d10c"] = {
            DEFAULT: {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    primaryCareExam,
                    pedsVaccinations,
                    ncd,
                    sickleCell,
                    primaryCareDx,
                    primaryCarePlan
                ]
            },
            "haiti": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            primaryCareExam,
                            pedsVaccinations,
                            ncd,
                            sickleCell,
                            primaryCareDx,
                            primaryCarePlan
                        ]
                    },
                    "0.5": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            ncd
                        ]
                    }
                }
            },
            "liberia": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            ncdFollowupHeader,
                            ncdHospital,
                            diabetes,
                            hypertension,
                            heartFailure,
                            lung,
                            kidney,
                            liver,
                            palliative,
                            sickleCell,
                            primaryCareDx,
                            generalVaccinations,
                            ncdPlan
                        ]
                    },
                    "1.0": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                        templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("ncd-followup_v1.0.xml"),
                        icon: "fas fa-fw fa-user",
                        editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("ncd-followup_v1.0.xml"),
                        showOnVisitList: true
                    }
                }
            },
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    ncdFollowupHeader,
                    ncdHospital,
                    diabetes,
                    hypertension,
                    heartFailure,
                    lung,
                    kidney,
                    liver,
                    palliative,
                    sickleCell,
                    otherNCDs,
                    primaryCareDx,
                    generalVaccinations,
                    ncdPlan
                ]
            }
        };

        // For SL, NCD Initial Part 1
        encounterTypes["48c413c4-e7f6-491a-8431-900451fe8a32"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    ncdHistory,
                    ncdHospital
                ]
            }
        };

        // For SL, NCD Initial Part 2
        encounterTypes["43423212-6f70-4df8-a9f7-2aef88df1ee2"] = {
            "sierra_leone": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            ncdOverviewNote,
                            diabetes,
                            hypertension,
                            heartFailure,
                            lung,
                            kidney,
                            liver,
                            palliative,
                            sickleCell,
                            otherNCDs,
                            primaryCareDx,
                            generalVaccinations,
                            ncdPlan
                        ]
                    },
                    "1.0": {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-heart",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            diabetes,
                            hypertension,
                            heartFailure,
                            lung,
                            kidney,
                            liver,
                            palliative,
                            sickleCell,
                            primaryCareDx,
                            generalVaccinations,
                            ncdPlan
                        ]
                    }
                }
            }
        };

        // For SL, NCD Followup Part 1
        encounterTypes["e02a8c32-4f14-4ff7-a4e9-2f087d9a1cf7"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    ncdFollowupHeader,
                    ncdHospital
                ]
            }
        };

        // For SL, NCD Followup Part 2
        encounterTypes["6a3afa6f-8f78-44a9-80c9-3f4f3b6ad8f2"] = {
            "sierra_leone": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-heart",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    diabetes,
                    hypertension,
                    heartFailure,
                    lung,
                    kidney,
                    liver,
                    palliative,
                    sickleCell,
                    otherNCDs,
                    primaryCareDx,
                    generalVaccinations,
                    ncdPlan
                ]
            }
        };

        // echocardiogramConsult
        encounterTypes["fdee591e-78ba-11e9-8f9e-2a86e4085a59"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-chart-line",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // zlHivIntake
        // ToDo: Replace the icon and add more sections
        encounterTypes["c31d306a-40c4-11e7-a919-92ebcb67fe33"] = {
            DEFAULT: {
                versions: {
                  DEFAULT: {
                    defaultState: "short",
                    shortTemplate: "templates/encounters/defaultEncounterShort.page",
                    longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
                    icon: "fas fa-fw fa-ribbon",
                    editUrl: hfeStandardEditUrl,
                    showOnVisitList: true,
                    sections: [
                      hivHistory,
                      primaryCareExam,
                      pedsVaccinations,
                      hivAssessment,
                      hivPlan
                    ]
                  },
                  "2.0": {
                    defaultState: "short",
                    shortTemplate: "templates/encounters/defaultEncounterShort.page",
                    longTemplate: "templates/encounters/hivNotMigratedEncounterLong.page",
                    showOnVisitList: true,
                  },
                  "1.0": {
                    defaultState: "short",
                    shortTemplate: "templates/encounters/defaultEncounterShort.page",
                    longTemplate: "templates/encounters/hivNotMigratedEncounterLong.page",
                    showOnVisitList: true,
                  }
                }
            },
            "peru": {
                ...encounterTypes.DEFAULT,
                icon: "fas fa-fw fa-ribbon",
                editUrl: hfeStandardEditUrl
            }
        };

        // zlHivFollowup
        // ToDo: Replace the icon and add sections
        encounterTypes["c31d3312-40c4-11e7-a919-92ebcb67fe33"] = {
          versions: {
            DEFAULT: {
              defaultState: "short",
              shortTemplate: "templates/encounters/defaultEncounterShort.page",
              longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
              icon: "fas fa-fw fa-ribbon",
              editUrl: hfeStandardEditUrl,
              showOnVisitList: true,
              sections: [
                hivState,
                primaryCareExam,
                pedsVaccinations,
                primaryCareDx,
                hivPlan
              ]
            },
            "2.0": {
              defaultState: "short",
              shortTemplate: "templates/encounters/defaultEncounterShort.page",
              longTemplate: "templates/encounters/hivNotMigratedEncounterLong.page",
              showOnVisitList: true
            },
            "1.0": {
              defaultState: "short",
              shortTemplate: "templates/encounters/defaultEncounterShort.page",
              longTemplate: "templates/encounters/hivNotMigratedEncounterLong.page",
              showOnVisitList: true,
            }
          }
        };

        // pmtct intake
        encounterTypes["584124b9-1f10-4757-ba09-91fc9075af92"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                pmtctHistory,
                primaryCareExam,
                ancVaccinations,
                hivAssessment,
                hivPlan
            ]
        };

        // pmtct followup
        encounterTypes["95e03e7d-9aeb-4a99-bd7a-94e8591ec2c5"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                hivState,
                primaryCareExam,
                ancVaccinations,
                primaryCareDx,
                hivPlan
            ]
        };

        // exposed infant (EID) followup
        encounterTypes["0f070640-279e-4ec0-9e6c-6ef1f6567030"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",   // no expanded view, instead there are individual sections
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                eidProtection,
                pedsVaccinations,
                primaryCareExam,
                eidPlan
            ]
        };

        // oncologyConsult
        encounterTypes["035fb8da-226a-420b-8d8b-3904f3bedb25"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-paste",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // oncologyInitial
        encounterTypes["a936ae01-6d10-455d-befc-b2d1828dad04"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-hand-holding-heart",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                oncologyHistory,
                generalVaccinations,
                primaryCareExam,
                oncologyPlan
            ]
        };

        // oncologyTreatmentPlan
        encounterTypes["f9cfdf8b-d086-4658-9b9d-45a62896da03"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-paste",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // chemotherapySession
        encounterTypes["828964fa-17eb-446e-aba4-e940b0f4be5b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-retweet",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // medicationDispensed
        encounterTypes["8ff50dea-18a1-4609-b4c9-3f8f2d611b84"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-pills",
            editUrl: hfeStandardEditUrl
        };

        // postOperativeNote
        encounterTypes["c4941dee-7a9b-4c1c-aa6f-8193e9e5e4e5"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            primaryEncounterRoleUuid: "9b135b19-7ebe-4a51-aea2-69a53f9383af",  // attendingSurgeon
            icon: "fas fa-fw fa-paste",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // transfer
        encounterTypes["436cfe33-6b81-40ef-a455-f134a9f7e580"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultHtmlFormEncounterLong.page",
            templateModelUrl: "/module/htmlformentry/encounter.json?encounter={{encounter.uuid}}",
            icon: "fas fa-fw fa-share",
            editUrl: hfeStandardEditUrl
        };

        // admission
        encounterTypes["260566e1-c909-4d61-a96f-c1019291a09d"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/admissionLong.page",
            icon: "fas fa-fw fa-sign-in-alt",
            editUrl: hfeStandardEditUrl
        };

        // cancelAdmission
        encounterTypes["edbb857b-e736-4296-9438-462b31f97ef9"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-ban",
            editUrl: hfeStandardEditUrl
        };

        // exitFromCare
        encounterTypes["b6631959-2105-49dd-b154-e1249e0fbcd7"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-sign-out-alt",
            editUrl: hfeStandardEditUrl
        };

        // labResults
        encounterTypes["4d77916a-0620-11e5-a6c0-1697f925ec7b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-vial",
            editUrl: hfeSimpleEditUrl,
            showOnVisitList: true
        };

        // radiologyOrder
        encounterTypes["1b3d1e13-f0b1-4b83-86ea-b1b1e2fb4efa"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-x-ray"
        };

        // radiologyStudy
        encounterTypes["5b1b4a4e-0084-4137-87db-dba76c784439"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-x-ray"
        };

        // radiologyReport
        encounterTypes["d5ca53a7-d3b5-44ac-9aa2-1491d2a4b4e9"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-x-ray"
        };

        // deathCertificate
        encounterTypes["1545d7ff-60f1-485e-9c95-5740b8e6634b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-times-circle",
            editUrl: hfeStandardEditUrl
        };

        // mentalHealth (mentalHealthFollowup for Liberia)
        // because of a bug, we manually append the defintionUiResource to the template and edit urls
        // see: https://tickets.pih-emr.org/browse/UHM-2524
        encounterTypes["a8584ab8-cc2a-11e5-9956-625662870761"] = {
          DEFAULT: {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("mentalHealth.xml"),
            icon: "fas fa-fw fa-user",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("mentalHealth.xml"),
            showOnVisitList: true
          },
          "liberia": {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("mentalHealthFollowup.xml"),
            icon: "fas fa-fw fa-user",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("mentalHealthFollowup.xml"),
            showOnVisitList: true
          }
        };

        // Additional mental health form for followup (Sierra Leone)
        encounterTypes["9d701a81-bb83-40ea-9efc-af50f05575f2"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("mentalHealthFollowup.xml"),
            icon: "fas fa-fw fa-user",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("mentalHealthFollowup.xml"),
            showOnVisitList: true
        };

        // Additional mental health form for INTAKE (Liberia)
        encounterTypes["fccd53c2-f802-439b-a7a2-2d680bd8b81b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("mentalHealthIntake.xml"),
            icon: "fas fa-fw fa-user",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("mentalHealthIntake.xml"),
            showOnVisitList: true
        };

        // Epilepsy intake form (Liberia)
        encounterTypes["7336a05e-4bd1-4e52-81c1-207697afc868"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("epilepsyIntake.xml"),
            icon: "fas fa-fw fa-brain",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("epilepsyIntake.xml"),
            showOnVisitList: true
        };

        // Epilepsy follow-up form (Liberia)
        encounterTypes["74e06462-243e-4fad-8d7c-0bb3921322f1"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("epilepsy.xml"),
            icon: "fas fa-fw fa-brain",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("epilepsy.xml"),
            showOnVisitList: true
        };

        // artAdherence
        // HIV forms from MSPP and iSantePlus
        encounterTypes["c45d7299-ad08-4cb5-8e5d-e0ce40532939"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/iSantePlus/Adherence.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/iSantePlus/Adherence.xml"),
            showOnVisitList: true
        };

        // hivIntakeAdult
        encounterTypes["17536ba6-dd7c-4f58-8014-08c7cb798ac7"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/iSantePlus/SaisiePremiereVisiteAdult.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/iSantePlus/SaisiePremiereVisiteAdult.xml"),
            showOnVisitList: true
        };

        // hivIntakePeds
        encounterTypes["349ae0b4-65c1-4122-aa06-480f186c8350"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/iSantePlus/SaisiePremiereVisitePediatrique.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/iSantePlus/SaisiePremiereVisitePediatrique.xml"),
            showOnVisitList: true
        };

        // hivFollowupAdult
        encounterTypes["204ad066-c5c2-4229-9a62-644bc5617ca2"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/iSantePlus/VisiteDeSuivi.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/iSantePlus/VisiteDeSuivi.xml"),
            showOnVisitList: true
        };

        // hivFollowupPeds
        encounterTypes["33491314-c352-42d0-bd5d-a9d0bffc9bf1"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/iSantePlus/VisiteDeSuiviPediatrique.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/iSantePlus/VisiteDeSuiviPediatrique.xml"),
            showOnVisitList: true
        };

        // VCT
        encounterTypes["616b66fe-f189-11e7-8c3f-9a214cf093ae"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/vct.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/vct.xml"),
            showOnVisitList: true
        };

        // Pre-Exposure Prophylaxis (PrEP) Intake
        encounterTypes["2fb72359-f6fe-4b37-bb11-9b4cb5fd6ca7"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/prep-intake.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/prep-intake.xml"),
            showOnVisitList: true
        };

        // Pre-Exposure Prophylaxis (PrEP) Followup
        encounterTypes["4fe5fc03-b42b-4bb2-8ed8-e3c7de8942fb"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/prep-followup.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/prep-followup.xml"),
            showOnVisitList: true
        };

        // HIV dispensing
        encounterTypes["cc1720c9-3e4c-4fa8-a7ec-40eeaad1958c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/hiv-dispensing.xml"),
            icon: "fas fa-fw fa-ribbon",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/hiv-dispensing.xml"),
            showOnVisitList: true
        };

        // HIV psychosocial
        encounterTypes["83081f7d-ffd7-4d43-9571-a86e1bc19d7f"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("hiv/hiv-psychosocial.xml"),
            icon: "fas fa-fw fa-money-bill-alt",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("hiv/hiv-psychosocial.xml"),
            showOnVisitList: true
        };

        // Socio-economics (socioEcon)
        encounterTypes["de844e58-11e1-11e8-b642-0ed5f89f718b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("socio-econ.xml"),
            icon: "fas fa-fw fa-home",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("socio-econ.xml"),
            showOnVisitList: true
        };

        /*
         * COVID-19 forms
         */

        // covid19Admission
        encounterTypes["8d50b938-dcf9-4b8e-9938-e625bd2f0a81"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("covid19Intake.xml"),
            icon: "fab fa-fw fa-first-order-alt",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("covid19Intake.xml"),
            showOnVisitList: true
        };

        // covid19Progress
        encounterTypes["ca65f5d3-6312-4143-ae4e-0237427f339e"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("covid19Followup.xml"),
            icon: "fab fa-fw fa-first-order-alt",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("covid19Followup.xml"),
            showOnVisitList: true
        };

        // covid19Discharge
        encounterTypes["5e82bea0-fd7b-47f9-858a-91be87521073"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("covid19Discharge.xml"),
            icon: "fab fa-fw fa-first-order-alt",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("covid19Discharge.xml"),
            showOnVisitList: true
        };

        /*
         * Back to non-COVID encounters now
         */

        // primaryCareVisit
        encounterTypes["1373cf95-06e8-468b-a3da-360ac1cf026d"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-heart",
            editUrl: hfeStandardEditUrl
        };

        // edTriage
        encounterTypes["74cef0a6-2801-11e6-b67b-9e71128cae77"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/edTriageShort.page",
            icon: "fas fa-fw fa-ambulance",
            editUrl: "edtriageapp/edtriageEditPatient.page?editable=true&patientId={{patient.uuid}}&encounterId={{encounter.uuid}}&appId=edtriageapp.app.triageQueue&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}",
            viewUrl: "edtriageapp/edtriageEditPatient.page?editable=false&patientId={{patient.uuid}}&encounterId={{encounter.uuid}}&appId=edtriageapp.app.triageQueue&returnUrl={{returnUrl}}&breadcrumbOverride={{breadcrumbOverride}}"
        };

        // testOrder
        encounterTypes["b3a0e3ad-b80c-4f3f-9626-ace1ced7e2dd"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/testOrderLong.page",
            icon: "fas fa-fw fa-vial"
        };

        // pathologySpecimenCollection
        encounterTypes["10db3139-07c0-4766-b4e5-a41b01363145"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/pathologySpecimenCollectionShort.page",
            longTemplate: "templates/encounters/pathologySpecimenCollectionLong.page",
            editUrl: "labtrackingapp/labtrackingAddOrder.page?patientId={{patient.uuid}}&visitId={{visit.uuid}}&encounter={{encounter.uuid}}&returnUrl={{returnUrl}}",
            icon: "fas fa-fw fa-microscope"
        };

        // labSpecimenCollection
        encounterTypes["39C09928-0CAB-4DBA-8E48-39C631FA4286"] = {
          defaultState: "short",
          shortTemplate: "templates/encounters/defaultEncounterShort.page",
          longTemplate: "templates/encounters/labsSpecimenEncounterLong.page",
          icon: "fas fa-fw fa-vial"
        };

        /*
         * MCH/Prenatal
         */

        // ancIntake
        encounterTypes["00e5e810-90ec-11e8-9eb6-529269fb1459"] = {
          DEFAULT: {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-gift",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
              ancInitial,
              ancVaccinations,
              primaryCareDx
            ]
          },
          "sierra_leone": {
              versions: {
                  DEFAULT: {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancInitial,
                          ancVaccinations
                      ]
                  },
                  "2.0": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancInitial,
                          generalVaccinations,
                          primaryCarePlanMedication,
                      ]
                  },
                  "1.1": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancInitial,
                          generalVaccinations,
                          primaryCarePlanMedication,
                      ]
                  },
                  "1.0": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancInitial,
                          generalVaccinations,
                          primaryCarePlanMedication,
                      ]
                  },
              }
          },
          "liberia": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("anc-initial.xml"),
                icon: "fas fa-fw fa-user",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("anc-initial.xml"),
                showOnVisitList: true,
                sections: [
                    ancVaccinations,
                    medOrder
                ]
            }
        };

        // vaccination
        encounterTypes["1e2a509c-7c9f-11e9-8f9e-2a86e4085a59"] = {
            defaultState: "long",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/vaccination/chVaccinations.page",
            icon: "fas fa-fw fa-umbrella",
            showOnVisitList: true
        };
        // postnatalFollowup
        encounterTypes["b7a7c300-f7e5-4d38-a388-fc178ab02e78"] = {
            DEFAULT: {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/defaultEncounterShort.page",
                icon: "fas fa-fw fa-gift",
                editUrl: hfeStandardEditUrl,
                showOnVisitList: true,
                sections: [
                    postnatalFollowup,
                    ancVaccinations
                ]
            },
            "sierra_leone": {
                versions: {
                    DEFAULT: {
                        defaultState: "short",
                        shortTemplate: "templates/encounters/defaultEncounterShort.page",
                        longTemplate: "templates/encounters/defaultEncounterShort.page",
                        icon: "fas fa-fw fa-gift",
                        editUrl: hfeStandardEditUrl,
                        showOnVisitList: true,
                        sections: [
                            postnatalFollowup,
                            ancVaccinations
                        ]
                    }
                }
            }
        };
        // ancFollowup
        encounterTypes["00e5e946-90ec-11e8-9eb6-529269fb1459"] = {
          DEFAULT: {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-gift",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
              ancFollowup,
              ancVaccinations,
              primaryCareDx
            ]
          },
          "sierra_leone": {
              versions: {
                  DEFAULT: {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancFollowup,
                          generalVaccinations
                      ]
                  },
                  "2.0": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancFollowup,
                          generalVaccinations,
                          primaryCarePlanMedication
                      ]
                  },
                  "1.1": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancFollowup,
                          generalVaccinations,
                          primaryCarePlanMedication
                      ]
                  },
                  "1.0": {
                      defaultState: "short",
                      shortTemplate: "templates/encounters/defaultEncounterShort.page",
                      longTemplate: "templates/encounters/defaultEncounterShort.page",
                      icon: "fas fa-fw fa-gift",
                      editUrl: hfeStandardEditUrl,
                      showOnVisitList: true,
                      sections: [
                          ancFollowup,
                          generalVaccinations,
                          primaryCarePlanMedication
                      ]
                  },
              }
          },
          "liberia": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("anc-followup.xml"),
                icon: "fas fa-fw fa-user",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("anc-followup.xml"),
                showOnVisitList: true,
                sections: [
                    ancVaccinations,
                    medOrder
                ]
            }
        };

        // delivery
        encounterTypes["00e5ebb2-90ec-11e8-9eb6-529269fb1459"] = {
          DEFAULT: {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
              delivery,
              cSection,
              primaryCareDx
            ]
          },
          "sierra_leone": {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-gift",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
              delivery,
              primaryCareDx,
              primaryCarePlanMedication,
            ]
          },
          "liberia": {
                defaultState: "short",
                shortTemplate: "templates/encounters/defaultEncounterShort.page",
                longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
                templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("anc-delivery.xml"),
                icon: "fas fa-fw fa-user",
                editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("anc-delivery.xml"),
                showOnVisitList: true,
                sections: [
                    medOrder
                ]
            }
        };

        // obgyn
        encounterTypes["d83e98fd-dc7b-420f-aa3f-36f648b4483d"] = {
            versions: {
                DEFAULT: {
                    defaultState: "short",
                    shortTemplate: "templates/encounters/defaultEncounterShort.page",
                    longTemplate: "templates/encounters/defaultEncounterShort.page",
                    icon: "fas fa-fw fa-female",
                    editUrl: hfeStandardEditUrl,
                    showOnVisitList: true,
                    sections: [
                        obgynInitial,
                        ancVaccinations,
                        primaryCareExam,
                        obgynDx,
                        obgynPlan
                    ]
                },
                1.0: {
                    defaultState: "short",
                    shortTemplate: "templates/encounters/defaultEncounterShort.page",
                    longTemplate: "templates/encounters/defaultEncounterShort.page",
                    icon: "fas fa-fw fa-female",
                    editUrl: hfeStandardEditUrl,
                    showOnVisitList: true,
                    sections: [
                        obgynInitial,
                        ancVaccinations,
                        primaryCareExam,
                        obgynDx,
                        obgynPlan
                    ]
                }
            }
        };

        // OVC Intake
        encounterTypes["651d4359-4463-4e52-8fde-e62876f90792"] = {
            ...encounterTypes.DEFAULT,
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            editUrl: hfeStandardEditUrl,
        };

        // OVC Followup
        encounterTypes["f8d426fd-132a-4032-93da-1213c30e2b74"] = {
            ...encounterTypes.DEFAULT,
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            editUrl: hfeStandardEditUrl,
        };

        // HIV Infant documentation
        encounterTypes["00DA14B9-7066-45A7-8FEC-0CAD60D1EBD1"] = {
          ...encounterTypes.DEFAULT,
          longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
          templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
          editUrl: hfeStandardEditUrl,
        };

        // Tuberculosis Intake
        encounterTypes["aa42cc6c-b9ee-4850-926c-dda4bb14d890"] = {
            ...encounterTypes.DEFAULT,
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            editUrl: hfeStandardEditUrl,
        };

        // Comment
        encounterTypes["c30d6e06-0f00-460a-8f81-3c39a1853b56"] = {
            ...encounterTypes.DEFAULT,
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-pencil-alt",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        }

        // Drug Rehab
        encounterTypes["dd1ebccb-700d-4e8b-bb61-f54e9763117c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-pills",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // Physical Rehab
        encounterTypes["e91a4139-e0e7-447f-a5dd-c4f3b92d27c9"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-user-injured",
            editUrl: hfeSimpleEditUrl,
            showOnVisitList: true
        };

        // Inpatient Notes
        encounterTypes["d3b07384-d9a7-4f3b-8a1d-6e5b2b5a5b5b"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-pencil-alt",
            showOnVisitList: true
        };

        // Transfer Request
        encounterTypes["e4b0a1c2-3d4f-4e5b-9a1d-7e6b3b6a6c6c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-retweet",
            showOnVisitList: true
        };

        /*
         * Site-specific encounters
         */

        // mexicoConsult
        // TODO change Mexico and Sierra Leone consults to use standard outpatient encounter types now that we support multiple configs per encounter type?
        encounterTypes["aa61d509-6e76-4036-a65d-7813c0c3b752"] = {
            defaultState: "long",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("consult.xml"),
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("consult.xml"),
            showOnVisitList: true
        };

        // clinical history
        encounterTypes["0d16a7c9-07fb-43f6-8984-dd7787f26a5a"] = {
            defaultState: "long",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("clinicalHistory.xml"),
            icon: "fas fa-fw fa-clipboard-list",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("clinicalHistory.xml"),
            showOnVisitList: true
        };

        // ultrasonido
        encounterTypes["40d024d9-c7ec-4d2a-a862-68cb87543c4b"] = {
            defaultState: "long",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("ultrasound.xml"),
            icon: "fas fa-fw fa-clipboard-list",
            editUrl: hfeStandardEditUrl + "&definitionUiResource=" + getFormResource("ultrasound.xml"),
            showOnVisitList: true
        };
        
        // sierraLeoneOutpatientInitial
        encounterTypes["7d5853d4-67b7-4742-8492-fcf860690ed5"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                primaryCareHistory,
                pedsVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan,
            ]
        };

        // sierraLeoneOutpatientFollowup
        encounterTypes["d8a038b5-90d2-43dc-b94b-8338b76674f3"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterShort.page",
            icon: "fas fa-fw fa-stethoscope",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true,
            sections: [
                chiefComplaint,
                pedsVaccinations,
                pedsFoodAndSupplements,
                primaryCareExam,
                primaryCareDx,
                primaryCarePlan,
            ]
        };

        // sierraLeoneMchDeliveryRegister (GAIN project)
        encounterTypes["9cc89b83-e32f-410a-947d-aeb3bda37571"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneMchNewbornRegister (GAIN project)
        encounterTypes["3790ecc6-bc63-48f8-9104-f81dc90ee21c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneNewbornAdmission
        encounterTypes["093b6ffc-e55a-461a-85cc-c6acf7714a23"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneNewbornAssessment
        encounterTypes["6444b8d4-407d-444d-aa15-d6dff204ed83"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneNewbornDischarge
        encounterTypes["153d3182-c76f-4047-b7f2-d83cf967b206"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneNewbornExam
        encounterTypes["7e42e652-89e7-4559-80fd-41f42826c98c"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // Sierra Leone ANC progress (inpatient)
        encounterTypes["ce67f875-726f-4314-abd5-6bcaec10d273"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneLaborProgress
        encounterTypes["ac5ec970-31b7-4659-9141-284bfbc13c69"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneLaborDeliverySummary
        encounterTypes["fec2cc56-e35f-42e1-8ae3-017142c1ca59"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-baby",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeonePostpartumProgress
        encounterTypes["37f04ddf-9653-4a02-98b4-1c23734c2f15"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-female",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeonePacuFollowup
        encounterTypes["6f2df970-6e3e-4898-9a34-9d9e8955c3eb"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-clipboard-check",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneMaternalDeath
        encounterTypes["415b342e-9e4d-4496-bac4-7b6ffb8619f0"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-times-circle",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneMaternalDischarge
        encounterTypes["2110a810-db62-4914-ba95-604b96010164"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-arrow-circle-right",
            editUrl: hfeStandardEditUrl,
            printForm: true,
            printFormUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}&definitionUiResource=" + getFormResource("maternalDischarge-print.xml"),
            showOnVisitList: true
        };

        // sierraLeoneMaternalAdmission
        //     uses Admission encounter_type

        // sierraLeoneNicuTriage
        encounterTypes["fb4318dd-cca9-4d20-bb31-0d4eba947d74"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-ambulance",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // sierraLeoneBallardScore
        encounterTypes["8e027b32-13de-491b-9f29-534d21a48f0d"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-list-ol",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // bed assignment
        encounterTypes["caa222d6-d7d0-408f-a104-320e7556e9ff"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-bed",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        // drug order documentation
        encounterTypes["0b242b71-5b60-11eb-8f5a-0242ac110002"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/defaultEncounterLong.page",
            icon: "fas fa-fw fa-pills",
        };

        // Drug order
        encounterTypes["e0b41238-905a-497b-a2b6-885994701b99"] = {
            defaultState: "short",
            shortTemplate: "templates/encounters/defaultEncounterShort.page",
            longTemplate: "templates/encounters/viewEncounterWithHtmlFormLong.page",
            templateModelUrl: "/htmlformentryui/htmlform/viewEncounterWithHtmlForm/getAsHtml.action?encounterId={{encounter.uuid}}",
            icon: "fas fa-fw fa-pills",
            editUrl: hfeStandardEditUrl,
            showOnVisitList: true
        };

        return {
          get: function(encounter, country, site) {

            if (encounter == null || encounter.encounterType == null) {
              return encounterTypes.DEFAULT;
            }

            let encounterType = encounterTypes[encounter.encounterType.uuid];

            if (encounterType == null) {
              return encounterTypes.DEFAULT;
            }

            // resolve any country/site specific configs
            if (encounterType.hasOwnProperty(country)) {
              encounterType = encounterType[country][site] ||
                encounterType[country]['DEFAULT'] ||
                encounterType[country]
            }
            else {
              encounterType = encounterType['DEFAULT'] || encounterType;
            }

            // resolve any version-specific configs
            if (encounterType.versions) {
                encounterType = encounter.form && encounter.form.version ?
                    encounterType['versions'][encounter.form.version] || encounterType['versions']['DEFAULT'] :
                    encounterType['versions']['DEFAULT'];
            }

            return encounterType;
          }
        };
    });
