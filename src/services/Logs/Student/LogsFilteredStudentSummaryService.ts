import { UserAnalysis } from "../../../models/UserAnalysis";

export async function LogsFilteredStudentSummaryService(
  universityId: string,
  courseId?: string,
  classId?: string
) {
  const query: any = { schoolId: universityId };

  if (courseId) query.courseId = courseId;
  if (classId) query.classId = classId;

  const users = await UserAnalysis.find(query);

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectFrequency: Record<string, number> = {};

  users.forEach((ua) => {
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    ua.sessions.forEach((session) => {
      if (session.subjectFrequency) {
        for (const [subject, count] of session.subjectFrequency.entries()) {
          subjectFrequency[subject] = (subjectFrequency[subject] || 0) + count;
        }
      }
    });
  });

  const mostAccessedSubjects = Object.entries(subjectFrequency)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    mostAccessedSubjects,
  };
}
