import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";

class AuthUserController {
  async handle(req: Request, res: Response) {
    const { email, password } = req.body;

    const authUserService = new AuthUserService();
    const result = await authUserService.signin({ email, password });

    return res.json(result);
  }
}

export { AuthUserController };
