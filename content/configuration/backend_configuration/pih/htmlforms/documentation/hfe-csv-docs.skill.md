# Skill: OpenMRS HFE XML → Documentation CSV

## What this does

Parses OpenMRS HTML Form Entry (HFE) XML files from a PIH configuration repository and generates one documentation CSV per form. The CSV format matches the PIH standard:

| Column | Description |
|---|---|
| Question | Human-readable field label |
| Datatype | Coded / Text / Numeric / Date / Other |
| Possible Answers | Pipe-separated answer labels |
| input type | radio / checkbox / textarea / number / date / autocomplete / subform / etc. |
| required? | Yes / No |
| skip logic? | e.g. "Yes → show #hospital-details" or "no" |
| concept for question | e.g. `CIEL:5703` or `PIH:DIAGNOSIS` |
| concepts for answers | Pipe-separated concept IDs |
| group name (if part of concept group) | e.g. "Blood transfusion" |
| concept group mapping | e.g. `PIH:Transfusion construct` |

## How to run it

The parser is `parse_hfe.py`. It requires:
- The XML files directory as arg 1
- The output CSV directory as arg 2
- The concept mappings CSV at either `/root/full_concept_mappings.csv` or the uploaded path (hardcoded in `_load_concept_lookup()`)

```bash
python3 parse_hfe.py /path/to/htmlforms /path/to/csv_output
```

The concept mappings CSV (`full_concept_mappings.csv`) has columns: `name, concept_id, source, code`. The lookup key is `source:code` (e.g. `CIEL:1721`).

## Source repository (example: Sierra Leone)

This skill is used across PIH sites (Sierra Leone, Haiti/ZL, Liberia, Malawi, ...). Substitute the site's config repo. Example, PIH Sierra Leone config: https://github.com/PIH/openmrs-config-pihsl  
XML forms are under: `configuration/pih/htmlforms/`  
Access via sparse clone over HTTPS (GitHub API is blocked from cloud):
```bash
git clone --depth=1 --filter=blob:none --sparse https://github.com/PIH/openmrs-config-pihsl.git
cd openmrs-config-pihsl
git sparse-checkout set configuration/pih/htmlforms
```

## Key HFE XML elements handled

- `<obs>` — main form field; attributes: `conceptId`, `style`, `answerConceptIds`, `answerCodes`, `labelText`, `required`, `allowFutureDates`, `allowPastDates`
- `<obsgroup groupingConceptId="...">` — wraps related obs into a concept group
- `<repeat><template>` — dynamically generated fields with `{var}` placeholders; each `<render>` substitutes values
- `<subform>` — references another form file
- `<encounterDiagnosesByObs>` — diagnoses widget
- `<encounterDisposition>` — disposition widget
- `<scheduleAppointment>` — appointment scheduling widget
- `<controls><when value="CIEL:X" thenDisplay="#id"/>` — skip logic

## Critical rules / bugs fixed during development

### Label extraction
- Labels can be in `<label>`, `<uimessage code="..."/>`, `<h3>`–`<h6>`, or `labelText` attribute
- `<uimessage>` may be nested inside `<strong>` or other wrappers inside `<label>` — use `elem.iter()` not direct child search
- Labels are searched by traversing **preceding siblings** up the DOM tree (depth=4)
- The `humanize()` function strips i18n namespace prefixes (`pihcore.`, `emr.`, `mirebalais.`, etc.) and section sub-prefixes (`mch.`, `lab.`, `ncd.`, etc.), then splits camelCase
- **Do not humanize labels that contain spaces or parentheses** — they are already human-readable (e.g. `FeFol (Ferrous sulfate + Folic acid)`)

### `<repeat>` / `<template>` handling
- Variable substitution (`{var}` → value) must happen **before** `humanize()`, not after
- If you humanize first, camelCase splitting corrupts the placeholder (e.g. `{qName}` → `{q Name}`) and substitution fails
- Two repeat patterns:
  - **Pattern A**: same concept, different answer per render → collapse into one CSV row
  - **Pattern B**: different concept per render → one CSV row per render

### Answer label resolution (priority order)
1. `answerCodes` attribute on the `<obs>` element (comma-separated, parallel to `answerConceptIds`)
2. `CONCEPT_LABELS` dict (hardcoded overrides for Yes/No/Positive/Negative/etc.)
3. `CONCEPT_LOOKUP` dict (loaded from `full_concept_mappings.csv` — 17,487 entries)
4. PIH text-based concepts: `PIH:ABNORMAL` → `"Abnormal"` (title-case the part after the colon)
5. Fall back to raw concept ID

### Skip logic
- `<when value="CIEL:X" thenDisplay="#id"/>` — apply `concept_label()` to the `value` attribute
- Result format: `"Yes → show #hospital-details"`

### Date type inference
- `<obs>` with no `style` attribute defaults to `radio`
- If `allowFutureDates="true"` or `allowPastDates="true"` is present, infer `style="date"`

### Special widgets (not standard obs)
| XML element | Question label | Datatype | input type |
|---|---|---|---|
| `<subform>` | `"Subform: {filename}"` | Other | subform |
| `<encounterDiagnosesByObs>` | `"Diagnoses (encounterDiagnosesByObs)"` | Other | diagnoses widget |
| `<encounterDisposition>` | `"Disposition"` | Other | disposition widget |
| `<scheduleAppointment>` | `"Next appointment date"` | Other | scheduleAppointment |

### Special obs types
- Blood type / Vitals GCS: `<obs conceptId="CIEL:160347" style="radio"/>` — no answer concepts in XML, leave Possible Answers as N/A
- Urine output: `PIH:21114` — similar
- Drug orders: rendered as a special widget row

## Files to bring into a new session

- `parse_hfe.py` — the parser script (user has a copy)
- `full_concept_mappings.csv` — concept ID → label lookup (user has a copy; 17,487 entries, columns: name, concept_id, source, code)

Upload both at the start of the session. Place the concept mappings at `/root/full_concept_mappings.csv` so the parser finds it automatically.

## Related skill

For writing Playwright E2E specs for these forms (conditional display, JavaScript, form availability, verify findings), see `hfe-e2e-specs.skill.md` in this directory. That skill starts from the CSVs this skill produces and never changes their schema. It also keeps the "Forms tested" table in `e2e/README.md` (form name, version, uuid and encounter type per spec), which is read from the XML, not from these CSVs.
