-- set @medicationDispenseUuids = '0adfd342-ca90-4da4-9104-1cfa117443bb,5c1f1a58-6a3e-4b86-9f0a-3b0a5a6d3a11';
-- set @printBagLabel = true;
-- set @encounterUuid = '...';

set @locale = global_property_value('default_locale', 'en');

-- One row per label, in print order: the bag label first (if requested), then one row per medication dispense.

select
    'bag' as row_type,
    0 as sort_order,
    0 as sort_index,
    null as medication_dispense_uuid,
    location_name(e.location_id) as order_location,
    null as dispense_location,
    null as dispense_parent_location,
    location_name(v.location_id) as visit_location,
    person_name(e.patient_id) as patient_name,
    date_format(now(), '%d-%b-%Y') as print_date,
    null as patient_instructions,
    null as prescriber,
    null as dispenser,
    null as date_prescribed,
    null as date_dispensed,
    null as drug_name,
    null as dose,
    null as dose_units,
    null as route,
    null as frequency,
    null as as_needed,
    null as quantity,
    null as quantity_units
from encounter e
left join visit v on e.visit_id = v.visit_id
where e.uuid = @encounterUuid
  and lower(cast(@printBagLabel as char)) in ('1', 'true')

union all

select
    'medication' as row_type,
    1 as sort_order,
    find_in_set(d.uuid, @medicationDispenseUuids) as sort_index,
    d.uuid as medication_dispense_uuid,
    null as order_location,
    location_name(d.location_id) as dispense_location,
    location_name(l.parent_location) as dispense_parent_location,
    location_name(v.location_id) as visit_location,
    person_name(d.patient_id) as patient_name,
    null as print_date,
    d.dosing_instructions as patient_instructions,
    provider_name_from_provider_id(o.orderer) as prescriber,
    provider_name_from_provider_id(d.dispenser) as dispenser,
    date_format(o.date_activated, '%d-%b-%Y') as date_prescribed,
    date_format(d.date_handed_over, '%d-%b-%Y') as date_dispensed,
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
where find_in_set(d.uuid, @medicationDispenseUuids)

order by sort_order, sort_index
;
