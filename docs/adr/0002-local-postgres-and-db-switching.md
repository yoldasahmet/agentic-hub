# ADR 0002: Local Postgres service and database switching

- **Status:** accepted (Phase 3, 2026-10-10)
- **Relates to:** D5 (Postgres as a local service), D8 (vault), D11 (leases), P3.1–P3.6
- **Amended by:** ADR 0003 (Core holds the pool, migrations, and bootstrap)

## Context

D5 asks for bundled Postgres binaries managed by the app, with no Docker,
and an optional remote team DB. Core (Phase 4) doesn't exist yet, but P3.4
and P3.5 need migrations and a switch that "restarts Core".

## Decision

1. **Binaries.** `packages/local-postgres` uses the per-platform npm
   packages `@embedded-postgres/<os>-<arch>` (optional dependencies, only
   for their binaries) and owns the lifecycle itself: `initdb` (scram auth,
   UTF8, C locale) into `<userData>/postgres/data`, then `postgres` on a
   free `127.0.0.1` port with the Unix socket turned off. A packaged app
   passes `binDir` from its resources (P18.2). `AGENTIC_PG_BIN_DIR`
   overrides both. pnpm hoists these packages so the bundled main process
   can resolve them.
2. **Crash recovery.** If the app died and left its Postgres running,
   start sends that orphan a fast shutdown first. It only does so after
   checking that the pid in `postmaster.pid` is a `postgres` process.
3. **Credentials.** The local superuser password is generated once and kept
   in the vault (`database.local-password`). The remote connection string is
   also kept there (`database.remote-url`). Both are *managed* secrets: they
   appear on the Secrets page but can only be changed in Settings → Database.
   Non-secret settings (mode, TLS mode) go in `<userData>/database.json`,
   because they must be known before any database connection exists.
4. **TLS** comes only from the UI setting (`verify-full` by default,
   `require`, or `disable`). `sslmode` and related parameters are removed
   from the URL, so the URL can't quietly override the setting.
5. **Migrations.** drizzle-kit generates SQL into `packages/db/drizzle`.
   `migrateDatabase` applies it while holding a session advisory lock, so
   app instances sharing a team DB never migrate at the same time.
   Bootstrap holds a transaction advisory lock and is idempotent.
6. **Host until Core.** Until P4.2, main's `DatabaseSupervisor` opens the
   pool, migrates, and bootstraps. A switch tests the target first, so a bad
   URL never replaces a working setup. It then saves the settings and
   reconnects. In P4.2 Core takes over the pool, and a switch restarts Core.
   Main keeps the local service and the settings. (Done in Phase 4; see
   ADR 0003.)

## Consequences

- No Docker anywhere. The Linux dev binaries make the container testable.
- Postgres refuses to run as root, so container smoke tests run as an
  unprivileged user.
- Data isn't migrated between local and remote. Export/import bundles
  (P6.8) move agents and workflows.
