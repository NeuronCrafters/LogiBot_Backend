const ALLOWED_SUBJECTS = new Set([
  "variaveis_tipos",
  "operadores",
  "estruturas_controle",
  "funcoes",
  "escopo",
  "entrada_saida",
  "tratamento_erros",
  "estruturas_dados_conceitos",
  "estruturas_dados_lineares",
  "estruturas_dados_nao_lineares",
  "algoritmos_conceitos",
  "algoritmos_ordenacao",
  "algoritmos_busca",
  "algoritmos_grafos",
  "algoritmos_paradigmas",
  "oop_conceitos",
  "oop_pilares",
  "design_patterns",
  "arquivos_io",
  "seguranca_cripto",
  "redes_protocolos",
  "sistemas_operacionais",
  "banco_de_dados",
  "devops_cloud",
  "linguagens_ferramentas",
  "code",
  "quiz",
]);

const keywordsMap: Record<string, string> = {
  "\\b(variable|variables|variavel|variaveis|var|let|const|type|types|tipo|tipos|int|integer|string|char|boolean|booleano|float|double)\\b": "variaveis_tipos",
  "\\b(operator|operators|operador|operadores|==|===|>=|<=|>|<|[+\\-%]|soma|subtracao|multiplicacao|divisao|&&|\\|\\||!|and|or|not|xor|bitwise|tabela verdade|truth table)\\b": "operadores",
  "\\b(if|else|switch|case|for|while|do while|loop|laco|condicao|controle de fluxo|flow control)\\b": "estruturas_controle",
  "\\b(function|funcao|method|metodo|procedure|procedimento|arguments|argumentos|parameters|parametros|return|retorno)\\b": "funcoes",
  "\\b(scope|escopo|global|local|closure|clausura)\\b": "escopo",
  "\\b(input|output|entrada|saida|ler|escrever|print|console|terminal)\\b": "entrada_saida",
  "\\b(error|erro|exception|excecao|try|catch|finally|throw|lancamento|debugging|debug)\\b": "tratamento_erros",

  "\\b(data structure|estrutura de dados)\\b": "estruturas_dados_conceitos",
  "\\b(array|vector|vetor|matriz|matrix|list|lista|linked list|lista ligada|stack|pilha|queue|fila|deque)\\b": "estruturas_dados_lineares",
  "\\b(tree|arvore|binary tree|arvore binaria|bst|avl|red-black|heap|priority queue|trie|graph|grafo|hash table|tabela hash|map|dicionario)\\b": "estruturas_dados_nao_lineares",

  "\\b(algorithm|algoritmo|logic|logica|pseudocode|fluxograma|flowchart|big o|big-o|notation|complexidade|complexity|performance|desempenho)\\b": "algoritmos_conceitos",
  "\\b(sort|sorting|ordenacao|bubble sort|selection sort|insertion sort|merge sort|quicksort|heap sort|radix sort|counting sort)\\b": "algoritmos_ordenacao",
  "\\b(search|searching|busca|linear search|busca sequencial|binary search|busca binaria|dfs|bfs|depth-first|breadth-first|busca em profundidade|busca em largura)\\b": "algoritmos_busca",
  "\\b(dijkstra|a\\*|a-star|prim|kruskal|floyd-warshall|bellman-ford|travessia|traversal|shortest path|menor caminho)\\b": "algoritmos_grafos",
  "\\b(greedy|guloso|dynamic programming|programacao dinamica|dp|divide and conquer|divisao e conquista|backtracking|memoization|tabulation)\\b": "algoritmos_paradigmas",

  "\\b(class|classe|object|objeto|instance|instancia|attribute|atributo|property|propriedade|constructor|construtor)\\b": "oop_conceitos",
  "\\b(oop|poo|object-oriented|orientacao a objetos|encapsulation|encapsulamento|inheritance|heranca|polymorphism|polimorfismo|abstraction|abstracao|interface|public|private|protected|solid)\\b": "oop_pilares",
  "\\b(design pattern|padrao de projeto|singleton|factory|observer|strategy|decorator|adapter|facade|mvc|mvvm)\\b": "design_patterns",

  "\\b(file|arquivo|json|csv|yaml|xml|read|write|leitura|escrita|i/o|stream|buffer)\\b": "arquivos_io",
  "\\b(security|seguranca|cryptography|criptografia|hash|sha256|sha512|md5|encryption|cifragem|jwt|oauth|token|ssl|tls)\\b": "seguranca_cripto",
  "\\b(network|rede|protocol|protocolo|http|https|tcp|udp|ip|dns|api|rest|graphql|websocket|socket)\\b": "redes_protocolos",
  "\\b(os|so|sistema operacional|operating system|linux|windows|macos|kernel|process|thread|memory management|gerenciamento de memoria)\\b": "sistemas_operacionais",
  "\\b(database|banco de dados|sql|nosql|mysql|postgresql|sqlite|mongodb|redis|query|select|insert|update|delete|transaction|transacao|index|indice|orm)\\b": "banco_de_dados",
  "\\b(docker|container|kubernetes|k8s|ci/cd|jenkins|github actions|aws|azure|gcp|cloud|serverless|lambda|terraform|ansible|devops)\\b": "devops_cloud",
  "\\b(python|javascript|js|typescript|ts|java|c#|csharp|c\\+\\+|php|ruby|go|rust|kotlin|swift|git|npm|pip|maven|gradle|vscode|ide|debug|debugging|refactoring)\\b": "linguagens_ferramentas",

  "\\b(code|codigo|example|exemplo|snippet)\\b": "code",
  "\\b(quiz|exercise|exercicio|challenge|desafio|practice|praticar)\\b": "quiz",
};

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
  for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

