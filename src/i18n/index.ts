import { AsyncLocalStorage } from "async_hooks";
import ptBR from "./catalogs/pt-BR.json";
import enUS from "./catalogs/en-US.json";
import esES from "./catalogs/es-ES.json";

export const SUPPORTED_LANGUAGES = ["pt-BR", "en-US", "es-ES"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type MessageKey = keyof typeof ptBR;
export type MessageParams = Record<string, string | number>;
export type LocalizedMessage = { key: MessageKey; params?: MessageParams };
export const DEFAULT_LANGUAGE: Language = "pt-BR";
export const catalogs: Record<Language, Record<MessageKey, string>> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
};

type LanguageContext = {
  language: Language;
  browserLanguage: Language;
  explicit: boolean;
};
const context = new AsyncLocalStorage<LanguageContext>();

export function normalizeLanguage(value: unknown): Language | undefined {
  if (typeof value !== "string") return undefined;
  const tag = value.trim().replace(/_/g, "-").toLowerCase();
  if (!/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(tag)) return undefined;
  if (tag === "pt" || tag.startsWith("pt-")) return "pt-BR";
  if (tag === "en" || tag.startsWith("en-")) return "en-US";
  if (tag === "es" || tag.startsWith("es-")) return "es-ES";
  return undefined;
}

export function negotiateLanguage(header?: string): Language {
  const entries = (header || "").split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const qParameter = parameters.find(parameter => parameter.trim().startsWith("q="));
    const raw = qParameter?.trim().slice(2);
    const quality = raw === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0;
    return { language: normalizeLanguage(tag), wildcard: tag === "*", quality, index };
  });
  const excluded = new Set(entries.filter(entry => entry.quality === 0).map(entry => entry.language));
  for (const entry of [...entries].sort((a, b) => b.quality - a.quality || a.index - b.index)) {
    if (entry.quality <= 0) continue;
    if (entry.language) return entry.language;
    if (entry.wildcard) return SUPPORTED_LANGUAGES.find(language => !excluded.has(language)) || DEFAULT_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguage(): Language {
  return context.getStore()?.language || DEFAULT_LANGUAGE;
}

export function withLanguage<T>(language: Language, callback: () => T): T {
  const current = context.getStore();
  return context.run({ language, browserLanguage: current?.browserLanguage || language, explicit: current?.explicit || false }, callback);
}

export function withRequestLanguage<T>(language: Language, browserLanguage: Language, explicit: boolean, callback: () => T): T {
  return context.run({ language, browserLanguage, explicit }, callback);
}

export function applyPreferredLanguage(preference: unknown): Language {
  const current = context.getStore();
  if (current && !current.explicit) current.language = normalizeLanguage(preference) || current.browserLanguage;
  return getLanguage();
}

export function getEmailLanguage(preference: unknown): Language {
  const current = context.getStore();
  return current?.explicit ? current.language : normalizeLanguage(preference) || getLanguage();
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(ptBR, key);
}

export function t(key: MessageKey, params: MessageParams = {}, language: Language = getLanguage()): string {
  const template = catalogs[language]?.[key] ?? ptBR[key];
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    params[name] === undefined ? placeholder : String(params[name]),
  );
}
