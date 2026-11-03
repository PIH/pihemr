

# PIH EMR Configuration

This repository provides standard configuration that is shared across all instances of the PIH-EMR. In addition to this, 
each country-level distro has it's own configuration repository that can override and supplement the customization
provided here.

The configuration distro projects are as follows:

|Site|Repo  |
|---|---|
|CES|https://github.com/PIH/ces-emr|
|Lesotho|https://github.com/PIH/lesotho-emr|
|Liberia|https://github.com/PIH/pihliberia-emr|
|Sierra Leone|https://github.com/PIH/pihsl-emr|
|ZL|https://github.com/PIH/zl-emr|


This repository provides the `content/` module, which contains a base set of configuration files that are shared across multiple PIHEMR-based distribution
It also provides the `distro/` module, which defines the base PIH EMR distribution. 
Country-specific config repos provide their own `content` and `distro` modules that layer on top of these.

The OpenMRS SDK's `build-distro` goal assembles the `content/`, `distro/`, and any country-specific modules into a runnable distribution. See [`content/README.md`](content/README.md) and [`distro/README.md`](distro/README.md) for details on how each module works.

As part of our build, the latest configuration artifacts for each country are deployed to [sonatype](https://s01.oss.sonatype.org/#nexus-search;quick~org.pih.openmrs).

Release instructions can be found 
[in Confluence](https://pihemr.atlassian.net/wiki/spaces/PIHEMR/pages/482705471/Release+instructions+for+PIH+EMR+Distro).

## Configurable elements

We are in the process of moving all of our configuration out of code (generally in the PIH Core and
Mirebalais modules) into these new config projects.  Below is a list of what is currently configured here, but we
expect this to continue to grow in the near future.

### Initializer Domains

The preferred method of managing metadata generally is using
[Initializer](https://github.com/mekomsolutions/openmrs-module-initializer), aka "Iniz."
All subdirectories of
[`content/configuration/`](https://github.com/PIH/pihemr/tree/master/content/configuration)
other than `pih/` and `reports/` are processed by Initializer. At present, this includes
- attribute types
- global properties
- locations
- location tags
- message properties
- privileges
- roles
and in the site-specific config repos,
- addresshierarchy
- drugs

Please consult the relevant
[Initializer documentation](https://github.com/mekomsolutions/openmrs-module-initializer#supported-domains-and-default-loading-order)
for information about each one.

### PIH Config

PIH Config json files (which determine what components are turned on for each server, among other things) are
found in the country-specific config projects in the 'content/configuration/backend_configuration/pih' directory. Which "config" files are
activated depends on the "pih.config" property defined in the runtime properties file for your specific server.

For example, if you set pih.config as follows in your runtime.properties file:

```
pih.config=mirebalais,mirebalais-humci
```

Then the following two config files will be used

```
pih-config-mirebalais.json
pih-config-mirebalais-humci.json
```

Note that the files will be loaded left to right, with latter config files overridding earlier ones.

Unfortunately, these files currently aren't "hot reloadable", but will be reloaded upon restarting the server.

Components are defined in [pihcore/.../config/Components.java](https://github.com/PIH/openmrs-module-pihcore/blob/master/api/src/main/java/org/openmrs/module/pihcore/config/Components.java). Based on these component selections (and often some other criteria) the CALF ([mirebalais/.../CustomAppLoaderFactory.java](https://github.com/PIH/openmrs-module-mirebalais/blob/master/api/src/main/java/org/openmrs/module/mirebalais/apploader/CustomAppLoaderFactory.java)) loads apps and forms. Apps are defined in [mirebalais/.../CustomAppLoaderConstants.java](https://github.com/PIH/openmrs-module-mirebalais/blob/master/api/src/main/java/org/openmrs/module/mirebalais/apploader/CustomAppLoaderConstants.java).

#### Existing Components

- **activeVisits**: Adds the "Active Visits" app to the homepage. It lists the current 
  active visits. On humdemo
- **adt**: Enables "Awaiting Admission" and "Inpatients" apps on the homepage. Adds 
  the Admission Note as an action. This adds pts to Awaiting Admission, which provides
  a couple forms for Admitting or Cancelling. Requires Admission Note location tag.
- **allDataExports**: show all data exports, regardless of what components are actually
  enabled (used by Mirebalais reporting server)
- **allergies**: Adds Allergy Summary widget to clinician dashboard.
- **ancProgram**: Needs ANCProgramBundle, used by CES.
- **appointmentScheduling**: Adds Actions to request and schedule appointments. Provides
  Appointment Summary widget on clinician dashboard. Adds Schedule Appointment app to home page.
  The Schedule Appointment app provides the UI for configuring appointments.
- **archives**: Enables functionality for paper record management. Pretty targeted for Mirebalais.
  Request paper records, print labels.
- **asthmaProgram**: Needs AsthmaProgramBundle, used by CES.
- **biometricsFingerPrints**: Enables fingerprint search as part of main pt search. Adds
  Biometrics summary to pt registration summary page. Requires a biometrics server to be
  running.
- **bmiOnClinicianDashboard**: Adds height and weight graph to pt dashboard.
- **chartSearch**: Not used.
- **checkIn**: Adds the check-in form. Requires Check-in location tag.
- **checkInHomepageApp**: Adds Cyclical Check-In App on home page. Requires Check-in location tag.
  Requires checkIn component.
- **chemotherapy**: Adds chemo forms as visit actions. Under construction -- cannot be used yet.
- **clinicianDashboard**: Enables the main clinician dashboard (aka patient dashboard).
- **cohortBuilder**: Adds cohort builder OWA. openmrs-owa-cohortbuilder
- **conditionList**: A dashboard widget that lists "conditions".
- **consult**: Adds outpatientConsult form to visit actions. Uses Consult Note Location tag.
- **covid19**: Adds COVID-19 forms to visit actions. Uses COVID-19 Location tag.
- **covid19IntakeForm**: Just the intake form for COVID-19. Uses COVID-19 Location tag.
- **dataExports**: Enables the "data exports" section of the Reports app on the home page.
- **diabetesProgram**: Needs DiabetesProgram bundle, used by CES
- **dispensing**: Adds dispensing form as visit action, Dispensing app to home page, and
  dispensing summary to clinician dashboard.
- **edConsult**: Adds edNote htmlform. Requires ED Note Location Tag.
- **edTriage**: Adds edTriage app/form as visit action. Adds cyclical ED Triage app to home page.
- **edTriageQueue**: Adds ED Triage Queue to Home page. Lists queue of patients based on `edTriage` app.
- **epilepsyProgram**: Needs EpilepsyProgramBundle, used by CES.
- **exportPatients**: App that creates a JSON of all the patients in the system. Adds the button
  to System Administration app from the home page. `exportPatients.page`.
- **growthChart**: Adds an action that leads to a growth chart.
- **hiv**: Program, forms, and dispensing app. Needs HIVProgramBundle and Haiti HIV MDS package. Location needs "HIV Consult Location" tag.
- **hivProgram**: Just the program. Needs HIVProgramBundle and Haiti HIV MDS package.
- **hivForms**: Just the forms and dispensing app. Needs Haiti HIV MDS package. Location needs "HIV Consult Location" tag.
- **hivIntakeForm**: Just the intake form. Needs Haiti HIV MDS package. Location needs "HIV Consult Location" tag.
- **hypertensionProgram**: needs HypertensionProgram bundle, used by CES.
- **idcardPrinting**: Adds registration action to print an ID card. Adds an ID Card Printing widget
  to the pt registration summary. Requires "registerPatient" privilege. Printers must be configured.
- **importPatients**: App that takes a JSON from `exportPatients` and creates all of the patients in
  the database. Also linked from the System Administration app from the home page.
- **labResults**: Adds labResults htmlform as a visit action. Superceded by `labs`.
- **labs**: Adds Labs app to home page. Adds Order Labs and View Lab Results actions to pt dashboard.
- **lacollinePatientRegistrationEncounterTypes**: Probably not used. Payment and Primary Care Visit encounter types.
- **legacyMpi**: Something that was used to import patients from Lacolline to Mirebalais. Might be usable elsewhere.
- **malnutritionProgram**: Needs MalnutritionProgramBundle, used by CES.
- **managePrinters**: Adds Printer Administration page to System Administration page from home page. Printers
  must be on the LAN and one of the supported printer types.
- **markPatientDead**: Turns on the RefApp functionality for marking a patient dead.
- **mch**: mchForms + mchProgram
- **mchForms**: used by ZL and Liberia (via "mch")
- **mchBasicDeliveryForm**: used by Sierra Leone at Wellbody Clinic to show a delivery form
- **mchProgram**: needs MCHProgramBundle[ZL], used by ZL (via "mch")
- **medicationDispensing**: Future medication dispensing application (under development)
- **mentalHealth**: mentalHealthForm + mentalHealthProgram
- **mentalHealthForm**: used by ZL (via "mentalHealth")
- **mentalHealthProgram**: needs MentalHealthProgram bundle, used by ZL and CES
- **monitoringReports**: Adds the "Monitoring" section of reports to the Reports page. Reports also must
  be configured to the right country and site.
- **myAccount**: Adds "My Account" button to home page which allows setting password.
- **ncd**: program
- **oncology**: program
- **orderEntry**: TODO we probably want a different name for this?  break up by drug orders and lab orders, etc?
- **ovc**: program and forms
- **overviewReports**: Adds "Overview" section of reports to the Reports page. Reports also must
  be configured to the right country and site.
- **pacsIntegration**: Custom Mirebalais "Picture Archives and Communication" system. Or maybe doesn't do anything?
- **pathologyTracking**: Adds "Pathology Tracking" app to home page. Adds Order Pathology Test action to pt dashboard.
  Adds Pathology Status widget to pt dashboard.
- **patientDocuments**: openmrs-module-attachments
- **patientRegistration**: Adds Patient Registration app to Home Page. Configures Registration Summary page.
- **prescriptions**: No longer used.
- **primaryCare**: Primary care forms for Haiti, Mexico, and Sierra Leone (country-dependent).
- **programs**: Enables the Programs widget on the pt dashboard, if there are any program components
  enabled. *Required* for any programs to work.
- **providerRelationships**: The Relationships widget, configured for providers.
- **radiology**: Adds the actions for ordering X-rays, CTs, and Ultrasounds. Adds Pending Radiology Orders
  and Radiology Results widgets to pt dashboard.
- **relationships**: Adds relationship summary widget to pt dashboard.
- **socioEconomics**: Adds socio-econ htmlform to visit actions. Requires Consult Note location tag.
- **spa**: The Single-SPA UI. Accessible at `/openmrs/spa/login`. Requires some set-up.
- **spaPreview**: "Preview" links from the old UI to the Single-SPA UI, which are visible only to System Administrators.
- **surgery**: Adds surgery htmlform visit action. Required Surgery Note location tag.
- **systemAdministration**: Enables System Administration app from home page, and Manage Accounts,
  Merge Patient Electronic Records, and Advanced Features. Requires privilege `emr.systemAdministration`.
- **tb**: Tuberculosis intake form.
- **todaysVisits**: Adds the "Active Visits" app to the homepage. It lists the visits from that day.
- **uhmVitals**: Custom vitals app used in Mirebalais. Don't worry about it.
- **vaccination**: Adds htmlform called "vaccination-only" to visit actions. Requires Vaccination location tag.
  Requires `visitNote`.
- **vct**: Adds Voluntary Counseling and Testing (for HIV) htmlform as visit action.
- **visitManagement**: Adds Start Visit, Add Past Visits, and Merge Visits links to general actions.
- **visitNote**: A different UI for the visit dashboard, which supports form sections.
- **vitals**: Enables the vitals htmlform as a visit action. Adds the cyclical Vitals app button to the
  home page. Adds Most Recent Vitals app to pt dashboard.
- **vitalsHomepageApp**: Adds the cyclical Vitals app button to the
    home page. Requires vitals component.
- **waitingForConsult**: Adds the Consult Queues app button to the home page. List of patients who are
  checked in and have had their vitals taken, but have not yet had a consult. On ci.pih-emr.org
- **wristbands**: Adds Print Wristbands to general actions.
- **zika**: program

### EncounterTypeConfig.js

The Encounter Type Config is a JavaScript file that configures the way that encounters are displayed on the 
PIH "Visit Note" page.  Originally packaged within the PIH Core module, we moved it into the PIH EMR config project,
taking advantage of the ability to load JavaScript files from the file system (see the "Custom JavaScript and CSS" 
section below).

Although one could override the Encounter Type Config in a distro config project, that's not recommended at this 
point, better to issue PRs against the existing Encounter Type Config.  (Ideally in the future we will provide
a more sophisticated way to override parts of the Encounter Type Config without having to override all of it).

https://github.com/PIH/pihemr/blob/master/content/configuration/backend_configuration/pih/scripts/visit/encounterTypeConfig.js

### Addresses and Address Hierarchy

There are two parts to address configuration.

First there is the Address Hierarchy module configuration, which manages the address hierarchy
data in MySQL. This is done by adding
[AddressHierarchy config files](https://wiki.openmrs.org/display/docs/Address+Hierarchy+Advanced+Features) (see "Activator Loading of Address Configuration & Entries") to the
`content/configuration/backend_configuration/addresshierarchy/` directory in the config repository for your distribution.

Then there's the RegistrationApp configuration with respect to addresses. The two settings of note
here are the shortcut field and the manual (i.e., free-text) fields. These are configured in the
addressConfig tree in your PIH config file (found in 
`content/configuration/backend_configuration/pih` directory of the config project for your distribution). These options are handled by 
[mirebalais/.../PatientRegistrationApp](https://github.com/PIH/openmrs-module-mirebalais/blob/8a565656ff335cd28dcb310c0b1c4de3dcd4d62f/api/src/main/java/org/openmrs/module/mirebalais/apploader/apps/PatientRegistrationApp.java).
If you don’t provide this configuration, this file provides defaults.

### Concepts 

[OpenConceptLab (OCL)](https://app.openconceptlab.org/#/orgs/PIH/sources/PIH/concepts/) is used for concept management.  OCL exports a version of the PIH source which is added to the "content/configuration/backend_configuration/ocl" directory.  During installation (run), that zip package is installed in the OpenMRS instance.
package.  Generally, we have consolidated all the PIH EMR concepts which are installed on all servers.

Country-specific concepts are added for Mexico, but hopefully this will change.

### Forms

All forms are now packages within the PIH Config.  Any form suitable to be shared across implementations can 
be found "/content/configuration/backend_configuration/pih/htmlforms" directory of this project.  Country-specific forms can be found in the
same directory in the site-specific repositories.  If a form with the same name is found in both this repository
and the country-specific repository, the country-specific format "wins".

The XML files that  represent forms are parsed by the HTML FormEntry Module. Check out the
[HTML Form Entry Reference](https://wiki.openmrs.org/display/docs/HTML+Form+Entry+Module+Reference).

Note that these forms are also "hot reloadable".  On an existing server, if you install or update a 
version of a form, the next time someone opens a new instance of that form, the latest version of the 
form will be loaded. (Note that there may be some cases where the form path does not appear in the URL.
In these cases, the form will not be hot-reloaded.)

Also note that although we do not yet use this feature, variable substitution is available within forms. You
can define a variable in `content/content.properties` and then use it within multiple forms.

The application logic that specifies when to display forms, and which form files to use, is still in code and found 
in [CALF](https://github.com/PIH/openmrs-module-mirebalais/blob/master/api/src/main/java/org/openmrs/module/mirebalais/apploader/CustomAppLoaderFactory.java).

Note that this application logic often depends both on which components are enabled and which location tags are enabled
at the active location.  Location Tags are currently set up in the PIH config; see for example
[pih-config-haiti-hiv.json](https://github.com/PIH/openmrs-config-zl/blob/a7dd3dcfb34462e9088c03dc7ea7823a2868d48a/configuration/pih/pih-config-haiti-hiv.json#L64).

A form must refer to an encounter type. Encounter types are managed using
[Initializer](https://github.com/mekomsolutions/openmrs-module-initializer/blob/master/readme/et.md);
see
[pihemr/content/configuration/backend_configuration/encountertypes](https://github.com/PIH/pihemr/tree/master/content/configuration/backend_configuration/encountertypes).

All forms are associated with components, which are declared in
[pihcore/Components.java](https://github.com/PIH/openmrs-module-pihcore/blob/master/api/src/main/java/org/openmrs/module/pihcore/config/Components.java)
and then used in the CALF.

When creating a form you will also need to add boilerplate to
[pihemr/encounterTypeConfig.js](https://github.com/PIH/pihemr/blob/master/content/configuration/backend_configuration/pih/scripts/visit/encounterTypeConfig.js).
This configures features of how the form appears. If a form will have sections,
this is configured here.

### Programs

Current overview of how programs are defined across config projects as-of Nov 2024:

#### Config-PIHEMR

Programs

* programs.csv -- all programs shared across all sites

Program Workflows

* programworkflows.csv – all program workflows shared across all sites

Program Workflow States

* programworkflowstates.csv – all program workflows shared across all sites
* pregnancy.csv – states for pregnancy program, broken out in separate file so it can be override in Sierra Leone

#### Config-CES

Programs

* programs.csv – custom set of programs for CES

Program Workflows

* programworkflows.csv – no workflows in CES, so this is an empty file to override the one defined in config-pihemr

Program Workflow States

* programworkflowstates.csv – no workflows, so no states, in CES, so another empty file to override on defined in config-pihemr
* pregnancy.csv – no workflows, so no states, in CES, so another empty file to override on defined in config-pihemr

#### Config-Sierra Leone

Programs

* no files (just uses standard programs from config-pihemr)

Program Workflows

* ncd.csv - program workflow for NCD program, only used in Sierra Leone (NCD program defined in top-level config has no workflows)

Program Workflow States

* ncd.csv - program states for custom SL workflow for NCD program
* pregnancy.csv - pregnancy states for main Pregnancy workflow in SL, overriding those defined in config-pihemr

#### Config-Haiti

Programs

* no files (just uses standard programs from config-pihemr)

Program Workflows

* zlmch.csv - program workflow for MCH program, only used in Haiti (MCH program defined in top-level config has no workflows)
* zlncd.csv - program workflow for NCD program, only used in Haiti (NCD program defined in top-level config has no workflows)

Program Workflow States

* zlmch.csv - program workflow states for MCH program, only used in Haiti (MCH program defined in top-level config has no workflows)
* zlncd.csv - program workflow states for NCD program, only used in Haiti (NCD program defined in top-level config has no workflows

Config-Liberia

Programs

* programsliberia.csv - custom programs for Liberia? Are these supposed to override those in Config-PIHEMR

Program Workflows

* programworkflowsliberia.csv - custom workflows for Liberia? Are these supposed to override those in Config-PIHEMR

Program Workflow States

* programworkflowstatesliberia.csv - custom workflowstates for Liberia? Are these supposed to override those in Config-PIHEMR?


### Reports

SQL-based reports can be added to the "Reports" section of the PIH-EMR by including the SQL file in the "config-pihemr" or a country-specific config, along with a yml file that defines that report.  The YML file should be placed in the content/configuration/backend_configuration/reports/reportdescriptors/dataexports directory of the appropriate config project.

#### Sample YAML file format

```yml
key: "allergiesdataexport"                                              # unique key
uuid: "3b83bbd7-f16a-4df1-9ba8-280c0e4ea977"                            # unique random uuid
name: "mirebalaisreports.allergiesdataexport.name"                      # references message.properties code
description: "mirebalaisreports.allergiesdataexport.description"        # references message.properties code
parameters:                                                             # list of user parameters
  - key: "startDate"
    type: "java.util.Date"                          # datatype of parameter: Date and Location supported    
    label: "reporting.parameter.startDate"          # messages.properties code for label
  - key: "endDate"
    type: "java.util.Date"
    label: "reporting.parameter.endDate"
datasets:
  - key: "allergiesexport"
    type: "sql"                                     # type of report, currently only SQL supported
    config: "sql/allergies.sql"                     # path to SQL file (relative to the yml file)
designs:
  - type: "csv"                                     # type of design, CSV and Excel currently supported
    properties:                                     # any additonal properties
      "characterEncoding": "ISO-8859-1"
      "blacklistRegex": "[^\\p{InBasicLatin}\\p{L}]"
      "dateFormat": "dd-MMM-yyyy HH:mm:ss"
config:
  category: "dataExport"                      # where to display the report, currently only Data Export supported
  order: 90                                   # determines display orders (lower sorted first)                      
  components:                                 # display report if any of these components are enabled
    - "allergies"
    - "allDataExports"
  sites:                                      # limit report to certain sites
    - "MIREBALAIS"

```

There are several further examples of yml files for reports in "content/configuration/backend_configuration/reports/reportdescriptors/dataexport".

#### Global metadata

A set of global variables can be loaded by calling the "initialize_global_metadata" procedure from the report. Look at "global_metadata.sql" to see what variables are defined.

#### Future enhancements

Currently, you can only add reports to the "Data Exports" section of the Reports page, but it should be very simple
to expand to support all reports (see ticket https://pihemr.atlassian.net/browse/UHM-4738)

### SQL Tools

To aid in the writing of SQL for the reports above and other SQL scripts (ETLs etc...), a set of views and functions have been written and are deployed through liquibase:

Views:
[create_views.sql](./content/configuration/backend_configuration/pih/liquibase/sql/create_views.sql)

Functions:
[create_functions.sql](./content/configuration/backend_configuration/pih/liquibase/sql/create_functions.sql)

Documentation for the functions exist here: 
[sql_function_reference.csv](./content/configuration/backend_configuration/pih/liquibase/sql/sql_function_reference.csv)

It is recommended that these are used as much as possible in any SQL scripts.

### Message Properties

Message properties files are used to localize the PIH EMR into different languages.  Currently we support French,
Haitian Kreyol, and Spanish, and there's a separate messages_<lang>.properties files for each within the
content/configuration/backend_configuration/messagesproperties folder.

To add or update translations, edit these files directly. We no longer use Transifex for message codes in
this repo.```

#### Implementation-specific messages code

Implementations can add their own message properties files the content/configuration/backend_configuration/messageproperties directory of
their own config projects, as as long as they are given a unique filename (ie not "messages_<lang>.properties").
so as not to conflict with any of the message files provided by the PIH EMR config.  

If they want to *override* a message file defined in config-pihemr, they can provide a messages file with 
a matching name.  

### Logo

To customize the header logo, you can put a "logo.png" file in "content/configuration/backend_configuration/pih/logo" and it will replace the default PIH "hands" logo.  

See:

https://github.com/PIH/openmrs-config-pihliberia/tree/master/configuration/pih/logo

### Custom JavaScript and CSS

An implementation can add it's own custom JavaScript and CSS by adding JavaScript files to
"content/configuration/backend_configuration/pih/scripts" directory and CSS file to "content/configuration/backend_configuration/pih/styles".  These files
can then be accessed as a "file" resource within application code.

As an example, we currently include the encounterTypeConfig.js this way:

https://github.com/PIH/pihemr/tree/master/content/configuration/backend_configuration/pih/scripts

To reference the file, we do the following:

https://github.com/PIH/openmrs-module-pihcore/blob/master/omod/src/main/webapp/pages/visit/visit.gsp#L41

Note that in the above "includeJavaScript" command we state that this is a "file" resource type and then 
include the path relative to the application data directory.  Note that you need to set the fourth parameter
(pathIsRelativeToScripts) to false or OpenMRS will incorrectly append  "scripts/" to the front of the path you 
specify as the second parameter.

Adding CSS using the "includeCss" function works in a similar way.
 
#### Globally including CSS and JavaScript

Additionally, any JavaScript or CSS files included in the "content/configuration/backend_configuration/pih/scripts/global" and 
"content/configuration/backend_configuration/pih/styles/global" directory will be automatically included by the UI Framework on *all* display pages.
This is a good way to provide a custom style sheet for all UI Framework pages.  The Liberia distribution does
this, for example:
 
https://github.com/PIH/openmrs-config-pihliberia/tree/master/configuration/pih/styles/global


# Concept Management

This is described on the [OpenMRS wiki](https://wiki.openmrs.org/display/docs/Metadata+Server+Management).

### MDS Package Search Tool

You will at some point want to look up whether a concept exists in some or
another package.

To accomplish this you can use the mds search tools. `cd` into `tools/`.
Then run `./update.sh` to unzip all the MDS packages in this repo into `tools/mds/`.
Then use `./find-concept.sh 123` to find the MDS packages
that contain the concept with PIH concept ID `123`. The other `find-concept-`
scripts work similarly. Execute any one of them with no arguments to see usage
info.

The script `find-package-by-name.sh <name>` will show you which of the header.xml and
metadata.xml files (which only have number suffixes) has `<name>` in the name.
Try `find-package-by-name.sh ncd`.

### PIH Concept Managers

There are two people at PIH who are "Concept Managers" in the sense intended below:
- Ellen Ball
- Brandon Istenes

### PIH EMR Concept Management Process

This is a process for defining a new form. The main idea of the process is

1. Identify suitable concepts in the [HUM-CI Concept Dictionary](https://humci.pih-emr.org/mirebalais/dictionary/index.htm) and the CIEL concepts in [mdsbuilder](https://mdsbuilder.openmrs.org/openmrs/).
1. Get the concept onto the [Concept Server](https://concepts.pih-emr.org/openmrs/dictionary/index.htm)
1. Export the concept from the Concept Server and add it to your distribution.

Here's a workflow that breaks that down into concrete steps.

1. Start a requirements spreadsheet based on [this template](https://docs.google.com/spreadsheets/d/1vdY95gN2fuGIMZlHadC4eAa8299RatsenIj06pa8p9E/edit#gid=0) (see, for example, the [CES sheet](https://docs.google.com/spreadsheets/d/1fZEeeEku8YWC-uHEZ0HPsa5NY23m2sWLIIonE7u-sZs/edit#gid=815234747)).
1. Write down your required question/answer/diagnosis in a row in your requirements spreadsheet.
1. Go to the [HUM-CI Concept Dictionary](https://humci.pih-emr.org/mirebalais/dictionary/index.htm) and, for each question/answer/diagnosis/etc, search for a concept that might be appropriate.
    1. If there is a suitable concept in HUM-CI, then it already also exists in the Concept Server. Add the CIEL or PIH mapping to your requirements spreadsheet.
    1. If there is no suitable concept in HUM-CI, search for a suitable CIEL concept in [mdsbuilder](https://mdsbuilder.openmrs.org/openmrs/).
        1. If the concept exists in CIEL, import it following the [method below](https://github.com/PIH/pihemr/#importing-concepts-from-ciel-to-pih-server).
        1. If there is no suitable concept in CIEL, ask a Concept Manager to create it for you. They might also add it to the [CIEL request sheet](https://docs.google.com/spreadsheets/d/1hAJLuKBVwzJEvo3hDp2tRqeRWKMSlxgphK1rc-Nm3IA/edit#gid=0), so that we can eventually give the new concept a CIEL code.
1. Check that a translation of the concept name exists in your implementation’s language. If it doesn't, evaluate whether or not the display name you want for the concept is a direct translation of the English concept name.
    1. If it is, add the display name as the translation for the concept.
    1. If it isn't, translate the English concept name as best you (or a bilingual colleague) can. Instead of adding the display name to the concept, you'll add it to the `messages.properties` file later. Note that this only works for some kinds of concepts (e.g. those referenced directly in an HTML Form) and not others (e.g. diagnoses in the diagnosis list), so you might have to just settle with using the translation of the concept as the display name.
1. Use the MDS Package Search Tool (mds-search), documented above, to find out whether the concept you want is already in an MDS package.
1. If the concept is new or is for some other reason is not yet in an MDS package, you or someone from MedInfo will have to add it to one.
    1. Identify the MDS package it should go in. Ask a Concept Manager if you're not sure.
    1. Each package should correspond to a single concept set, which contains a tree of concept sets and concepts that go into that package. Add your concept to one of the concept sets that goes into that package.
    1. Go to Administration > Export Metadata.
    1. Click on "New Version" next to the package that the concept set you chose is part of.
    1. Check "2. Publish package." Click "Next."
    1. Click "Export."
    1. Download this newly created MDS package.
    1. Open the `pihemr` repository on your computer. Or use `openmrs-config-yoursite` if this MDS package is specific to your site.
    1. Drop the new version of the MDS package into `content/configuration/backend_configuration/pih/concepts`, delete the old one, commit the change and open a PR.
1. Now that you know that the concept is being imported via an MDS package, you can use it in a form (or whatever). Refer to your concept by Reference Term Mapping. If it's not obvious from context or mapping what the concept is, add a comment with the concept's name.
1. Add the display name to the correct `messages.properties` file, with the correct key. They key to use will depend on the context in which the concept is being used. For HTML Form Entry, the key will be something you code into the form.

### Importing Concepts from CIEL to PIH Server

Use Metadata Sharing (mds) to add the concept to the PIH EMR package.

1. Create mds package with select CIEL concepts from [mdsbuilder](https://mdsbuilder.openmrs.org/openmrs/).
1. Download/Export the CIEL mds package.
1. Import the CIEL mds package into the PIH concepts server.
    1. Use "From peer"
    1. Uncheck "dates differ"
    1. Review the matches identified by the importer
1. Add the concepts to one of the PIH EMR mds packages.  Zip file updates should be installed in the "content/configuration/backend_configuration/pih/concepts" directory of this repo.

https://user-images.githubusercontent.com/1031876/135696332-f4023d54-c706-4f27-93b7-7891c41bf78c.mp4

  
### Metadata Sharing (mds)

Currently used for deploying concepts.

New concepts are created using the Concept Dictionary Maintenance UI: [https://concepts.pih-emr.org/openmrs/dictionary/index.htm](https://concepts.pih-emr.org/openmrs/dictionary/index.htm)** (NOTE: Do not add/edit concepts without first consulting Ellen Ball)**

Concepts are bundled into zip files using the Metadata Sharing module in the admin UI.  For transparency of the contents of each mds package, we are improving the packages to include only one ConvSet concepts for each mds.  For example, to add APGAR score to the MCH mds package, APGAR score is added to the "Maternal Child Health concept set".  See [README](https://github.com/PIH/openmrs-module-mirebalaismetadata/blob/master/api/src/main/resources/README.md). 


### Transifex instructions (deprecated)

(Note that we no longer use use Transifex for config-pihemr translations)

Note that the *only* messages properties file that should be edited directly in the code is the source file,
messages_en.properties. For translations we use a third-party translation tool, Transifex (www.transifex).

To provide translations, you need to add new codes to the messages_en.properties file, push them up to Transifex,
do the translations, and then pull down the translations.

##### Installing the Transifex Client

Instructions can be found here:

https://docs.transifex.com/client/installing-the-client

##### Pushing new source codes to Transifex

Add a new code and English translation to the "messages_en.properties" file.

Run the following command from the top-level directory from where you have "pihemr" checked out:

```tx push -s```

You then should see your new message code in Transifex under the "PIH EMR Config" project. You can proceed
to provide translations there.

##### Pulling new translation from Transifex

To pull new translations you've provided to Transifex back into the code, run the following command:

```tx  pull -a```

You can confirm that the changes have been properly pulled into the translation files and then can
commit them using Git.

##### Full Transifex Client document

Can be found here:

https://docs.transifex.com/client/introduction
