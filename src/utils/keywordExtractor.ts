export type SubjectCounts = {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
    operacoes: number;
    greeting: number;  // saudações (handled elsewhere)
    farewell: number;  // despedidas (handled elsewhere)
    usage: number;  // quando/onde usar
    example: number;  // exemplos de uso
    code: number;  // solicitações de código
    quiz: number;  // convite para quiz
    general: number;  // tudo o mais
};

function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const keywordsMap: Record<string, keyof SubjectCounts> = {
    // VARIÁVEIS
    "\\bvariavel(?:is)?\\b": "variaveis",
    "\\bvariable(?:s)?\\b": "variaveis",

    // TIPOS
    "\\bnumero(?:s)?\\b": "tipos",
    "\\bnumbers?\\b": "tipos",
    "\\bstring\\b": "tipos",
    "\\btexto\\b": "tipos",
    "\\bchar(?:acteres?)?\\b": "tipos",
    "\\bboolean(?:o|s)?\\b": "tipos",

    // FUNÇÕES
    "\\bfuncao(?:es)?\\b": "funcoes",
    "\\bfunction(?:s)?\\b": "funcoes",

    // LOOPS
    "\\bloops?\\b": "loops",
    "\\bfor\\b": "loops",
    "\\bwhile\\b": "loops",
    "\\brepeat\\b": "loops",

    // CONDICIONAIS
    "\\bif\\b": "verificacoes",
    "\\belse\\b": "verificacoes",
    "\\bswitch\\b": "verificacoes",
    "\\bcase\\b": "verificacoes",

    // OPERADORES
    "\\bmais\\b": "operacoes",
    "\\bmenos\\b": "operacoes",
    "\\bsoma\\b": "operacoes",
    "[+\\-*/]": "operacoes",
    "&&|\\|\\||!": "operacoes",

    // SAUDAÇÕES (se quiser filtrar também aqui)
    "\\bola\\b": "greeting",
    "\\boi\\b": "greeting",

    // DESPEDIDAS
    "\\btchau\\b": "farewell",
    "\\badeus\\b": "farewell",

    // USO / CONTEXTO
    "\\bquando usar\\b": "usage",
    "\\bonde usar\\b": "usage",
    "\\bpara que serve\\b": "usage",

    // EXEMPLOS
    "\\bexemplo(?:s)?\\b": "example",
    "\\bpor exemplo\\b": "example",

    // CÓDIGO
    "\\bcod(?:igo|e)\\b": "code",
    "\\bsnippet\\b": "code",

    // QUIZ / PRÁTICA
    "\\bquiz\\b": "quiz",
    "\\bpraticar\\b": "quiz",
    "\\bexercicio(?:s)?\\b": "quiz",

    // FALLBACK GENÉRICO
    "\\bduvida\\b": "general",
    "\\bajuda\\b": "general",
    "\\bpergunta\\b": "general",
};

/**
 * Retorna a categoria detectada (uma das SubjectCounts).
 * Se não encontrar nada, sempre devolve "general".
 */
export function normalizeSubjectFromMessage(text: string): keyof SubjectCounts {
    const norm = normalizeText(text);

    for (const pattern in keywordsMap) {
        const re = new RegExp(pattern, "i");
        if (re.test(norm)) {
            return keywordsMap[pattern];
        }
    }

    // Fallback: tratamento “genérico” para qualquer coisa não reconhecida
    return "general";
}
