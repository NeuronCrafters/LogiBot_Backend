export function normalizeText(text: string): string {
  if (!text) {
    return '';
  }

  // converter para caixa baixa
  // ex: Olá -> olá
  const lowerCaseText = text.toLocaleLowerCase();
  // separa os caracteres de acentuação
  // ex: ç -> c
  const decomposedText = lowerCaseText.normalize('NFD');
  //remove os acentos usando regex
  const withoutAccents = decomposedText.replace(/[\u0300-\u036f]/g, '');

  return withoutAccents;
}