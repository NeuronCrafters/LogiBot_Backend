export function generateDisciplineCode(universityId: string, courseId: string, classId: string, disciplineId: string) {
  const combined = `${universityId}${courseId}${classId}${disciplineId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, "0").substring(0, 8);
}
