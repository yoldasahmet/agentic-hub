#!/usr/bin/env node
// Workspace packages ship TypeScript source, so the CLI runs it through tsx.
// Node resolves this file's real path, so a symlink in PATH (P12.4) works.
import { register } from "tsx/esm/api";

register();
await import("../src/main.ts");
