import { UserAnalysis } from "../../../models/UserAnalysis";

class SetTaxaDeAcertosService {
  async execute(userId: string, correctAnswers: number, wrongAnswers: number) {
    let userAnalysis = await UserAnalysis.findOne({ userId, endTime: null });

    if (!userAnalysis) {
      userAnalysis = new UserAnalysis({
        userId,
        startTime: new Date(),
        correctAnswers: 0,
        wrongAnswers: 0,
        totalQuestionsAnswered: 0,
        taxaDeAcertos: 0,
        taxaDeErros: 0,
        interactions: [],
      });
    }

    // Atualiza os valores
    userAnalysis.correctAnswers += correctAnswers;
    userAnalysis.wrongAnswers += wrongAnswers;
    userAnalysis.totalQuestionsAnswered = userAnalysis.correctAnswers + userAnalysis.wrongAnswers;

    // Atualiza as taxas dinamicamente
    userAnalysis.taxaDeAcertos = userAnalysis.totalQuestionsAnswered > 0
      ? (userAnalysis.correctAnswers / userAnalysis.totalQuestionsAnswered) * 100
      : 0;

    userAnalysis.taxaDeErros = userAnalysis.totalQuestionsAnswered > 0
      ? (userAnalysis.wrongAnswers / userAnalysis.totalQuestionsAnswered) * 100
      : 0;

    await userAnalysis.save();
    return userAnalysis;
  }
}

export const setTaxaDeAcertosService = new SetTaxaDeAcertosService();
