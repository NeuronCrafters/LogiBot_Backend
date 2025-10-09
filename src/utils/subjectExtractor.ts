const ALLOWED_SUBJECTS = new Set([
  "variaveis",
  "tipos",
  "funcoes",
  "loops",
  "verificacoes",
  "operacoes",
  "code",
  "quiz",
  "estruturas_dados",
  "analise_algoritmos",
  "arquivos_io",
]);

const keywordsMap: Record<string, string> = {
  "\\b(variavel|variaveis|variable|var|let|const)\\b": "variaveis",
  "\\b(tipo|tipos|numero|numeros|inteiro|int|long|string|texto|char|chart|boolean|booleano|bit|byte|base decimal)\\b": "tipos",

  "\\b(funcao|funcoes|function|metodo|procedure|recursao|recursividade)\\b": "funcoes",

  "\\b(loop|laco|for|while|repeat|repeticao|repeticoes)\\b": "loops",
  "\\b(if|else|switch|case|condicional|condicionais|condicao|condicoes|verificacao|verificacoes|algoritmo|algoritmos)\\b": "verificacoes",
  "\\b(operador|operadores|soma|menos|mais|[+\\-*/]|&&|\\|\\||!|tabela\\s+verdade|logica booleana|and|not|ou|xor|negacao|negação)\\b": "operacoes",

  // estruturas de dados
  "\\b(estrutura de dados|estruturas)\\b": "estruturas_dados",
  "\\b(lista|listas|array|vetor|vetores)\\b": "estruturas_dados",
  "\\b(pilha|pilhas|stack)\\b": "estruturas_dados",
  "\\b(fila|filas|queue)\\b": "estruturas_dados",
  "\\b(arvore|arvores|tree|binary tree)\\b": "estruturas_dados",
  "\\b(dicionario|dicionarios|map|mapa|hashmap)\\b": "estruturas_dados",
  "\\b(hash|hashtable|hashlist)\\b": "estruturas_dados",
  "\\b(linkedlist|lista ligada|listas ligadas)\\b": "estruturas_dados",

  // análise de algoritmos
  "\\b(big o|big-o|bignotation|complexidade|performance|desempenho)\\b": "analise_algoritmos",

  // arquivos e I/O
  "\\b(arquivo|arquivos|zip|compactado|json|csv|leitura|escrita|i/o)\\b": "arquivos_io",

  // --- geral ---
  "\\b(codigo|code|exemplo|snippet)\\b": "code",
  "\\b(quiz|praticar|exercicio|desafio)\\b": "quiz",

  // --- TÓPICOS A SEREM BARRADOS ---
  "\\b(ola|oi|ei|tudo bem)\\b": "greeting",
  "\\b(tchau|adeus|ate mais)\\b": "farewell",
  "\\b(quem e voce|o que voce faz)\\b": "about_bot",
};


export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}


export function extractAllowedSubject(message: string): string | null {
  const normalizedMessage = normalizeText(message);

  for (const pattern in keywordsMap) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(normalizedMessage)) {
      const subject = keywordsMap[pattern];
      if (ALLOWED_SUBJECTS.has(subject)) {
        return subject;
      }
    }
  }

  return null;
}