# ADR 0001: Desktop IPC envelope and write-only secrets

- **Status:** accepted (Phase 2, 2026-10-10)
- **Relates to:** D8 (secrets vault), D9 (transport), P2.3, P2.8

## Context

The renderer reaches native code only through the preload bridge. P2.8
asks for IPC to "read and write" secrets, while AGENTS.md says secrets
never appear in the UI.

## Decision

1. **One contract map.** `packages/contracts/src/ipc/` declares every
   channel (`ipcChannels`) and main → renderer event (`ipcEvents`) as Zod
   schemas. The preload allows only these names. Main checks the sender
   frame, then parses input and output. The renderer parses replies too.
2. **Errors as data.** Handlers return `{ ok: true, data } | { ok: false,
   error: AppErrorShape }`, because Electron drops custom error fields when
   it serializes thrown errors.
3. **Secrets are write-only from the renderer.** "Read" means listing names
   and `updatedAt`. Set, replace, and delete take values. Plaintext is
   decrypted only in main (`Vault.get`), which hands it to Core and the
   providers in later phases.
4. **Storage:** `userData/vault.json` (mode `0600`, atomic writes) holds
   names in clear and values encrypted with `safeStorage` (the Keychain on
   macOS). Packaged builds refuse weak backends. Dev builds on Linux without
   a keyring opt in to Electron's plain-text fallback, so CI and cloud
   containers can run the app.

## Consequences

- Adding a channel means editing the contract and `register-handlers.ts`.
  Nothing else changes.
- The Settings page cannot show a stored value. Users replace it instead.
