import { UserAnalysis } from "models/UserAnalysis";
import { extractSubject } from "utils/keywordExtractor";

export async function recordInteraction(
    userId: string,
    message: string
): Promise<void> {
    // extrai o assunto
    const subjectMatched = extractSubject(message);

    // busca o documento existente
    const ua = await UserAnalysis.findOne({ userId });
    if (!ua) {
        throw new Error("UserAnalysis não encontrado para este userId");
    }

    // adiciona a interação
    ua.addInteraction(message, undefined, subjectMatched);
    await ua.save();
}
