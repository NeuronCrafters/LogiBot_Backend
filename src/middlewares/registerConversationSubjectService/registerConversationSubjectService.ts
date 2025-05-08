import { Request, Response, NextFunction } from "express";
import { UserAnalysis } from "@/models/UserAnalysis";
import { normalizeSubjectFromMessage } from "@/utils/normalizeSubject";

export async function registerConversationSubject(
    req: Request,
    res: Response,
    next: NextFunction
) {
  try {
    const userId = req.user?.id;
    const userMessage = req.body.message?.toLowerCase();

    if (!userId || !userMessage) return next();

    const subject = normalizeSubjectFromMessage(userMessage);

    if (!subject) return next();

    const userAnalysis = await UserAnalysis.findOne({ userId });
    if (!userAnalysis) return next();

    const lastSession = userAnalysis.sessions.at(-1);
    if (!lastSession || lastSession.sessionEnd) return next();

    if (!lastSession.sessionBot || lastSession.sessionBot.length === 0) {
      lastSession.sessionBot = [{
        mostAccessedSubject: null,
        leastAccessedSubject: null,
        subjectFrequency: {}
      }];
    }

    const freq = lastSession.sessionBot[0].subjectFrequency || {};
    freq[subject] = (freq[subject] || 0) + 1;

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

    lastSession.sessionBot[0].subjectFrequency = freq;
    lastSession.sessionBot[0].mostAccessedSubject = {
      subject: sorted[0]?.[0] || null,
      count: sorted[0]?.[1] || 0,
    };
    lastSession.sessionBot[0].leastAccessedSubject = {
      subject: sorted.at(-1)?.[0] || null,
      count: sorted.at(-1)?.[1] || 0,
    };

    await userAnalysis.save();
    return next();
  } catch (err) {
    console.error("[registerConversationSubject] erro:", err);
    return next();
  }
}
