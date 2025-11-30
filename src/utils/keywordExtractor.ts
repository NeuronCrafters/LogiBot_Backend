export type SubjectCounts = {
    variaveis: number;
    tipos: number;
    funcoes: number;
    loops: number;
    verificacoes: number;
    operacoes: number;
    greeting: number;
    farewell: number;
    usage: number;
    example: number;
    code: number;
    quiz: number;
    general: number;
};

function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const keywordsMap: Record<string, keyof SubjectCounts> = {
    "\\bvariavel(?:is)?\\b": "variaveis",
    "\\bvariable(?:s)?\\b": "variaveis",
    "\\bnumero(?:s)?\\b": "tipos",
    "\\bnumbers?\\b": "tipos",
    "\\bstring\\b": "tipos",
    "\\btexto\\b": "tipos",
    "\\bchar(?:acteres?)?\\b": "tipos",
    "\\bboolean(?:o|s)?\\b": "tipos",
    "\\bfuncao(?:es)?\\b": "funcoes",
    "\\bfunction(?:s)?\\b": "funcoes",
    "\\bloops?\\b": "loops",
    "\\bfor\\b": "loops",
    "\\bwhile\\b": "loops",
    "\\brepeat\\b": "loops",
    "\\bif\\b": "verificacoes",
    "\\belse\\b": "verificacoes",
    "\\bswitch\\b": "verificacoes",
    "\\bcase\\b": "verificacoes",
    "\\bmais\\b": "operacoes",
    "\\bmenos\\b": "operacoes",
    "\\bsoma\\b": "operacoes",
    "[+\\-*/]": "operacoes",
    "&&|\\|\\||!": "operacoes",
    "\\bola\\b": "greeting",
    "\\boi\\b": "greeting",
    "\\btchau\\b": "farewell",
    "\\badeus\\b": "farewell",
    "\\bquando usar\\b": "usage",
    "\\bonde usar\\b": "usage",
    "\\bpara que serve\\b": "usage",
    "\\bexemplo(?:s)?\\b": "example",
    "\\bpor exemplo\\b": "example",
    "\\bcod(?:igo|e)\\b": "code",
    "\\bsnippet\\b": "code",
    "\\bquiz\\b": "quiz",
    "\\bpraticar\\b": "quiz",
    "\\bexercicio(?:s)?\\b": "quiz",
    "\\bduvida\\b": "general",
    "\\bajuda\\b": "general",
    "\\bpergunta\\b": "general",
};

export function normalizeSubjectFromMessage(text: string): keyof SubjectCounts {
    const norm = normalizeText(text);

    for (const pattern in keywordsMap) {
        const re = new RegExp(pattern, "i");
        if (re.test(norm)) {
            return keywordsMap[pattern];
        }
    }

    return "general";
}
