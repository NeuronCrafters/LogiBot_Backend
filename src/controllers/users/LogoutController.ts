import { Request, Response } from "express";
import { LogoutService } from "../../services/users/LogoutUserService";

class LogoutController {
  async handle(req: Request, res: Response) {
    const logoutService = new LogoutService();
    try {
      const result = await logoutService.logout();
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { LogoutController };
