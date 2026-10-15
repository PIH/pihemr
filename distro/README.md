# PIH EMR Distribution

This module defines the base PIH EMR OpenMRS distribution — a specific OpenMRS war, module set, and OWA set — using the [OpenMRS SDK Maven plugin](https://wiki.openmrs.org/display/docs/OpenMRS+SDK). It's published as `org.pih.openmrs:pihemr-distro` and consumed as the parent distro by every country-specific `xxx-emr` repo (`lesotho-emr`, `ces-emr`, `pihsl-emr`, `pihliberia-emr`, `zl-emr`), each of which layers its own content and frontend on top at its own distro-assembly time.

## How it works

Component versions come from the [`pihcore`](https://github.com/PIH/openmrs-module-pihcore) parent module's own version properties (this repo's `pom.xml` only defines its own `pihcoreVersion`/`appShellVersion`/`frontendDir`/`sdkVersion` properties). During the Maven build (`mvn clean package`), these inherited properties are interpolated into `openmrs-distro.properties`, and the `openmrs-sdk-maven-plugin`'s `build-distro` goal resolves the resulting war/module/OWA set into `target/distro/`. Only the resulting jar (containing the resolved `openmrs-distro.properties`) is published — there's no bundled zip artifact.

Unlike a country-specific distro (e.g. `lesotho-distro`), this module has no parent distro or content/frontend of its own to layer — it's the root of that chain, so it doesn't declare any `content.*`/`spa.*` entries in `openmrs-distro.properties`.

## Updating component versions

Since `omod.*`/`war.openmrs` versions are inherited from the `pihcore` parent rather than declared here, updating them means bumping the `pihcore` parent's own version (in the [`openmrs-module-pihcore`](https://github.com/PIH/openmrs-module-pihcore) repo), then rebuilding here:

```bash
mvn clean package
```

Note that this repo's scheduled `update-versions.yml` workflow (which runs `mvn versions:update-properties`) only updates properties backing dependencies declared in this repo's own `pom.xml` — since neither `content/` nor `distro/` declares any dependencies, that workflow is a no-op here and has no effect on module/omod versions.

## Release

Releases follow semantic versioning and run via the `release-to-sonatype.yml` GitHub Actions workflow (a thin caller into `openmrs-contrib-distro-tools`'s reusable `release-to-sonatype.yml`), which runs `mvn release:prepare release:perform -Prelease` across the whole reactor (`content/` + `distro/`) from the root `pom.xml`.
