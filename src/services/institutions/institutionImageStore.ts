import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { currentEnvironment } from "../../db/environment";

/**
 * Profile photos and covers of institutions live in their own volume (INSTITUTION_IMAGE_DIR), not in
 * the database: the database keeps only `file:<environment>/<sha256>.<ext>`. Files are named by their
 * content, written atomically and served read-only by `/institution-images/...`. The test environment
 * has its own folder, erased when it is reset.
 */
export const IMAGE_REF = /^file:(production|sandbox)\/([a-f0-9]{64}\.(?:png|jpg|webp))$/;
export const IMAGE_NAME = /^[a-f0-9]{64}\.(?:png|jpg|webp)$/;
export const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const EXTENSION: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };

export function imageDir(environment: "production" | "sandbox" = currentEnvironment()) {
  const configured = process.env.INSTITUTION_IMAGE_DIR?.trim();
  const base = configured ? path.resolve(configured)
    : process.env.NODE_ENV === "production" ? "/var/logibots/uploads/institutions" : path.resolve(process.cwd(), "uploads", "institutions");
  return path.join(base, environment);
}

/** Saves already validated image bytes; returns the reference kept in the database. */
export async function storeImage(type: "png" | "jpeg" | "webp", bytes: Buffer): Promise<string> {
  const environment = currentEnvironment();
  const dir = imageDir(environment);
  await fs.mkdir(dir, { recursive: true });
  const name = `${createHash("sha256").update(bytes).digest("hex")}.${EXTENSION[type]}`;
  const target = path.join(dir, name);
  try {
    await fs.access(target); // same content already stored
  } catch {
    const temporary = path.join(dir, `.${name}.${randomBytes(6).toString("hex")}.tmp`);
    await fs.writeFile(temporary, bytes, { mode: 0o640 });
    await fs.rename(temporary, target);
  }
  return `file:${environment}/${name}`;
}

/** Address the pages use for a stored image (data URLs of older rows pass through unchanged). */
export function imagePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = IMAGE_REF.exec(value);
  return match ? `/institution-images/${match[1]}/${match[2]}` : value.startsWith("data:image/") ? value : null;
}

/** Removes a stored file that no row uses any more (best effort). */
export async function removeImageIfUnused(value: string | null | undefined, stillUsed: (reference: string) => Promise<boolean>) {
  const match = value ? IMAGE_REF.exec(value) : null;
  if (!match || (await stillUsed(value!))) return;
  await fs.rm(path.join(imageDir(match[1] as "production" | "sandbox"), match[2]), { force: true }).catch(() => undefined);
}

/** Test environment reset: its images go with its data. */
export async function clearSandboxImages() {
  await fs.rm(imageDir("sandbox"), { recursive: true, force: true }).catch(() => undefined);
}
