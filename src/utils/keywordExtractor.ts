const KEYWORDS: Record<string, RegExp> = {
    Função: /\b(função|function)\b/i,
    Variáveis: /\b(variáveis?|variable)\b/i,
    Tipos: /\b(números?|strings?|texto|caracteres|numbers?|booleans?|verdadeiro|falso)\b/i,
    Loops: /\b(for|for in|for of|do\s+while|while|do|enquanto|switch|case)\b/i,
    Verificações: /\b(if|else|elif|if\s+else)\b/i,
};

export function extractSubject(text: string): string | null {
    for (const [subject, regex] of Object.entries(KEYWORDS)) {
        if (regex.test(text)) {
            return subject;
        }
    }
    return null;
}
