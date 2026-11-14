import type { Language } from "../../i18n";

const words = (value: string) => new Set(value.split(" "));
const signals: Record<Language, Set<string>> = {
  "pt-BR": words("voce voces uma umas uns um nao sao tambem entao pode podem podemos vamos isso esse essa estes essas aqui quando onde qual quais como porque pois mas para que de do da dos das em no na nos nas com sem seu sua seus suas ao ate apenas sempre dados exemplo exemplos funcao funcoes"),
  "en-US": words("the is are this that these those you your can could would will should be been with without from into then than which what when where how not have has we they their it its does do for and or as of to in an using use explain explanation function functions example examples data"),
  "es-ES": words("usted ustedes una unas unos un no son tambien entonces puede pueden podemos vamos esto ese esa estos esas aqui cuando donde cual cuales como porque pero para que de del los las en con sin su sus al hasta solo siempre datos ejemplo ejemplos funcion funciones puedes tienes es el"),
};

export function proseOnly(text: string) {
  return text.replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, " ")
    .replace(/`[^`]*(?:`|$)/g, " ")
    .replace(/"[^"\n]*"|“[^”\n]*”/g, " ")
    .replace(/^\s*>.*$/gm, " ")
    .replace(/https?:\/\/\S+/g, " ");
}

/** A conservative primary check: ambiguous/short prose and code are never guessed. */
export function detectProseLanguage(text: string): Language | null {
  const tokens = proseOnly(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]+/g) || [];
  if (tokens.length < 8) return null;
  const counts = new Map<string, number>();
  tokens.forEach(token => counts.set(token, Math.min(2, (counts.get(token) || 0) + 1)));
  const scores = (Object.keys(signals) as Language[]).map(language => ({ language,
    score: [...counts].reduce((sum, [word, count]) => sum + (signals[language].has(word) ? count : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0].score >= 5 && scores[0].score - scores[1].score >= 4 && scores[0].score >= scores[1].score * 1.6 ? scores[0].language : null;
}

export class ChatOutputValidationError extends Error {
  constructor(public readonly reason: "language" | "internal", public readonly expected: Language, public readonly detected?: Language) {
    super(`Chat output rejected: ${reason}`);
  }
}

export function assertChatOutput(text: string, language: Language) {
  const prose = proseOnly(text);
  if (/<\/?(?:think|analysis|reasoning|scratchpad|end)>|<\|(?:start|end|channel|im_start|im_end|im_sep)[^>]*>|(?:^|\n)\s*(?:analysis|reasoning)\s*:|(?:^|\n)\s*We are ChatGPT\b/i.test(prose))
    throw new ChatOutputValidationError("internal", language);
  const detected = detectProseLanguage(prose);
  if (detected && detected !== language) throw new ChatOutputValidationError("language", language, detected);
}

export function createChatOutputGate(language: Language) {
  let pending = "";
  let open = false;
  return {
    push(text: string) {
      if (open) return text;
      pending += text;
      assertChatOutput(pending, language);
      const count = proseOnly(pending).match(/\p{L}+/gu)?.length || 0;
      if (count < 12 && pending.length < 220) return "";
      open = true;
      const output = pending; pending = "";
      return output;
    },
    finish() {
      assertChatOutput(pending, language);
      const output = pending; pending = "";
      return output;
    },
  };
}
