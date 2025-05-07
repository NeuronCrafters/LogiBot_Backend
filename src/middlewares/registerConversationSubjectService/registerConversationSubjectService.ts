import { Request, Response, NextFunction } from "express";
import { UserAnalysis } from "@/models/UserAnalysis";
import { palavrasChaveConversa } from "@/utils/palavras-chave";

export async function registerConversationSubject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    const userMessage = req.body.message?.toLowerCase();

    if (!userId || !userMessage) return next();

    const palavrasEncontradas = Array.from(palavrasChaveConversa).filter((palavra) =>
      userMessage.includes(palavra)
    );

    if (palavrasEncontradas.length === 0) return next();

    const userAnalysis = await UserAnalysis.findOne({ userId });
    if (!userAnalysis) return next();

    const lastSession = userAnalysis.sessions.at(-1);
    if (!lastSession || lastSession.sessionEnd) return next();

    for (const palavra of palavrasEncontradas) {
      if (!userAnalysis.subjectFrequency) {
        userAnalysis.subjectFrequency = {};
      }

      userAnalysis.subjectFrequency[palavra] =
        (userAnalysis.subjectFrequency[palavra] || 0) + 1;
    }

    const freqEntries = Object.entries(userAnalysis.subjectFrequency);
    freqEntries.sort((a, b) => b[1] - a[1]);

    userAnalysis.mostAccessedSubject = freqEntries[0]?.[0] || null;
    userAnalysis.leastAccessedSubject = freqEntries.at(-1)?.[0] || null;

    await userAnalysis.save();
    return next();
  } catch (err) {
    console.error("[registerConversationSubject] erro:", err);
    return next();
  }
}
