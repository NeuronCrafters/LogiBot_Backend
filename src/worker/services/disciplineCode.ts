function generateHash(universityId: string, courseId: string, classId: string, disciplineId: string): string {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const base36 = Math.abs(hash).toString(36).toUpperCase();
  return base36.padStart(8, "0").substring(0, 8);
}

export function generateDisciplineCode(
  universityId: string,
  courseId: string,
  classId: string,
  disciplineId: string,
): string {
  return generateHash(universityId, courseId, classId, disciplineId);
}
