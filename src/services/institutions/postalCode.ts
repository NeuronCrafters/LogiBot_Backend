import { AppError } from "../../exceptions/AppError";
import { USER_AGENT } from "./geocoder";

/**
 * Brazilian postal code (CEP) lookup with ViaCEP, from the server: only the CEP typed by whoever edits
 * the institution is sent. Fills street, district, city, state and country.
 */
export interface PostalAddress { postalCode: string; address: string | null; district: string | null; city: string | null; state: string | null; country: string }

const BASE = () => (process.env.POSTAL_CODE_URL || "https://viacep.com.br/ws").replace(/\/$/, "");
/** Found CEPs are kept for a day, so typing the same CEP again does not call the service. */
const CACHE_MS = 24 * 3600 * 1000;
const cache = new Map<string, { at: number; value: PostalAddress }>();

export async function lookupPostalCode(raw: unknown): Promise<PostalAddress> {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  if (digits.length !== 8) throw new AppError("institutions.postalCodeInvalid", 400);
  const cached = cache.get(digits);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let response: Response;
  try {
    response = await fetch(`${BASE()}/${digits}/json/`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
  } catch {
    throw new AppError("institutions.postalCodeUnavailable", 502);
  }
  if (response.status === 400) throw new AppError("institutions.postalCodeInvalid", 400);
  if (!response.ok) throw new AppError("institutions.postalCodeUnavailable", 502);
  const body = (await response.json()) as Record<string, unknown>;
  if (!body || body.erro) throw new AppError("institutions.postalCodeNotFound", 404);
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const value: PostalAddress = {
    postalCode: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    address: text(body.logradouro),
    district: text(body.bairro),
    city: text(body.localidade),
    state: text(body.uf),
    country: "Brasil",
  };
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(digits, { at: Date.now(), value });
  return value;
}
