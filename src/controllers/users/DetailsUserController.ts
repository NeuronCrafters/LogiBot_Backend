import { Request, Response } from "express";
import { DetailsUserService } from "../../services/users/DetailsUserService";

class DetailsUserController {
  async handle(req: Request, res: Response) {
    const user_id = req.user?.id;

    if (!user_id) {
      throw new Error("ID do usuário não encontrado na requisição!");
    }

    const details = new DetailsUserService();
    const user = await details.detailsUser(user_id);

    return res.json(user);
  }
}

export { DetailsUserController };
