import { and, eq, lte, sql } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";
import type { Db } from "./db/client";
import { pushTimers } from "./db/schema";
import { env } from "./env";
import { DomainError, formatIssues } from "./errors";

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled)
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY ?? "", env.VAPID_PRIVATE_KEY ?? "");

const MAX_AHEAD_MS = 14 * 24 * 3600 * 1000;
const MAX_PER_DEVICE = 30;

export const timerInputSchema = z.strictObject({
  id: z.uuid(),
  subscription: z.object({
    endpoint: z.url().refine((u) => u.startsWith("https://"), "push endpoint must be https"),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  endsAt: z.number().int(),
  title: z.string().trim().min(1).max(120),
  url: z.string().startsWith("/").max(300).optional(),
});

/** Kitchen timers delivered by Web Push when the phone is locked (ADR 0010). Anonymous, keyed by device endpoint. */
export class PushService {
  constructor(private readonly db: Db) {}

  async schedule(input: unknown) {
    const parsed = timerInputSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("validation", "Invalid timer", formatIssues(parsed.error));
    const t = parsed.data;
    const now = Date.now();
    if (t.endsAt < now - 5000 || t.endsAt > now + MAX_AHEAD_MS)
      throw new DomainError("validation", "Timer end is out of range");
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushTimers)
      .where(eq(pushTimers.endpoint, t.subscription.endpoint));
    if (n >= MAX_PER_DEVICE) throw new DomainError("validation", "Too many timers for this device");
    const values = {
      endpoint: t.subscription.endpoint,
      subscription: t.subscription as PushSubscriptionJSON,
      endsAt: new Date(t.endsAt),
      title: t.title,
      url: t.url ?? null,
    };
    await this.db
      .insert(pushTimers)
      .values({ id: t.id, ...values })
      .onConflictDoUpdate({ target: pushTimers.id, set: values });
  }

  async cancel(id: string) {
    if (!z.uuid().safeParse(id).success) return;
    await this.db.delete(pushTimers).where(eq(pushTimers.id, id));
  }

  /** Claims due timers (delete-returning, so each fires once) and sends them. */
  async sendDue(send: (sub: PushSubscriptionJSON, payload: string) => Promise<unknown> = defaultSend) {
    const due = await this.db.delete(pushTimers).where(lte(pushTimers.endsAt, new Date())).returning();
    for (const t of due) {
      const payload = JSON.stringify({ title: t.title, body: t.body, url: t.url, tag: t.id });
      try {
        await send(t.subscription, payload);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser dropped the subscription: forget every timer for it.
        if (status === 404 || status === 410)
          await this.db.delete(pushTimers).where(and(eq(pushTimers.endpoint, t.endpoint)));
        else console.error("push failed", status ?? e);
      }
    }
    return due.length;
  }

  start(intervalMs = 1000) {
    if (!pushEnabled) return () => {};
    let running = false;
    const id = setInterval(async () => {
      if (running) return;
      running = true;
      await this.sendDue()
        .catch((e) => console.error("push scheduler", e))
        .finally(() => {
          running = false;
        });
    }, intervalMs);
    return () => clearInterval(id);
  }
}

function defaultSend(sub: PushSubscriptionJSON, payload: string) {
  return webpush.sendNotification(sub as webpush.PushSubscription, payload, { TTL: 600, urgency: "high" });
}
