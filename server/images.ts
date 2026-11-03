import { randomUUID } from "node:crypto";
import { S3Client } from "bun";
import { eq } from "drizzle-orm";
import sharp, { type OutputInfo } from "sharp";
import type { Db } from "./db/client";
import { images } from "./db/schema";
import { env } from "./env";
import { DomainError } from "./errors";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 2000;

export interface ImageStore {
  put(key: string, bytes: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<{ bytes: ArrayBuffer; type: string } | null>;
}

/** Hetzner Object Storage (S3-compatible), private bucket; images are served through the app (ADR 0012). */
export class S3ImageStore implements ImageStore {
  private readonly client: S3Client;

  constructor() {
    if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY)
      throw new DomainError("validation", "Image storage is not configured (S3_* env vars)");
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    });
  }

  async put(key: string, bytes: Uint8Array, type: string) {
    await this.client.write(key, bytes, { type });
  }

  async get(key: string) {
    const file = this.client.file(key);
    if (!(await file.exists())) return null;
    return { bytes: await file.arrayBuffer(), type: file.type || "image/webp" };
  }
}

/** Local/test fallback when S3 is not configured. */
export class MemoryImageStore implements ImageStore {
  private readonly items = new Map<string, { bytes: ArrayBuffer; type: string }>();
  async put(key: string, bytes: Uint8Array, type: string) {
    this.items.set(key, { bytes: bytes.slice().buffer, type });
  }
  async get(key: string) {
    return this.items.get(key) ?? null;
  }
}

export function createImageStore(): ImageStore {
  return env.S3_ENDPOINT ? new S3ImageStore() : new MemoryImageStore();
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd]|\[?fe80)/i;

export class ImageService {
  constructor(
    private readonly db: Db,
    private readonly store: ImageStore,
  ) {}

  /** Re-encode to WebP (max 2000px edge, EXIF stripped) and store; returns the image key. */
  async upload(
    input: Uint8Array,
    userId: string | null,
  ): Promise<{ imageKey: string; width: number; height: number }> {
    if (input.byteLength > MAX_IMAGE_BYTES) throw new DomainError("validation", "Image is larger than 10 MB");
    let out: { data: Buffer; info: OutputInfo };
    try {
      out = await sharp(input)
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new DomainError("validation", "Not a supported image");
    }
    const key = `img/${randomUUID()}.webp`;
    await this.store.put(key, out.data, "image/webp");
    await this.db.insert(images).values({
      key,
      mime: "image/webp",
      width: out.info.width,
      height: out.info.height,
      bytes: out.info.size,
      createdBy: userId,
    });
    return { imageKey: key, width: out.info.width, height: out.info.height };
  }

  async uploadFromUrl(url: string, userId: string | null) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new DomainError("validation", "Invalid image url");
    }
    if (!/^https?:$/.test(parsed.protocol) || PRIVATE_HOST.test(parsed.hostname))
      throw new DomainError("validation", "Image url must be a public http(s) url");
    const res = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new DomainError("validation", `Could not download image (HTTP ${res.status})`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES) throw new DomainError("validation", "Image is larger than 10 MB");
    return this.upload(new Uint8Array(await res.arrayBuffer()), userId);
  }

  async get(key: string) {
    const [row] = await this.db.select().from(images).where(eq(images.key, key));
    if (!row) return null;
    return this.store.get(key);
  }
}
