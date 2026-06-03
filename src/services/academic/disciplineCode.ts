import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { classDisciplines, disciplines } from "../../db/schema";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_CODE_LENGTH = 8;
const MAX_ATTEMPTS = 20;

export function generateRegistrationCode(length = DEFAULT_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let code = "";

  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }

  return code;
}

export async function generateUniqueRegistrationCode(db: AnyDbClient) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRegistrationCode();
    const [[classCode], [legacyDisciplineCode]] = await Promise.all([
      db.select({ code: classDisciplines.code }).from(classDisciplines).where(eq(classDisciplines.code, code)).limit(1),
      db.select({ code: disciplines.code }).from(disciplines).where(eq(disciplines.code, code)).limit(1),
    ]);

    if (!classCode && !legacyDisciplineCode) return code;
  }

  throw new Error("nao foi possivel gerar um codigo unico de registro");
}
