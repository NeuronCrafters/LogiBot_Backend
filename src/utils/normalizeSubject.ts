function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const keywordsMap: Record<string, keyof SubjectCounts> = {
    // VARIÁVEIS
    "variavel":   "variaveis",
    "variaveis":  "variaveis",
    "variable":   "variaveis",
    // TIPOS (números, strings, texto, caracteres, booleans...)
    "numero":   "tipos", "numeros":"tipos", "number":"tipos","numbers":"tipos",
    "string":   "tipos", "texto":  "tipos", "texto":   "tipos", "char":"tipos",
    "boolean":  "tipos", "booleano":"tipos","true":"tipos","false":"tipos",
    // FUNÇÕES
    "funcao":    "funcoes", "funcoes":"funcoes", "function":"funcoes",
    // LOOPS / REPETIÇÃO
    "laco":      "loops", "lacos":"loops","loop":"loops",
    "while":"loops","for":"loops","dowhile":"loops","repeat":"loops",
    // VERIFICAÇÕES / CONDICIONAIS
    "if":"verificacoes","else":"verificacoes","elif":"verificacoes",
    "switch":"verificacoes","case":"verificacoes","condicional":"verificacoes",
};

export type SubjectCounts = {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
};

/**
 * Retorna a chave da categoria (uma das SubjectCounts)
 * ou null se não encontrar.
 */
export function normalizeSubjectFromMessage(text: string): keyof SubjectCounts | null {
    const norm = normalizeText(text);
    for (const termo in keywordsMap) {
        if (norm.includes(termo)) {
            return keywordsMap[termo];
        }
    }
    return null;
}
