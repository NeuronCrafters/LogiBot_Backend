import { Router } from "express";
import { addInteraction } from "controllers/userAnalysis/userAnalysisController";
import {categoryClicksController} from "@/controllers/userAnalysis/CategoryClicksController";
import { isPermissions } from "middlewares/isPermissions/isPermissions";

const useAnalysis = Router();

useAnalysis.post(
    "/interaction",
    ...isPermissions.isAuthenticated(),
    addInteraction
);

useAnalysis.post(
    "/subject-clicks",
    ...isPermissions.isAuthenticated(),
    categoryClicksController
);

export {useAnalysis};
