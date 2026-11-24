import type { LogSearch } from "../routes/settings/logs/search";

type Navigate = (to: string, search?: Record<string, string | undefined>) => void;

let navigateImpl: Navigate | undefined;

/** router.tsx registers navigation here, so plain modules (toasts) can link without an import cycle. */
export function registerNavigate(navigate: Navigate): void {
  navigateImpl = navigate;
}

export const openLogs = (search: LogSearch = {}) => navigateImpl?.("/settings/logs", search);
export const openDatabaseSettings = () => navigateImpl?.("/settings/database");
