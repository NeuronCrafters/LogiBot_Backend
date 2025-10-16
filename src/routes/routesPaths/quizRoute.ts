// src/routes/routesPaths/quizRoute.ts

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

// Endpoint para a tela inicial de escolha de nível
quizRouter.get('/levels', isAuthenticated, listLevelsController);

// Endpoint para definir o nível e já receber as categorias
quizRouter.post('/set-level', isAuthenticated, setLevelController);

// Endpoint para enviar uma categoria e receber as subcategorias
quizRouter.post('/subcategories', isAuthenticated, listSubcategoriesController);

// Endpoint para enviar uma subcategoria e receber as perguntas do quiz
quizRouter.post('/generate', isAuthenticated, generateQuizController);

// Endpoint para enviar as respostas e receber o resultado
quizRouter.post('/verify', isAuthenticated, verifyQuizController);

export { quizRouter };