const keywordToSubjectMap = new Map<string, string>();
const allKeywords = new Set<string>();

for (const pattern in keywordsMap) {
  const subject = keywordsMap[pattern];
  const words = pattern.replace(/\\b|\(|\)|\|/g, ' ').split(' ').filter(w => w.length > 2 && !w.includes('*') && !w.includes('+') && !w.includes('\\'));
  words.forEach(word => {
    if (!keywordToSubjectMap.has(word)) {
      keywordToSubjectMap.set(word, subject);
    }
    allKeywords.add(word);
  });
}

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

  const messageWords = normalizedMessage.split(/\s+/);

  for (const word of messageWords) {
    if (word.length < 4) continue;

    for (const keyword of allKeywords) {
      let tolerance = 0;
      if (keyword.length >= 5) tolerance = 1;
      if (keyword.length >= 9) tolerance = 2;

      const distance = levenshteinDistance(word, keyword);

      if (distance <= tolerance) {
        const subject = keywordToSubjectMap.get(keyword);
        if (subject && ALLOWED_SUBJECTS.has(subject)) {

          return subject;
        }
      }
    }
  }


  return null;
}

export function validateAndEnrichPrompt(userText: string): { subject: string; prompt: string; systemPrompt: string } | null {
  const subject = extractAllowedSubject(userText);

  const SYSTEM_PROMPT_RIGIDO = "Você é um assistente de programação. Seu foco estrito é em programação, algoritmos, lógica, linguagens de código e ferramentas de desenvolvimento (como Docker). SE a pergunta do usuário não for sobre este escopo, você DEVE responder EXCLUSIVAMENTE com a frase: 'Desculpe, só posso conversar sobre programação, algoritmos e tópicos relacionados. Pode me perguntar sobre variáveis, listas, ou até mesmo Docker!' NUNCA tente ser criativo ou relacionar tópicos não-técnicos ao seu escopo. Respeite sempre esta regra.";

  if (subject === null) {

    return null;
  }



  const executionPrompt = `Você é um tutor de programação especialista e didático. O usuário está perguntando sobre o tópico específico de **${subject}**. Responda a pergunta dele de forma clara, concisa e focada neste tópico, sempre usando exemplos de código quando apropriado. A pergunta do usuário é: '${userText}'`;

  return {
    subject,
    prompt: executionPrompt,
    systemPrompt: SYSTEM_PROMPT_RIGIDO
  };
}