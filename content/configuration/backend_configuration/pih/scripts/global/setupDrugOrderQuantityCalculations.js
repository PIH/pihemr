/**
 * Convenience function to be used on htmlforms to ensure the orderWidget is initialized first
 * followed by setting up the drug order widget to auto-calculate quantity based on dosing information, if possible
 * @param config
 */
function initializeOrderWidgetAndSetupDrugOrderQuantityCalculations(config) {
    orderWidget.initialize(config);
    setupDrugOrderQuantityCalculations(config);
}

/**
 * Set up the drug order widget to auto-calculate quantity based on dosing information, if possible
 * @param config
 */
function setupDrugOrderQuantityCalculations(config) {
    console.debug(config);
    const drugs = new Map();
    config.concepts.forEach(concept => {
        if (concept.drugs) {
            concept.drugs.forEach(drug => {
                drugs.set(drug.drugId, { ...drug, conceptId: concept.conceptId });
            })
        }
    });

    // Apply translations
    jq(".calculated-quantity-button").html(jq("#calculated-quantity-label").html());

    // Unlike the calculated-quantity-button, the drug search's "clear" button
    // (.custom-button) isn't part of the static order template - orderWidget.js
    // builds it dynamically each time a new order entry form is opened (see
    // convertToAutocomplete), which happens after this function's one-time
    // pass runs. Watch for it being added and translate it the moment it
    // appears, instead of only translating whatever already exists now.
    const $widgetField = jq("#" + config.fieldName);
    const clearButtonLabel = jq("#clear-button-label").html();
    $widgetField.find(".custom-button").html(clearButtonLabel);
    if ($widgetField.length && window.MutationObserver) {
        new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                jq(mutation.addedNodes).find(".custom-button").addBack(".custom-button").html(clearButtonLabel);
            });
        }).observe($widgetField[0], { childList: true, subtree: true });
    }

    jq("#" + config.fieldName).find(".calculated-quantity-section").hide();
    jq("#" + config.fieldName).find(".calculated-quantity-value").val("");

    jq("#" + config.fieldName).find(".calculated-quantity-button").click(function(event) {
        event.preventDefault();
        const $calculatedQuantityButton = jq(this);
        const $orderForm = $calculatedQuantityButton.closest(".orderwidget-order-form");
        const $calculatedQuantityInput = $orderForm.find(".calculated-quantity-value");
        const calculatedValue = $calculatedQuantityInput.val();
        const $quantityInput = $orderForm.find(".order-field-widget.order-quantity")?.find(":input");
        $quantityInput.val(calculatedValue ?? "");
    });

    jq("#" + config.fieldName).find(":input").change(function() {
        const $orderForm = jq(this).closest(".orderwidget-order-form");
        const $drugField = $orderForm.find(".order-field-widget.order-drug")?.find("select");
        const drugId = $drugField?.val();
        const $calculatedQuantitySection = $orderForm.find(".calculated-quantity-section");
        const $calculatedQuantityInput = $orderForm.find(".calculated-quantity-value");
        $calculatedQuantityInput.val("");
        $calculatedQuantitySection.hide();
        const drug = drugs.get(drugId);
        if (drug) {

            // Drug configuration
            const ingredient = drug.ingredients && drug.ingredients.length === 1 && drug.ingredients[0].ingredient === drug.conceptId ? drug.ingredients[0] : null;
            const ingredientStrength = ingredient ? ingredient.strength : null;
            const ingredientUnits = ingredient ? ingredient.units : null;
            const drugDosageForm = drug.dosageForm;

            const $quantityUnitsField = $orderForm.find(".order-field-widget.order-quantityUnits")?.find(":input");

            // If the drug is changed, set the quantity units to try to match the drug dosage form, if possible
            if (jq(this).closest(".order-field-widget").hasClass("order-drug")) {
                if ($quantityUnitsField && $quantityUnitsField.find("option[value='" + drugDosageForm + "']").length > 0) {
                    $quantityUnitsField.val(drugDosageForm);
                }
            }

            // Action
            const action = $orderForm.find(".order-field-widget.order-action")?.find(":input")?.val();
            if (action === 'DISCONTINUE') {
                return;
            }

            // Input fields from the widget
            const dose = $orderForm.find(".order-field-widget.order-dose")?.find(":input")?.val();
            const doseUnits = $orderForm.find(".order-field-widget.order-doseUnits")?.find(":input")?.val();
            const frequency = $orderForm.find(".order-field-widget.order-frequency")?.find(":input")?.val();
            const duration = $orderForm.find(".order-field-widget.order-duration")?.find(":input")?.val();
            const durationUnits = $orderForm.find(".order-field-widget.order-durationUnits")?.find(":input")?.val();
            const quantityUnits = $quantityUnitsField?.val();

            // Only calculate quantity of all expected fields are completed
            if (!dose || !doseUnits || !frequency || !duration || !durationUnits) {
                return;
            }

            // Only calculate quantity if the quantity units match the drug dosage form
            if (!quantityUnits || quantityUnits !== drugDosageForm) {
                console.debug("Cannot calculate quantity if quantity units do not match drug dosage form");
                return;
            }

            // Require that the selected frequency has a frequency per day
            const dosesPerDay = config.orderFrequencies?.find((f) => f.id === frequency)?.frequencyPerDay;
            if (!dosesPerDay) {
                console.debug("Unable to determine frequency per day of chosen frequency");
                return;
            }

            /*
                Support 2 dosage scenarios.
                Scenario 1:  The dose units match the ingredient units and the dose is an even multiple of the ingredient strength
                             For example, the drug ingredient is 200mg, and the order is for 400mg.  Units in this case would be 2.
                Scenario 2:  The order dose units matches the drug dosage form
                             For example, the drug has a dosage form of tablets, and the order is for 2 tablets.  Units in this case would be 2.
             */
            let unitsPerDose = null;
            if (ingredientUnits && ingredientStrength && doseUnits === ingredientUnits) {
                if (dose % ingredientStrength === 0) {
                    unitsPerDose = dose / ingredientStrength;
                }
                else {
                    console.debug("The dose is not an even multiple of the drug strength, unable to calculate quantity");
                    return;
                }
            }
            else if (doseUnits === drugDosageForm) {
                unitsPerDose = dose;
            }
            else {
                console.debug("Unable to determine the number of drug units per dose, unable to calculate quantity")
                return;
            }

            const durationObject = config.durations.find((duration) => duration.conceptId === durationUnits);
            const durationCode = durationObject?.code;
            let durationDays = null;
            if (durationCode === 'days') {
                durationDays = duration;
            }
            else if (durationCode === 'weeks') {
                durationDays = duration * 7;
            }
            else if (durationCode === 'months') {
                durationDays = duration * 30; // TODO: Is this accurate enough or do we need to factor in days/month
            }
            else if (durationCode === 'years') {
                durationDays = duration * 365; // TODO: Is this accurate enough or do we need to factor in days/year
            }
            else {
                console.debug("Duration units is not able to be mapped to days, unable to calculate quantity");
                return;
            }

            if (unitsPerDose && dosesPerDay && durationDays) {
                const quantityToSet = unitsPerDose * dosesPerDay * durationDays;
                console.debug("Calculated quantity: " + quantityToSet);
                $calculatedQuantityInput.val(quantityToSet);
                $calculatedQuantitySection.show();
            }
            else {
                console.debug("Units per dose, doses per day, and duration days are not all set, unable to calculate quantity");
            }
        }
    });
}