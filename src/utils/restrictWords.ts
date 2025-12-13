export const restrictWords: string[] = [
  "caralho", "caralhos", "carai", "caraio", "crl",
  "merda", "merdas", "merdinha", "m3rda",
  "porra", "p0rra", "porram",
  "bosta", "bostas", "bostinha",
  "foda", "foder", "fuder", "fudido", "fodido", "fudeu", "fodeu", "se foder", "se fuder", "fodase", "foda-se",
  "cacete", "caceta", "cacetinho",
  "cu", "cus", "cuzinho", "cuzão", "kuzão", "c*u",
  "puta", "putas", "puto", "putos", "putaria", "puta que pariu", "pqpp", "pqp",

  "buceta", "boceta", "buseta", "xota", "xoxota", "perereca",
  "pau", "pinto", "pica", "rola", "piroca", "penis", "bilau",
  "chupar", "chupa", "boquete", "siririca",
  "orgia", "anal", "sexo", "transar",

  "idiota", "idiotas", "imbecil", "imbecis",
  "retardado", "retardada", "retardados",
  "burro", "burra", "burrice", "asno", "anta",
  "animal", "besta", "jumento",
  "trouxa", "otario", "otaria", "babaca", "babacas",
  "vagabundo", "vagabunda", "inutil", "inuteis",
  "lixo", "lixoso",
  "arrombado", "arrombada",
  "desgracado", "desgracada", "desgraçado",
  "miseravel", "corno", "corna", "chifrudo",

  "viado", "viadinho", "viadão", "bicha", "biba", "boiola", "marica", "maricona",
  "sapatao", "sapatão", "caminhoneira", "traveco", "travesti",
  "macaco", "macaca", "preto imundo", "encardido",
  "mongol", "mongoloide",
  "gordo", "gorda", "baleia", "rolha de poço",

  "vsf", "vtmnc", "tnc", "fdp", "pnc",
  "chupa meu", "me mama",
  "suicidio", "se matar", "morra", "morre"
];


export function containsBadWord(text: string): { found: boolean; word?: string } {
  const lowerText = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "");

  for (const word of restrictWords) {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

    if (regex.test(lowerText)) {
      return { found: true, word };
    }
  }

  return { found: false };
}