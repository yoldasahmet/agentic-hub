# Releasing the macOS app

How Agentic Hub is packaged, signed, released, and updated (Phase 18).

## Pieces

| What | Where |
| --- | --- |
| Packaging config (targets, fuses, resources, publish) | `apps/desktop/electron-builder.yml` |
| Icon (source + 1024 px PNG) | `apps/desktop/build/icon.svg`, `icon.png` |
| Hardened runtime entitlements | `apps/desktop/build/entitlements.mac.plist` |
| Bundled CLI (`Resources/cli/agentic`) | `apps/cli/scripts/bundle.mjs` |
| Bundled Postgres (`Resources/postgres`) | `@embedded-postgres/darwin-<arch>` via `extraResources` |
| Smoke check of a packaged app | `apps/desktop/scripts/check-package.mjs` |
| Versions, tag check, release notes | `scripts/release.mjs`, `CHANGELOG.md` |
| CI release | `.github/workflows/release.yml` |
| Auto-update | `apps/desktop/src/main/updater.ts` (electron-updater) |

## Build locally

```bash
pnpm install
pnpm --filter @agentic/desktop package --mac --arm64 --publish never   # on a Mac
node apps/desktop/scripts/check-package.mjs "apps/desktop/release/mac-arm64/Agentic Hub.app"
```

`package` bundles the CLI, runs `electron-vite build`, then electron-builder.
Without signing secrets the app is unsigned: open it with right-click →
Open the first time. To build both archs on one Mac, install the other
arch's Postgres package first (the release workflow does this):

```bash
printf '\nsupportedArchitectures:\n  os: [current]\n  cpu: [arm64, x64]\n' >> pnpm-workspace.yaml
pnpm install && git checkout pnpm-workspace.yaml
```

On Linux, `--linux dir` builds an unpacked app that the smoke check accepts.
It's for checking the pipeline only; Linux isn't a release target.

What the packaged app contains:

- `app.asar`: the electron-vite output (`out/`) and only the runtime
  `dependencies` of `apps/desktop/package.json` (`electron-updater`,
  `node-pty`, `ws`, `zod`). Everything else is bundled at build time, so
  keep build-only packages in `devDependencies`.
- `app.asar.unpacked/node_modules/node-pty`: its N-API prebuilds for both
  Mac archs (nothing is rebuilt; `npmRebuild: false`).
- `Resources/postgres/{bin,lib,share}`: initdb, pg_ctl, postgres.
- `Resources/cli`: `agentic` (a launcher), `agentic.mjs`, `migrations/`.
  It runs on the user's Node 22+, because the RunAsNode fuse is off.
- Fuses: RunAsNode, `NODE_OPTIONS`, and `--inspect` off; cookie
  encryption, ASAR integrity, and only-load-from-ASAR on.

## Release a version

1. Add what changed under `## [Unreleased]` in `CHANGELOG.md`.
2. `node scripts/release.mjs version 0.2.0` sets the app and CLI versions
   and moves the Unreleased notes under `## [0.2.0] - <date>`.
3. Commit, push to `main`, wait for CI to pass.
4. `git tag v0.2.0 && git push origin v0.2.0`.
5. The **Release** workflow checks the tag against the versions and the
   changelog, builds dmg + zip for arm64 and x64, signs and notarizes
   them (when the secrets below exist), smoke-checks the arm64 app, and
   uploads everything with `latest-mac.yml` to a **draft** release.
6. Review the draft on GitHub and press **Publish release**. Installed
   apps pick it up within six hours, or at once from Agentic Hub → Check for
   Updates…

Run the workflow by hand (Actions → Release → Run workflow) for a dry
run. It builds the installers, smoke-checks the app and keeps the
installers as workflow artifacts for a week.

## Signing and notarization setup (owner, once)

These need the owner's Apple Developer account. Until they're done, P18.3
is blocked and releases are unsigned. Unsigned apps can't auto-update:
Squirrel.Mac only installs signed updates.

1. **Apple Developer Program** membership for the team that ships the app.
2. **Developer ID Application certificate.** On a Mac: Xcode → Settings →
   Accounts → Manage Certificates → + → *Developer ID Application* (or
   create it at developer.apple.com → Certificates). In Keychain Access,
   export the certificate **with its private key** as a `.p12` with a
   strong password.
3. **App Store Connect API key** for `notarytool`: App Store Connect →
   Users and Access → Integrations → App Store Connect API → Team Keys →
   + with the **Developer** role. Download the `.p8` (only once) and note
   the **Key ID** and the **Issuer ID** at the top of the page.
4. **GitHub secrets** (repo → Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `MAC_CERTIFICATE_P12_BASE64` | `base64 -i DeveloperID.p12 \| pbcopy` |
   | `MAC_CERTIFICATE_PASSWORD` | the `.p12` export password |
   | `APPLE_API_KEY_P8_BASE64` | `base64 -i AuthKey_XXXXXXXXXX.p8 \| pbcopy` |
   | `APPLE_API_KEY_ID` | the key's Key ID (10 characters) |
   | `APPLE_API_ISSUER` | the Issuer ID (a UUID) |

5. Run the workflow by hand and check the log: electron-builder prints
   `signing … identityName=Developer ID Application: …` and
   `notarization successful`. On a Mac, check the downloaded app:

   ```bash
   codesign --verify --deep --strict --verbose=2 "Agentic Hub.app"
   spctl --assess --type execute --verbose "Agentic Hub.app"   # "source=Notarized Developer ID"
   xcrun stapler validate "Agentic Hub.app"
   ```

electron-builder signs every Mach-O file in the bundle with the hardened
runtime and `build/entitlements.mac.plist`: the app, its helpers, node-pty,
and the bundled Postgres binaries and libraries. If a Postgres library
fails library validation at runtime, add
`com.apple.security.cs.disable-library-validation` to the entitlements.

## Where releases are published

The release workflow targets the GitHub repository that runs it. A local
build has no update feed. Draft releases become available to the updater
after publication, and the updater reads them without a token.

For a separate public release repository, set the repository variable
`RELEASES_REPO` to the full `owner/name` and create the secret
`RELEASES_TOKEN` with **Contents: Read and write** access to that
repository. The release build writes that destination into
`Contents/Resources/app-update.yml`.

When moving the project to a new GitHub account, build a dry run in the
destination repository and check its update feed before publishing. Use
the new account's release and signing credentials. macOS builds use the
bundle ID `org.agentichub.desktop`.

## Version rules

- One version for the app and the CLI (`apps/desktop`, `apps/cli`).
- Semver: a **major** for changes that need the user to act (a migration
  that can't run on an older shared DB, a removed CLI command), a
  **minor** for features, a **patch** for fixes.
- Every team DB member should run the same minor version: migrations run
  on start and older apps don't know newer tables.
