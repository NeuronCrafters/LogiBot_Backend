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

    // incrementa o contador global (cumulativo)
    ua.subjectCounts[category] = (ua.subjectCounts[category] || 0) + 1;

    // incrementa o contador da sessão atual
    const lastSession = ua.sessions.at(-1);
    if (lastSession && !lastSession.sessionEnd) {
        const freqMap = lastSession.frequency as Map<string, number>;
        const sessCurrent = freqMap.get(category) ?? 0;
        freqMap.set(category, sessCurrent + 1);
    }

    await ua.save();
}
