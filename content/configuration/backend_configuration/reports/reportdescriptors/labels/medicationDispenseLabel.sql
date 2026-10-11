-- set @medicationDispenseUuid = '0adfd342-ca90-4da4-9104-1cfa117443bb';

set @locale = global_property_value('default_locale', 'en');

select
    d.uuid as medication_dispense_uuid,
    location_name(d.location_id) as dispense_location,
    location_name(l.parent_location) as dispense_parent_location,
    location_name(v.location_id) as visit_location,
    person_name(d.patient_id) as patient_name,
    d.dosing_instructions as patient_instructions,
    provider_name_from_provider_id(o.orderer) as prescriber,
    provider_name_from_provider_id(d.dispenser) as dispenser,
    o.date_activated as date_prescribed,
    d.date_handed_over as date_dispensed,
    drugName(d.drug_id) as drug_name,
    case
        when dose = floor(dose) then cast(cast(dose as signed) as char)
        else cast(dose as char)
    end as dose,
    concept_name(dose_units, @locale) as dose_units,
    concept_name(route, @locale) as route,
    concept_name(f.concept_id, @locale) as frequency,
    as_needed,
    case
        when quantity = floor(quantity) then cast(cast(quantity as signed) as char)
        else cast(quantity as char)
    end as quantity,
    concept_name(quantity_units, @locale) as quantity_units
from medication_dispense d
left join orders o on d.drug_order_id = o.order_id
left join encounter e on o.encounter_id = e.encounter_id
left join visit v on e.visit_id = v.visit_id
left join location l on d.location_id = l.location_id
left join order_frequency f on d.frequency = f.order_frequency_id
where d.uuid = @medicationDispenseUuid
;