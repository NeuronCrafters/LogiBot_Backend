import { UserAnalysis } from "models/UserAnalysis";
import { normalizeSubjectFromMessage } from "utils/normalizeSubject";

export async function recordInteraction(
    userId: string,
    message: string
): Promise<void> {

    const category = normalizeSubjectFromMessage(message);
    if (!category) {

        return;
    }


    const ua = await UserAnalysis.findOne({ userId });
    if (!ua) {
        throw new Error("UserAnalysis não encontrado para este userId");
    }

    ua.subjectCounts[category] = (ua.subjectCounts[category] || 0) + 1;

    ua.subjectFrequencyGlobal = ua.subjectFrequencyGlobal || {};
    ua.subjectFrequencyGlobal[category] =
        (ua.subjectFrequencyGlobal[category] || 0) + 1;

    await ua.save();
}
