import { AppError } from "../../exceptions/AppError";

/**
 * Finds the map point of an institution's address with OpenStreetMap's Nominatim. It runs on the
 * server, so the people using the page never talk to the service; only the address typed by the
 * coordination is sent. Nominatim asks for at most one request per second and an identified client.
 */
export interface Place { label: string; latitude: number; longitude: number }

const BASE = () => (process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
/** How the service identifies us (its usage policy asks for it). */
export const USER_AGENT = "LogiBots/1.0 (+https://saellogibot.com)";
const MIN_INTERVAL = 1100;
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

/** One request at a time, spaced as the service asks. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + MIN_INTERVAL - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function geocodeAddress(query: unknown, language = "pt-BR"): Promise<Place[]> {
  const text = typeof query === "string" ? query.trim() : "";
  if (text.length < 3 || text.length > 300) throw new AppError("institutions.geocodeQuery", 400);
  return throttled(async () => {
    const email = process.env.GEOCODER_EMAIL?.trim();
    const url = `${BASE()}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(text)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": language },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new AppError("institutions.geocodeUnavailable", 502);
    }
    if (!response.ok) throw new AppError("institutions.geocodeUnavailable", 502);
    const rows = (await response.json()) as Array<{ display_name?: unknown; lat?: unknown; lon?: unknown }>;
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({ label: String(row.display_name ?? ""), latitude: Number(row.lat), longitude: Number(row.lon) }))
      .filter((place) => place.label && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  });
}
