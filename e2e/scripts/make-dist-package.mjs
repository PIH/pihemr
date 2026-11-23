// Turns dist/ (the output of `tsc -p tsconfig.build.json`) into the package to publish: a package.json that points at the compiled files, and the README.
// `npm pack dist` / `npm publish dist` then publish exactly this folder.
import { copyFileSync, cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const version = process.env.PIHEMR_E2E_VERSION || source.version;

const published = {
  name: source.name,
  version,
  description: source.description,
  license: source.license,
  repository: source.repository,
  publishConfig: { access: 'public' },
  main: 'src/index.js',
  types: 'src/index.d.ts',
  // The consumer's own copy of Playwright is the one the compiled specs and fixtures use.
  peerDependencies: source.peerDependencies,
};
writeFileSync(new URL('../dist/package.json', import.meta.url), JSON.stringify(published, null, 2) + '\n');
copyFileSync(new URL('../README.md', import.meta.url), new URL('../dist/README.md', import.meta.url));

// The source maps say where each compiled file came from. tsc writes the path of the original, `e2e/src/...`, which is above the package once dist/ is the
// package, so a test in the VS Code extension (or a stack trace) would point at a file that does not exist. The sources are shipped in `source/`, and the maps
// point there: a click on a test opens its .ts in node_modules/@pih/pihemr-e2e/source/. (The compiled files stay in `src/`, where the distros' imports expect them.)
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sourceDir = join(dist, 'source');
cpSync(fileURLToPath(new URL('../src/', import.meta.url)), sourceDir, { recursive: true });
const maps = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) {
      return maps(file);
    }
    return name.endsWith('.js.map') ? [file] : [];
  });
for (const mapFile of maps(join(dist, 'src'))) {
  const map = JSON.parse(readFileSync(mapFile, 'utf-8'));
  const original = join(sourceDir, relative(join(dist, 'src'), mapFile).replace(/\.js\.map$/, '.ts'));
  map.sources = [relative(dirname(mapFile), original).split('\\').join('/')];
  writeFileSync(mapFile, JSON.stringify(map));
}

console.log(`dist/package.json: ${published.name}@${published.version}`);
