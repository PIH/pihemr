
// This calculates the shows the estimated delivery date (edd) and gestational age (GA)
jq(document).ready(function() {

    const yesValue = '<lookup expression="fn.getConcept('CIEL:1065').id"/>';
    const noValue = '<lookup expression="fn.getConcept('CIEL:1066').id"/>';
    const encounterDate = '<lookup complexExpression="#if($encounter.encounterDatetime)$!{fn.formatDate($encounter.encounterDatetime, 'yyyy-MM-dd')}#end"/>';

    const gender = '<lookup expression="patient.gender"/>';
    var currentEncounterDate = new Date();

    if (typeof encounterDate !== "undefined" &amp;&amp; encounterDate !== null &amp;&amp; (encounterDate.length > 0)) {
        // encounter date should be in the format YYYY-MM-DD
        const encounterDateTime = dateFromString(encounterDate);
        currentEncounterDate = new Date(encounterDateTime.getFullYear(), encounterDateTime.getMonth(), encounterDateTime.getDate());
    } else {
        // look for the encounterDate datepicker widget
        var encounterDateValue = jq("#encounterDate .hasDatepicker");
        if (encounterDateValue) {
            var getDate = encounterDateValue.datepicker('getDate');
            if (getDate) {
                currentEncounterDate = new Date(getDate);
            }
        }
    }

    const locale = (window.sessionContext &amp;&amp; window.sessionContext.locale) || navigator.language;
    jq("#visitDateDisplay").text((Intl.DateTimeFormat(locale, { dateStyle: "medium" })).format(currentEncounterDate));

    function dateFromString(dateString) {
        //the dateString is a string with the following format YYYY-MM-DD
        if (dateString) {
            const returnDate = new Date();
            let yearMonthDay = dateString.split('-');
            if (yearMonthDay.length == 3) {
                returnDate.setFullYear(yearMonthDay[0]);
                returnDate.setMonth(+yearMonthDay[1] - 1); // the month starts from 0 for January
                returnDate.setDate(yearMonthDay[2]);
                returnDate.setHours(0, 0, 0);
            }
            return returnDate;
        }
        return null;
    }

    /**
     * return a string representation of the gestational age as of the passed currentEncounterDate
     */
    function calculateGestationalDays(lastPeriodDate, currentEncounterDate, msgWeeks) {
        const today = currentEncounterDate ? new Date(+currentEncounterDate) : new Date();
        const gestAgeMs = today.getTime() - lastPeriodDate.getTime();
        const gestAgeDays = Math.floor(gestAgeMs / (1000 * 3600 * 24))
        const gestAgeWeeks = Math.floor(gestAgeDays / 7);
        const gestAgeRemainderDays = gestAgeDays % 7;
        return gestAgeWeeks +
            " " +
            (gestAgeRemainderDays ? gestAgeRemainderDays + "/7 " : " ") +
            msgWeeks;
    }



    function setUpEdd(currentEncounterDate, msgWeeks) {
        var encObsEdd = getField("edd.value") != null ? getField("edd.value").val() : null; // the encounter already has an EDD obs value

        var encObsGestagionalAge = getField("gestationalAge.value") != null ? getField("gestationalAge.value").val() : null; // the encounter already has a Gestational Age obs value

        // The LMP recorded on the encounter at load time. Used to tell apart a genuine user edit of
        // the LMP from a programmatic re-trigger (e.g. the "Is patient pregnant?" radio triggers a
        // change on the LMP field on initial load), so the latter never erases a recorded EDD/GA.
        var initialLmp = htmlForm.getValueIfLegal("lastPeriodDate.value") || '';

        function updateEdd(isInitialLoad) {
            const lastPeriodDateValue = htmlForm.getValueIfLegal("lastPeriodDate.value");
            // On initial load - or whenever the LMP still matches what was recorded on the encounter -
            // we must not overwrite/erase values already recorded on the encounter (EDIT mode). This
            // covers programmatic change triggers that fire during form setup with an unchanged LMP.
            // Once the user actually changes the LMP, always recalculate.
            const lmpUnchanged = (lastPeriodDateValue || '') === initialLmp;
            const preserveExistingEdd = (isInitialLoad || lmpUnchanged) &amp;&amp; (!!encObsEdd );
            const preserveExistingGestAge = (isInitialLoad || lmpUnchanged) &amp;&amp; (!!encObsGestagionalAge );
            //the lastPerioDate is a string with the following format YYYY-MM-DD
            // SL-1279: Last menstruation date should not be more than 10 months in the past of the encounter date
            const today = currentEncounterDate ? new Date(+currentEncounterDate) : new Date();
            if (lastPeriodDateValue &amp;&amp; (daysBetweenUTCDates(new Date(lastPeriodDateValue), today) &lt; 305)) {
                const lastPeriodDate = dateFromString(lastPeriodDateValue);
                let yearMonthDay = lastPeriodDateValue.split('-');
                if (yearMonthDay.length == 3) {
                    lastPeriodDate.setFullYear(yearMonthDay[0]);
                    lastPeriodDate.setMonth(+yearMonthDay[1] - 1); // the month starts from 0 for January
                    lastPeriodDate.setDate(yearMonthDay[2]);
                    lastPeriodDate.setHours(0, 0, 0);
                }

                const gestAgeText = calculateGestationalDays(lastPeriodDate, currentEncounterDate, msgWeeks);
                const edd = calculateExpectedDeliveryDate(lastPeriodDate);
                const locale = (window.sessionContext &amp;&amp; window.sessionContext.locale) || navigator.language;
                jq(".calculated-edd-and-gestational").show();
                if (!preserveExistingEdd &amp;&amp; getField("edd.value")) {
                    getField("edd.value").datepicker("setDate", edd);
                    jq("#edd input[type='hidden']").trigger('change');
                }
                jq(".calculated-edd").text((Intl.DateTimeFormat(locale, { dateStyle: "medium" })).format(edd));
                if (!preserveExistingGestAge &amp;&amp; getField("gestationalAge.value")) {
                    getField("gestationalAge.value").val(gestAgeText);
                }
                jq(".calculated-gestational-age-value").text(gestAgeText);
            } else {
                // Don't erase an EDD that was already recorded on the encounter on initial load
                // (e.g. when editing an existing form with no/old LMP); only clear a value we
                // auto-calculated, or one the user invalidated by changing the LMP.
                if (!preserveExistingEdd &amp;&amp; getField("edd.value")) {
                    getField("edd.value").datepicker("setDate", '');
                }
                jq(".calculated-edd").text('');
                jq(".calculated-gestational-age-value").text('');
                jq(".calculated-edd-and-gestational").hide();
            }
        };

        jq("#lastPeriodDate input[type='hidden']").change(function () {
            updateEdd(false);
        });

        updateEdd(true);
    }

    function displayVisibleObs() {
        var $answers = jq('#knowing_period_question').children('span');
        var selectedIndex = $answers.index($answers.filter('.value'));

        // matches order of answerConceptIds="CIEL:1065,CIEL:1066" / answerCodes="pihcore.yes,pihcore.no"
        var answerConceptIds = ['yes', 'no'];
        var selectedConceptId = selectedIndex >= 0 ? answerConceptIds[selectedIndex] : null;

        if (selectedConceptId === 'yes') {
            // The LMP is known. Display the LMP, EDD and Gestational Age.
            jq("#lastPeriodDateGroup").removeClass("hidden");
            jq("#eddGroup").removeClass("hidden");
        } else if (selectedConceptId === 'no') {
            // The LMP is not known. Dsiplay gestational age and Estimated Due Date.
            jq("#estimatedGaGroup").removeClass("hidden");
            jq("#eddGroup").removeClass("hidden");
        }
    }
    function updateVisibleGroups() {
        var radio = jq("#knowing_period_question input[type='radio']:checked")[0];
        if (radio &amp;&amp; radio.checked) {
            if (radio.value === yesValue) {
                jq("#lastPeriodDateGroup").removeClass("hidden");
                jq("#calculatedEddGroup").removeClass("hidden");
                jq("#eddGroup").removeClass("hidden");
                jq("#gaGroup").removeClass("hidden");

            } else if (radio.value === noValue) {
                // The LMP is not known. Provider estimates gestational age and Estimated Due Date during clinical visit.
                jq("#estimatedGaGroup").removeClass("hidden");
                jq("#eddGroup").removeClass("hidden");

            }
        }
    }

    jq("#knowing_period_question input[type='radio']").change(function() {
        jq("#lastPeriodDateGroup").addClass("hidden");
        jq("#calculatedEddGroup").addClass("hidden");
        jq("#eddGroup").addClass("hidden");
        jq("#gaGroup").addClass("hidden");
        jq("#estimatedGaGroup").addClass("hidden");

        if (this.checked) {
            getField("edd.value").datepicker("setDate", null);
            if (this.value === yesValue) {
                getField("estimatedGestationalAge.value").val('');
            } else if (this.value === noValue) {
                getField("lastPeriodDate.value").datepicker("setDate", null);
                jq(".calculated-edd").text('');
                jq(".calculated-gestational-age-value").text('');
            }
        }
        updateVisibleGroups();
    });

    jq("#gestationalAge input[type='text']").change(function() {
        const numValue = Number(this.value);
        const newEdd = calculateEddFromGA(numValue, currentEncounterDate);
        if (newEdd) {
            getField("edd.value").datepicker("setDate", newEdd);
        }
    });

    <ifMode mode="VIEW" include="false">
        if (gender === 'F') {
            setUpEdd(currentEncounterDate, '<uimessage code="pihcore.weeks"/>');
            updateVisibleGroups();
        }
    </ifMode>

    <ifMode mode="VIEW" include="true">
        displayVisibleObs();
    </ifMode>

});
