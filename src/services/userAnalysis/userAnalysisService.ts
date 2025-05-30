import { UserAnalysis } from "../../models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../utils/normalizeSubject";

export async function recordInteraction(
    userId: string,
    message: string
): Promise<void> {
    const category = normalizeSubjectFromMessage(message);
    if (!category) return;

    const ua = await UserAnalysis.findOne({ userId });
    if (!ua) {
        throw new Error("UserAnalysis não encontrado para este userId");
    }

    const lastSessionIndex = ua.sessions.length - 1;
    const lastSession = ua.sessions[lastSessionIndex];

    if (lastSession && !lastSession.sessionEnd) {
        ua.updateSubjectCountsChat(category);
    }

    await ua.save();
}