export function normalizeText(text: string): string {
  if (!text) {
    return '';
  }

  const lowerCaseText = text.toLocaleLowerCase();
  const decomposedText = lowerCaseText.normalize('NFD');
  const withoutAccents = decomposedText.replace(/[\u0300-\u036f]/g, '');

  return withoutAccents;
}