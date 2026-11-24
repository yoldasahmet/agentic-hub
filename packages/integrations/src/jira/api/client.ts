import { AppError } from "@agentic/contracts";
import type { z } from "zod";
import { jiraError } from "./errors";

export type JiraApiOptions = {
  siteUrl: string;
  email: string;
  token: string;
  userAgent: string;
};

type Request<T extends z.ZodType> = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  schema: T;
};

/** 429 and 503 wait when Jira says how long (up to a minute), twice at most. */
const MAX_WAIT_S = 60;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Jira Cloud REST v3 over fetch with basic auth (email + API token).
 * Responses are validated with the caller's Zod schema; rate limits back off.
 */
export class JiraApi {
  private readonly auth: string;

  constructor(private readonly options: JiraApiOptions) {
    this.auth = `Basic ${Buffer.from(`${options.email}:${options.token}`).toString("base64")}`;
  }

  get siteUrl(): string {
    return this.options.siteUrl;
  }

  /** The browser address of an issue. */
  browseUrl(key: string): string {
    return `${this.options.siteUrl}/browse/${key}`;
  }

  async request<T extends z.ZodType>(path: string, req: Request<T>): Promise<z.infer<T>> {
    const url = new URL(`${this.options.siteUrl}/rest/api/3${path}`);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await this.send(url, req.method ?? "GET", req.body);
    const text = await res.text();
    const body: unknown = text ? safeJson(text) : null;
    if (!res.ok) throw jiraError(res.status, body);
    const parsed = req.schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("jira.failed", `Jira: unexpected response from ${path}`);
    }
    return parsed.data;
  }

  private async send(url: URL, method: string, body: unknown): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            authorization: this.auth,
            accept: "application/json",
            "user-agent": this.options.userAgent,
            ...(body === undefined ? {} : { "content-type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new AppError("unavailable", `Jira: can't reach ${url.host} (${reason})`);
      }
      const wait = retryAfter(res);
      if (wait === undefined || attempt >= MAX_RETRIES) return res;
      await res.body?.cancel();
      await sleep(wait * 1000);
    }
  }
}

/** Seconds to wait before retrying, or undefined when the response shouldn't be retried. */
function retryAfter(res: Response): number | undefined {
  if (res.status !== 429 && res.status !== 503) return undefined;
  const header = Number(res.headers.get("retry-after") ?? "5");
  const seconds = Number.isFinite(header) && header >= 0 ? header : 5;
  return seconds <= MAX_WAIT_S ? seconds : undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
