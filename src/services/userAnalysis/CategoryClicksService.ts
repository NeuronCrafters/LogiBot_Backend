import { UserAnalysis } from "../../models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../utils/normalizeSubject";

export async function updateCategoryClicksService(
    userId: string,
    clicks: Record<string, number>
): Promise<void> {
    const ua = await UserAnalysis.findOne({ userId });
    if (!ua) {
        throw new Error(`UserAnalysis não encontrado para userId=${userId}`);
    }

    for (const [rawSubject, count] of Object.entries(clicks)) {
        const categoryKey = normalizeSubjectFromMessage(rawSubject) || "tipos";

        for (let i = 0; i < count; i++) {
            ua.updateSubjectCountsQuiz(categoryKey);
        }
    }

    await ua.save();
}