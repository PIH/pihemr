# PIH OpenMRS HTML Form documentation tooling

This folder in `pihemr` holds the **shared tooling** for documenting HTML forms and writing their Playwright E2E specs. It is the only copy: the site config repos (`zl-emr`, `pihsl-emr`, `pihliberia-emr`) keep their own outputs (`*.csv`, `_availability.e2e.md`, `_shared.e2e.md`, `e2e/`) in their own `documentation/` folders and run these files against themselves.

| File | What it is |
|---|---|
| `hfe-csv-docs.skill.md`, `parse_hfe.txt` | generate the per-form CSVs |
| `hfe-e2e-specs.skill.md` | the E2E spec skill (read this one first) |
| `inventory.py` | the mechanical inventory and `--check-coverage` (see below) |
| `_findings.e2e.md` | Verify findings of forms defined in `pihemr`, recorded once for all sites (created by the first run that finds one) |

To run the tooling for a site, start a Claude session in the **site repo** and point it at `<pihemr>/content/configuration/backend_configuration/pih/htmlforms/documentation/hfe-e2e-specs.skill.md`; `inventory.py` takes `--site-repo <the site repo>`. Check out the `pihemr` version the site's `distro/pom.xml` pins, because the merged config directory (`distro/target/distro/web/openmrs_config/pih`) is built from it.

```
python3 -m venv /tmp/v && /tmp/v/bin/pip install lxml
/tmp/v/bin/python -I <pihemr>/.../documentation/inventory.py --site-repo <site repo> --check-coverage
```
prints the forms (own and inherited) with neither a spec nor a "Not reachable" / "Not covered" row in the site's `_availability.e2e.md`, and exits 1 if there are any.

The contents of a site's /documentation folder are .csv files with the form configuration files in the parent directory.

These CSVs should always be serialized as valid CSV (consistent column counts per row, and proper quoting/escaping for commas, quotes, and multiline values) so they render and remain searchable in GitHub.

To regenerate documenting HFE files as .CSVs, follow these steps:

 - Start a new Claude session
 - Upload these 3 files:
    - parse_hfe.py
    - full_concept_mappings.csv (the latest one)
    - hfe-csv-docs.skill.md
 - Say something like *"I need to generate documentation CSVs for another set of OpenMRS HFE XML forms — I've uploaded the parser, concept mappings, and skill doc from last time"*

The CSV tooling files are in this directory of `pihemr`.

**NOTE:**  full_concept_mappings.csv is generated from this SQL statement against OpenMRS:

 ```
 select concept_name(concept_id,'en') "name", r.* 
   from report_mapping  r ;
 ```

Regenerate that file to ensure the latest mappings are used.

## E2E notes and verify mode

Beyond the CSVs, the separate `hfe-e2e-specs.skill.md` (which cross-references `hfe-csv-docs.skill.md`) describes how to write Playwright E2E specs for the forms (in `e2e/specs/`, see `e2e/README.md`). The documentation for a form (conditional display, scripts, side effects, verify findings) is written as comments in its spec, so there are no per-form notes. Two site-wide files remain: `_availability.e2e.md` (when each form is offered, written once per site from `openmrs-module-pihcore`'s `CustomAppLoaderFactory.java`, which references forms by file name rather than form uuid) and `_shared.e2e.md` (shared subforms and scripts, and the findings in them). Versioned `_v*` copies are skipped. The work runs on fresh agents (not forks) to keep token use down. `inventory.py` (needs `lxml`) does the mechanical part first: per-form inventories (`<form>.inv.md`) with the conditional-display and JavaScript tables pre-filled, the mechanical verify checks, a flag for forms with nothing conditional, a note on which unresolved concepts are probably just newer than the mappings CSV, and git-based skipping of forms whose spec is up to date (`--only-changed`).

The E2E skill also has an optional **verify mode**. Ask for it with something like *"generate the docs for these forms and verify them"*. It reviews the form XML for incorrectly passed HFE parameters and for custom JavaScript that doesn't do what it intends. It reports findings with a severity (High / Medium / Low / Info) and proposed fixes, and does not edit the forms unless asked.

The E2E specs and the two `_*.e2e.md` files are written by the model rather than by `parse_hfe.py`, and the CSV format is unchanged.
 
