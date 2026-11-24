# ADR 0016: macOS packaging and release

- **Status:** accepted (Phase 18, 2026-10-12)
- **Relates to:** D1 (electron-builder after all features), D5 (bundled Postgres), D8, ADR 0002, ADR 0011, ADR 0014, P18.1–P18.7
- **Amends:** ADR 0011 (the packaged CLI runs on the user's Node)

## Context

Phase 18 turns the dev app into a downloadable macOS app: one build per
arch, the Postgres binaries inside, the `agentic` CLI inside, the Electron
fuses from the security review (ADR 0014), signing and notarization, and
updates. The repo is a pnpm workspace whose packages ship TypeScript
source, the Postgres binary package has no `pg_dump`, and the repo is
private.

## Decision

1. **electron-builder** (`apps/desktop/electron-builder.yml`): dmg + zip
   for arm64 and x64, built on one macOS runner. electron-vite bundles
   main, Core, preload, and the renderer, so `app.asar` holds `out/` and
   only the externals in `dependencies` (electron-updater, node-pty, ws,
   zod). Everything bundled is a `devDependency`, which keeps pnpm's
   workspace links out of the archive.
2. **No native rebuild.** node-pty ships N-API prebuilds for both Mac
   archs, so `npmRebuild: false`; its folder is unpacked from the archive.
3. **Fuses:** RunAsNode, `NODE_OPTIONS`, and `--inspect` off; cookie
   encryption, embedded ASAR integrity, and only-load-from-ASAR on. The
   file:// privileges fuse stays on because the renderer loads from
   file://.
4. **Postgres per arch** goes to `Resources/postgres` from
   `@embedded-postgres/darwin-<arch>` (`extraResources`, headers and
   static libs filtered out). The release job installs both archs'
   packages with pnpm `supportedArchitectures`.
5. **Local backups are offline snapshots.** Without `pg_dump`, Settings →
   Database → Back up stops Core and Postgres, tars and gzips the cluster
   (minus `postmaster.pid`), and restarts. Restore checks the archive and
   the Postgres major version, resets the superuser password to this
   vault's (single-user mode, password on stdin), keeps the old cluster
   at `postgres/data.before-restore`, and rolls back if the restored
   cluster doesn't start. Moving data to a team DB stays export/import.
6. **The CLI is an esbuild bundle** (`Resources/cli/agentic.mjs`, one
   file with every workspace package, plus `migrations/`), started by a
   small CommonJS launcher that checks for Node 22+. It runs on the
   user's Node: the RunAsNode fuse rules out running it on Electron's.
7. **Signing and notarization** are configuration only: hardened runtime
   with JIT entitlements, and electron-builder's signing and `notarytool`
   when the certificate and App Store Connect API key secrets exist.
   Without them the build is unsigned.
8. **Releases** come from a tag `vX.Y.Z`: `scripts/release.mjs` keeps the
   app and CLI versions and `CHANGELOG.md` in step, and the workflow
   uploads to a **draft** GitHub Release that the owner publishes.
   `RELEASES_REPO` can point publishing (and the app's update feed) at a
   public repo while this one is private.
9. **Updates:** electron-updater checks the GitHub feed at launch and
   every six hours, downloads in the background, and installs on quit;
   the app menu has "Check for Updates…". Packaged macOS builds only.
10. **First-run setup** is a `/welcome` route (database, providers,
    GitHub/Jira, starter workflows), shown on launch until finished or
    skipped, and reachable from Settings → General.

## Consequences

- A build-only package added to `dependencies` would be shipped; the CI
  `package` job's smoke check fails if electron, React, Vite, or a
  workspace package shows up in `app.asar`.
- The packaged CLI needs Node 22+ on the user's PATH; the install dialog
  and `agentic doctor` say so.
- A backup or restore pauses the app's database for a few seconds; runs
  resume from their checkpoints (ADR 0003).
- Until the owner adds the Apple secrets, releases are unsigned, open
  only via right-click → Open, and can't auto-update (Squirrel.Mac needs
  a signature). `docs/release.md` lists the setup.
