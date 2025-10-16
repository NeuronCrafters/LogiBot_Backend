export const levels = ["basico", "intermediario"];

export const categories = [
  "variáveis",
  "listas",
  "condicionais",
  "funções",
  "operadores_lógicos",
  "textos_e_caracteres",
];

export const subcategories: Record<string, string[]> = {
  "variáveis": [
    "o_que_são_variáveis",
    "tipos_existentes_de_variáveis",
    "variáveis_mutáveis",
  ],
  "listas": [
    "o_que_são_listas",
    "adicionar_elemento_na_lista",
    "remover_elemento_da_lista",
    "ordenar_lista",
    "acessar_elemento_da_lista",
  ],
  "condicionais": [
    "o_que_são_condicionais",
  ],
  "funções": [
    "o_que_são_funções",
    "como_usar_funções",
    "tipos_de_funções",
  ],
  "operadores_lógicos": [
    "o_que_são_operadores_lógicos",
  ],
  "textos_e_caracteres": [
    "operações_de_concatenacao_de_textos",
    "o_que_são_caracteres",
    "como_converter_caracteres",
  ],
};