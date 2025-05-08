export function normalizeSubjectFromMessage(text: string): string | null {
  const msg = text.toLowerCase();

  const mapa: Record<string, string> = {
    // VARIÁVEIS
    "variavel": "variavel",
    "variáveis": "variavel",
    "variavél": "variavel",
    "variaveis": "variavel",
    "variable": "variavel",
    "varivel": "variavel",

    // LISTAS
    "lista": "lista",
    "listas": "lista",
    "lissta": "lista",
    "list": "lista",
    "lists": "lista",

    // FUNÇÕES
    "função": "funcao",
    "funçoes": "funcao",
    "funçao": "funcao",
    "funcoes": "funcao",
    "function": "funcao",
    "functions": "funcao",
    "funçaõ": "funcao",

    // LAÇOS / REPETIÇÃO
    "laço": "laco",
    "laços": "laco",
    "loop": "laco",
    "loops": "laco",
    "while": "laco",
    "dowhile": "laco",
    "do while": "laco",
    "for": "laco",
    "forin": "laco",
    "for of": "laco",
    "forof": "laco",
    "for in": "laco",
    "repeticao": "laco",
    "repetição": "laco",
    "repeticão": "laco",
    "repetiçao": "laco",

    // TEXTOS / CARACTERES
    "texto": "texto",
    "string": "texto",
    "caractere": "texto",
    "char": "texto",

    // NÚMEROS
    "numero": "numero",
    "número": "numero",
    "numeros": "numero",
    "números": "numero",
    "int": "numero",
    "integer": "numero",
    "integers": "numero",
    "float": "numero",
    "floats": "numero",
    "double": "numero",
    "number": "numero",
    "numbers": "numero",

    // CONDICIONAIS
    "condicional": "condicional",
    "condicionais": "condicional",
    "if": "condicional",
    "else": "condicional",
    "elif": "condicional",
    "switch": "condicional",
    "case": "condicional",
    "switch case": "condicional",
    "switchcase": "condicional",

    // VERIFICAÇÕES
    "verificação": "verificacao",
    "verificações": "verificacao",
    "verificacao": "verificacao",
    "verificacoes": "verificacao",
    "verifica": "verificacao",
    "verificaçao": "verificacao",
    "verificaçãos": "verificacao",
    "verificaçaos": "verificacao",
    "verificaçõe": "verificacao",
    "verificaçães": "verificacao",
    "verificaçaes": "verificacao",
    "ifelse": "verificacao"
  };

  for (const chave in mapa) {
    if (msg.includes(chave)) {
      return mapa[chave];
    }
  }

  return null;
}
