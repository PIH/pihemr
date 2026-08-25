
// This calculates the shows the estimated delivery date (edd) and gestational age (GA)
jq(document).ready(function() {

    const encounterDate = '<lookup expression="encounter.getEncounterDatetime().getTime()"/>';
    var currentEncounterDate = new Date();

    if (typeof encounterDate !== "undefined" &amp;&amp; encounterDate !== null &amp;&amp; (encounterDate.length > 0)) {
        currentEncounterDate = new Date(+encounterDate);
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
    <ifMode mode="VIEW" include="false">
        <lookup complexExpression="#set( $lmpObs = $fn.latestObsBeforeCurrentEncounter('CIEL:1427', false) )"/>
        const lastLMP = '<lookup complexExpression="#if($lmpObs)$!{fn.formatDate($lmpObs.getValueDatetime(), 'yyyy-MM-dd')}#end"/>';

        if ( lastLMP ) {

            const lastLMPrecordedDate = '<lookup complexExpression="#if($lmpObs)$!{fn.formatDate($lmpObs.obsDatetime, 'yyyy-MM-dd')}#end"/>';
            // Resolve the encounter name from the message properties (ui.i18n.EncounterType.name.&lt;form uuid&gt;),
            // falling back to the form's own name when that uuid has no message configured.
           <lookup complexExpression="#if($lmpObs)#set( $lmpFormNameCode = &quot;ui.i18n.EncounterType.name.${lmpObs.encounter.encounterType.uuid}&quot; )#set( $lmpFormName = $fn.message($lmpFormNameCode) )#if( $lmpFormName == $lmpFormNameCode )#set( $lmpFormName = $lmpObs.encounter.form.name )#end#end"/>
            const lastLMPformName = '<lookup complexExpression="$!{lmpFormName}"/>';
            const lastLMPencLocation = '<lookup complexExpression="#if($lmpObs)$!{lmpObs.encounter.location.name}#end"/>';
            const lastLMPproviders = '<lookup complexExpression="#if($lmpObs)#foreach( $encProvider in $lmpObs.encounter.activeEncounterProviders )#if( $velocityCount != 1 ), #end$!{encProvider.provider.name}#end#end"/>';
            const lastLMPDate = new Date(lastLMP);
            var daysBetween = daysBetweenUTCDates(currentEncounterDate, lastLMPDate);
            if (daysBetween &lt;= 305) {
                // SL-1279: The last menstruation date should not be more than 10 months in the past of the encounter date
                jq("#lastPeriodDateGroup").removeClass("hidden");
                jq("#lastLMPCaption").removeClass("hidden");
                jq("#lastPeriodDateValue").text(lastLMP);
                jq("#lastLMPFormName").text(lastLMPformName);
                jq("#lastLMPobsDateTime").text(lastLMPrecordedDate);
                jq("#lastLMPencLocation").text(lastLMPencLocation);
                jq("#lastLMPprovider").text(lastLMPproviders);
            }
        }

        var encObsGA = getField("estimatedGestationalAge.value") != null ? getField("estimatedGestationalAge.value").val() : null; // the encounter already has an GA obs value
        if ( ! encObsGA ) {
            <lookup complexExpression="#set( $gaObs = $fn.latestObsBeforeCurrentEncounter('CIEL:1438', false) )"/>
            const lastGA = '<lookup complexExpression="#if($gaObs)$!{gaObs.getValueNumeric()}#end"/>';
            if (lastGA) {
                jq("#lastGACaption").removeClass("hidden");
                const lastGArecordedDate = '<lookup complexExpression="#if($gaObs)$!{fn.formatDate($gaObs.obsDatetime, 'yyyy-MM-dd')}#end"/>';
                // Resolve the encounter name from the message properties (ui.i18n.EncounterType.name.&lt;form uuid&gt;),
                // falling back to the form's own name when that uuid has no message configured.
                <lookup complexExpression="#if($gaObs)#set( $gaFormNameCode = &quot;ui.i18n.EncounterType.name.${gaObs.encounter.encounterType.uuid}&quot; )#set( $gaFormName = $fn.message($gaFormNameCode) )#if( $gaFormName == $gaFormNameCode )#set( $gaFormName = $gaObs.encounter.form.name )#end#end"/>
                const lastGAformName = '<lookup complexExpression="$!{gaFormName}"/>';
                const lastGAencLocation = '<lookup complexExpression="#if($gaObs)$!{gaObs.encounter.location.name}#end"/>';
                // the providers on the encounter, as a comma-separated list of provider names
                const lastGAproviders = '<lookup complexExpression="#if($gaObs)#foreach( $encProvider in $gaObs.encounter.activeEncounterProviders )#if( $velocityCount != 1 ), #end$!{encProvider.provider.name}#end#end"/>';
                jq("#lastGAValue").text(lastGA);
                jq("#lastGAFormName").text(lastGAformName);
                jq("#lastGAobsDateTime").text(lastGArecordedDate);
                jq("#lastGAencLocation").text(lastGAencLocation);
                jq("#lastGAprovider").text(lastGAproviders);
            }
        }

        var encObsEdd = getField("edd.value") != null ? getField("edd.value").val() : null; // the encounter already has an EDD obs value
        if ( !encObsEdd ) {
            <lookup complexExpression="#set( $eddObs = $fn.latestObsBeforeCurrentEncounter('CIEL:5596', false) )"/>
            const lastEDD = '<lookup complexExpression="#if($eddObs)$!{fn.formatDate($eddObs.getValueDatetime(), 'yyyy-MM-dd')}#end"/>';
            const lastEnteredEDD = '<lookup complexExpression="#if($eddObs)$!{fn.formatDate($eddObs.obsDatetime, 'yyyy-MM-dd')}#end"/>';
            // Resolve the encounter name from the message properties (ui.i18n.EncounterType.name.&lt;form uuid&gt;),
            // falling back to the form's own name when that uuid has no message configured.
            <lookup complexExpression="#if($eddObs)#set( $eddFormNameCode = &quot;ui.i18n.EncounterType.name.${eddObs.encounter.encounterType.uuid}&quot; )#set( $eddFormName = $fn.message($eddFormNameCode) )#if( $eddFormName == $eddFormNameCode )#set( $eddFormName = $eddObs.encounter.form.name )#end#end"/>
            const lastEDDformName = '<lookup complexExpression="$!{eddFormName}"/>';
            const lastEDDencLocation = '<lookup complexExpression="#if($eddObs)$!{eddObs.encounter.location.name}#end"/>';
            const lastEDDproviders = '<lookup complexExpression="#if($eddObs)#foreach( $encProvider in $eddObs.encounter.activeEncounterProviders )#if( $velocityCount != 1 ), #end$!{encProvider.provider.name}#end#end"/>';
            if (lastEDD) {
                // UHM-8643: Estimated Delivery Date should not be greater than 10 months from encounter date
                const deliveryDate = dateFromString(lastEDD);
                if (deliveryDate) {
                    var daysBetween = daysBetweenUTCDates(deliveryDate, currentEncounterDate);
                    if (daysBetween &lt;= 305) {
                        //valid EDD - display EDD
                        if (getField("edd.value")) {
                            getField("edd.value").datepicker("setDate", deliveryDate);
                            jq("#lastEDDCaption").removeClass("hidden");
                            jq("#lastEDDValue").text(lastEDD);
                            jq("#lastEDDFormName").text(lastEDDformName);
                            jq("#lastEDDobsDateTime").text(lastEnteredEDD);
                            jq("#lastEDDencLocation").text(lastEDDencLocation);
                            jq("#lastEDDprovider").text(lastEDDproviders);
                        }
                    }
                }
            }
        }
        validateEstimatedDeliveryDate("edd", currentEncounterDate, '<uimessage code="pihcore.errors.eddField.invalidDate" />');

        jq("#gestationalAge input[type='text']").change(function() {
            const numValue = Number(this.value);
            const newEdd = calculateEddFromGA(numValue, currentEncounterDate);
            if (newEdd) {
                getField("edd.value").datepicker("setDate", newEdd);
            }
        });
    </ifMode>
});
