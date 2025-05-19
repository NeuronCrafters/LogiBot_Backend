export type SubjectCounts = {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
    operacoes: number;
};

function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

const keywordsMap: Record<string, keyof SubjectCounts> = {
    // VARIÁVEIS
    "variavel": "variaveis",
    "variaveis": "variaveis",
    "variable": "variaveis",

    // TIPOS (números, strings, texto, caracteres, booleans...)
    "numero": "tipos",
    "numeros": "tipos",
    "number": "tipos",
    "numbers": "tipos",
    "string": "tipos",
    "texto": "tipos",
    "char": "tipos",
    "caractere": "tipos",
    "caracteres": "tipos",
    "boolean": "tipos",
    "booleano": "tipos",
    "true": "tipos",
    "false": "tipos",

    // FUNÇÕES
    "funcao": "funcoes",
    "funcoes": "funcoes",
    "function": "funcoes",

    // LOOPS / REPETIÇÃO
    "laco": "loops",
    "lacos": "loops",
    "loop": "loops",
    "while": "loops",
    "for": "loops",
    "dowhile": "loops",
    "repeat": "loops",

    // VERIFICAÇÕES / CONDICIONAIS
    "if": "verificacoes",
    "else": "verificacoes",
    "elif": "verificacoes",
    "switch": "verificacoes",
    "case": "verificacoes",
    "condicional": "verificacoes",

    // OPERADORES E OPERAÇÕES
    "mais": "operacoes",
    "menos": "operacoes",
    "vezes": "operacoes",
    "divisao": "operacoes",
    "soma": "operacoes",
    "subtracao": "operacoes",
    "multiplicacao": "operacoes",
    "divisao_inteira": "operacoes",
    "divisao_resto": "operacoes",
    "divisao_normal": "operacoes",
    "operadores": "operacoes",
    "operador": "operacoes",
    "operator": "operacoes",
    "&&": "operacoes",
    "||": "operacoes",
    "!": "operacoes",
    "ternario": "operacoes"
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