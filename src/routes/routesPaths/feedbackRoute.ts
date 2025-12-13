import { Router } from 'express';
import { feedbackController } from '../../controllers/feedback/feedbackController';
import { isAuthenticated } from '../../middlewares/isAuthenticated/isAuthenticated';

const feedbackRoutes = Router();

const controller = new feedbackController();

feedbackRoutes.post(
  '/send',
  isAuthenticated,
  controller.handle
);

export { feedbackRoutes };