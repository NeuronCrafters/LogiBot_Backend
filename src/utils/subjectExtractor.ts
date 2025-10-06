const ALLOWED_SUBJECTS = new Set([
  "variaveis",
  "tipos",
  "funcoes",
  "loops",
  "verificacoes",
  "operacoes",
  "code",
  "quiz",
]);

const keywordsMap: Record<string, string> = {
  // Tópicos principais de lógica
  "\\b(variavel|variaveis|variable|var|let|const)\\b": "variaveis",
  "\\b(tipo|tipos|numero|string|texto|char|boolean|booleano)\\b": "tipos",
  "\\b(funcao|funcoes|function|metodo|procedure)\\b": "funcoes",
  "\\b(loop|laco|for|while|repeat|repeticao)\\b": "loops",
  "\\b(if|else|switch|case|condicional|condicao|verificacao)\\b": "verificacoes",
  "\\b(operador|operadores|soma|menos|mais|[+\\-*/]|&&|\\|\\||!)\\b": "operacoes",
  "\\b(codigo|code|exemplo|snippet)\\b": "code",
  "\\b(quiz|praticar|exercicio|desafio)\\b": "quiz",

  // Tópicos a serem barrados (não estão em ALLOWED_SUBJECTS)
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