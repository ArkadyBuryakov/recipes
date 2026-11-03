import { z } from "zod";

const DEV_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(3000),
    PUBLIC_URL: z
      .url()
      .default("http://localhost:3000")
      .transform((v) => v.replace(/\/$/, "")),
    DATABASE_URL: z.string().default("postgres://recipes:recipes@localhost:5432/recipes"),
    BETTER_AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    ADMIN_NAME: z.string().default("Admin"),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default("nbg1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.BETTER_AUTH_SECRET !== DEV_SECRET, {
    message: "BETTER_AUTH_SECRET must be set in production",
    path: ["BETTER_AUTH_SECRET"],
  });

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
