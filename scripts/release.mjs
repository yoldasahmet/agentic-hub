// Release helper (P18.5, docs/release.md). The app and the CLI share one
// semver version; CHANGELOG.md keeps "## [Unreleased]" on top.
//   node scripts/release.mjs version 0.2.0  sets both versions, dates the changelog
//   node scripts/release.mjs check v0.2.0   CI: the tag matches versions + changelog
//   node scripts/release.mjs notes 0.2.0    prints that version's changelog section
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const packages = ["apps/desktop/package.json", "apps/cli/package.json"];
const changelogUrl = new URL("CHANGELOG.md", root);
const semver = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const changelog = () => readFileSync(changelogUrl, "utf8");

/** The body under `## [<version>]`, up to the next `## [`. */
function section(text, version) {
  const start = text.indexOf(`## [${version}]`);
  if (start === -1) return undefined;
  const bodyStart = text.indexOf("\n", start) + 1;
  const next = text.indexOf("\n## [", bodyStart);
  return text.slice(bodyStart, next === -1 ? undefined : next).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, arg = ""] = process.argv.slice(2);
const version = arg.replace(/^v/, "");
if (!semver.test(version)) fail(`Expected a semver version, got "${arg}".`);

if (command === "version") {
  for (const path of packages) {
    const pkg = readJson(path);
    pkg.version = version;
    writeFileSync(new URL(path, root), `${JSON.stringify(pkg, null, 2)}\n`);
  }
  const text = changelog();
  if (section(text, version) === undefined) {
    if (!(section(text, "Unreleased") ?? "")) fail("CHANGELOG.md has nothing under [Unreleased].");
    const day = new Date().toISOString().slice(0, 10);
    writeFileSync(
      changelogUrl,
      text.replace("## [Unreleased]", `## [Unreleased]\n\n## [${version}] - ${day}`),
    );
  }
  console.log(`Version ${version}. Commit, then tag v${version} on main and push the tag.`);
} else if (command === "check") {
  for (const path of packages) {
    const found = readJson(path).version;
    if (found !== version) fail(`${path} is ${found}, but the tag is v${version}.`);
  }
  if (!section(changelog(), version)) fail(`CHANGELOG.md has no entries for [${version}].`);
  console.log(`v${version} matches the package versions and CHANGELOG.md.`);
} else if (command === "notes") {
  const notes = section(changelog(), version);
  if (!notes) fail(`CHANGELOG.md has no entries for [${version}].`);
  console.log(notes);
} else {
  fail("Usage: node scripts/release.mjs <version|check|notes> <x.y.z>");
}
