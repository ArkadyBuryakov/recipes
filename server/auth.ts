import { apiKey } from "@better-auth/api-key";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, jwt } from "better-auth/plugins";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { env } from "./env";

export const MCP_EDITOR_PATH = "/mcp/editor";
export const MCP_EDITOR_RESOURCE = `${env.PUBLIC_URL}${MCP_EDITOR_PATH}`;
export const API_KEY_PREFIX = "rcp_";

export const auth = betterAuth({
  baseURL: env.PUBLIC_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Invite-only (ADR 0006): accounts are created through invites, never public sign-up.
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  disabledPaths: ["/token"],
  rateLimit: { enabled: env.AUTH_RATE_LIMIT ?? env.NODE_ENV === "production", storage: "database" },
  advanced: { database: { generateId: "uuid" } },
  plugins: [
    admin({ defaultRole: "editor", adminRoles: ["admin"] }),
    apiKey({ defaultPrefix: API_KEY_PREFIX, enableMetadata: true }),
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: MCP_EDITOR_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access"],
      // DCR keeps older MCP clients (Claude Code, Cursor, claude.ai connectors) working.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
    }),
  ],
});

export type Auth = typeof auth;
export type SessionUser = typeof auth.$Infer.Session.user;
