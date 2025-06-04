function generateHash(universityId: string, courseId: string, classId: string, disciplineId: string): string {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Converter para string de 8 caracteres alfanuméricos
  const base36 = Math.abs(hash).toString(36).toUpperCase();
  return base36.padStart(8, '0').substring(0, 8);
}

export function generateDisciplineCode(
    universityId: string,
    courseId: string,
    classId: string,
    disciplineId: string
): string {
  return generateHash(universityId, courseId, classId, disciplineId);
}

// Função para buscar entidades pelo código (já que não podemos decodificar hash)
export async function findEntitiesByCode(code: string) {
  const { Discipline } = await import("@/models/Discipline");

  try {
    // Buscar disciplina pelo código e popular todas as referências necessárias
    const discipline = await Discipline.findOne({ code })
        .populate({
          path: 'course',
          populate: {
            path: 'university'
          }
        })
        .populate('classes');

    if (!discipline) {
      return null;
    }

    const course = discipline.course as any;
    const university = course.university as any;

    return {
      university,
      course,
      discipline,
      classes: discipline.classes
    };
  } catch (error) {
    return null;
  }
}

// Versão alternativa usando CRC32 para mais consistência
function crc32(str: string): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ ((crc ^ str.charCodeAt(i)) & 0xFF);
  }
  return (crc ^ (-1)) >>> 0;
}

export function generateDisciplineCodeCRC(
    universityId: string,
    courseId: string,
    classId: string,
    disciplineId: string
): string {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  const hash = crc32(combined);
  const base36 = hash.toString(36).toUpperCase();
  return base36.padStart(8, '0').substring(0, 8);
}

// Manter função simples como backup
export function generateDisciplineCodeSimple(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}