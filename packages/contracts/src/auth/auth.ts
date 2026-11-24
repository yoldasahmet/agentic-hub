import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../ids";

/**
 * The header that carries a signed-in session. It travels next to the
 * per-launch `Authorization` token, which still guards the transport (D9).
 * WebSockets pass it as the `session` query parameter.
 */
export const SESSION_HEADER = "x-agentic-session";

/** `ags_` + 256 random bits, base64url. The prefix lets log redaction spot it. */
export const sessionTokenSchema = z.string().regex(/^ags_[A-Za-z0-9_-]{43}$/);

export const workspaceRoleSchema = z.enum(["owner", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

/** Where a session was created; shown to members, never trusted for access. */
export const authClientSchema = z.enum(["desktop", "cli"]);
export type AuthClient = z.infer<typeof authClientSchema>;

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Length is what matters (NIST 800-63B); no composition rules. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(256, "Use at most 256 characters");

export const signUpInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100),
  client: authClientSchema.default("desktop"),
});
export type SignUpInput = z.input<typeof signUpInputSchema>;

/** Sign-in only checks the shape; a weak old password still signs in. */
export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  client: authClientSchema.default("desktop"),
});
export type SignInInput = z.input<typeof signInInputSchema>;

/** `local` is the account the app bootstraps; `password` has signed up. */
export const authUserSchema = z.object({
  id: idSchema,
  kind: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authWorkspaceSchema = z.object({ id: idSchema, name: z.string() });
export type AuthWorkspace = z.infer<typeof authWorkspaceSchema>;

/** Returned by sign-up and sign-in. The token is shown once; Core keeps a hash. */
export const authSessionSchema = z.object({
  token: sessionTokenSchema,
  expiresAt: isoDateTimeSchema,
  user: authUserSchema,
  workspace: authWorkspaceSchema,
  role: workspaceRoleSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/**
 * `GET /auth/status`. `user` is null when nobody is signed in and auto
 * sign-in does not apply; the UI then shows the sign-in screen.
 * `autoSignInAvailable` is true on the local DB only; a team DB always
 * needs a sign-in. `hasAccounts` picks sign-up vs sign-in as the default.
 */
export const authStatusSchema = z.object({
  dbMode: z.enum(["local", "remote"]),
  autoSignInAvailable: z.boolean(),
  autoSignIn: z.boolean(),
  hasAccounts: z.boolean(),
  user: authUserSchema.nullable(),
  workspace: authWorkspaceSchema.nullable(),
  role: workspaceRoleSchema.nullable(),
  /** False when the user came in through auto sign-in rather than a session. */
  signedIn: z.boolean(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

export const workspaceMemberSchema = z.object({
  user: authUserSchema,
  role: workspaceRoleSchema,
  joinedAt: isoDateTimeSchema,
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const authSettingsInputSchema = z.object({ autoSignIn: z.boolean() });
export type AuthSettingsInput = z.infer<typeof authSettingsInputSchema>;

export const memberRoleInputSchema = z.object({ role: workspaceRoleSchema });
export type MemberRoleInput = z.infer<typeof memberRoleInputSchema>;
