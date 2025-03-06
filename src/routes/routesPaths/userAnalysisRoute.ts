import { Router } from "express";
import { StartSessionController } from "../../controllers/userAnalysis/startSessionController";
import { EndSessionController } from "../../controllers/userAnalysis/endSessionController";
import { AddInteractionController } from "../../controllers/userAnalysis/addInteractionController";
import { SetTaxaDeAcertosController } from "../../controllers/userAnalysis/setTaxaDeAcertosController";
import { AddInteracaoForaDaSalaController } from "../../controllers/userAnalysis/addInteracaoForaDaSalaController";
import { GetUserAnalysisController } from "../../controllers/userAnalysis/getUserAnalysisController";
import { RegisterUserAnswerController } from "../../controllers/userAnalysis/registerUserAnswerController";

const userAnalysisRouter = Router();

userAnalysisRouter.post("/start", new StartSessionController().handle);
userAnalysisRouter.post("/end", new EndSessionController().handle);
userAnalysisRouter.post("/interact", new AddInteractionController().handle);
userAnalysisRouter.post("/set-taxa-acertos", new SetTaxaDeAcertosController().handle);
userAnalysisRouter.post("/out-of-room", new AddInteracaoForaDaSalaController().handle);
userAnalysisRouter.get("/get-analysis", new GetUserAnalysisController().handle);
userAnalysisRouter.post("/user-analysis/register-answer", new RegisterUserAnswerController().handle);

export { userAnalysisRouter };
