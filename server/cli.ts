import { eq } from "drizzle-orm";
import { createUserWithPassword } from "./bootstrap";
import { db } from "./db/client";
import { user } from "./db/schema";
import { services } from "./services";

const USAGE = `Usage:
  reset-link <email>                       print a one-time password reset link
  create-admin <email> <name> <password>   create an admin account`;

/** Server-side admin commands (ADR 0006), run in the container: bun server.ts cli <command> */
export async function cli(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "reset-link" && rest[0]) {
    const [u] = await db.select().from(user).where(eq(user.email, rest[0].toLowerCase()));
    if (!u) {
      console.error(`No user ${rest[0]}`);
      return 1;
    }
    console.log((await services.links.createReset(u.id, null)).url);
    return 0;
  }
  if (command === "create-admin" && rest.length === 3) {
    const [email = "", name = "", password = ""] = rest;
    await createUserWithPassword(db, { email, name, password, role: "admin" });
    console.log(`Created admin ${email}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}
