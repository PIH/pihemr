/**
 * This is intended to be used to populate the table in the allergies-table.xml subform, or a similar custom table
 * It looks for elements with specific classes in the form, and will populate them with the patient's allergy information
 */
jq(document).ready(function() {
    const allergiesTable = jq(".allergies-table-subform .allergies-table");
    const allergiesTableBody = allergiesTable.find("tbody");
    if (allergiesTableBody.length > 0) {
        allergiesTableBody.empty();
        allergiesTableBody.append(jq("<tr/>").append(jq("<td/>").attr("colspan", "5").append(jq("<i/>").addClass("icon-spinner icon-spin"))));
        const patientUuid = '<lookup expression="patient.uuid"/>';
        const rep = "custom:(display,reactions:(reaction:(display),reactionNonCoded),severity:(display),comment,auditInfo:(dateChanged,dateCreated))";
        jq.get(openmrsContextPath + "/ws/rest/v1/patient/" + patientUuid + "/allergy?v=" + rep, function(data, textStatus, jqXHR) {
            allergiesTableBody.empty();
            const status = jqXHR.status;
            const allergies = data?.results ?? [];
            if (allergies.length === 0) {
                const message = status === 204 ? '<uimessage code="allergyui.unknown"/>' : '<uimessage code="allergyui.noKnownAllergies"/>';
                const noAllergiesRow = jq("<tr/>");
                noAllergiesRow.append(jq("<td/>").attr("colspan", "5").html(message));
                allergiesTableBody.append(noAllergiesRow);
            }
            else {
                allergies.forEach(a => {
                    const row = jq("<tr/>");
                    row.append(jq("<td/>").addClass("allergy-allergen-column").html(a.display));
                    row.append(jq("<td/>").addClass("allergy-reaction-column").html((a.reactions ?? []).map(r => { return r.reaction?.display ?? r.reactionNonCoded ?? "" }).join(", ")));
                    row.append(jq("<td/>").addClass("allergy-severity-column").html(a.severity?.display ?? ""));
                    row.append(jq("<td/>").addClass("allergy-comment--column").html(a.comment ?? ""));
                    row.append(jq("<td/>").addClass("allergy-last-updated-column").html(moment(a.auditInfo.dateChanged ?? a.auditInfo.dateCreated).format("DD MMM YYYY")));
                    allergiesTableBody.append(row);
                });
            }
        });
    }
});
