import { Router } from "express";
import { addInteraction } from "controllers/userAnalysis/userAnalysisController";
import { isPermissions } from "middlewares/isPermissions/isPermissions";

const useAnalysis = Router();

useAnalysis.post(
    "/interaction",
    ...isPermissions.isAuthenticated(),
    addInteraction
);

export {useAnalysis};
