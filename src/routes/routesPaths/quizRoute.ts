import { Router } from 'express';
import {
  listLevelsController,
  setLevelController,
  listSubcategoriesController,
  generateQuizController,
  verifyQuizController
} from '../../controllers/bot/quiz/quizController';
import { isAuthenticated } from '../../middlewares/isAuthenticated/isAuthenticated';

const quizRouter = Router();

quizRouter.get('/levels', isAuthenticated, listLevelsController);

quizRouter.post('/set-level', isAuthenticated, setLevelController);

quizRouter.post('/subcategories', isAuthenticated, listSubcategoriesController);

quizRouter.post('/generate', isAuthenticated, generateQuizController);

quizRouter.post('/verify', isAuthenticated, verifyQuizController);

export { quizRouter };