import type { GithubConnection } from "../auth/connection";
import type { GitAuth } from "../local/git";

/** The token git sends to the GitHub host, if one is configured. */
export async function gitAuth(conn: GithubConnection, host: string): Promise<GitAuth | undefined> {
  const found = await conn.token();
  return found ? { token: found.token, host } : undefined;
}
