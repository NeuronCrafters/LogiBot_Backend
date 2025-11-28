import { User } from "../../../models/User";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

type UserStatus = "active" | "inactive" | "graduated" | "dropped";

export class UpdateUserStatusService {
  public async execute(userId: string, status: UserStatus): Promise<any> {
    // validação de entrada
    if (!status) {
      throw new AppError("o novo status é obrigatório.", 400);
    }
    if (!["active", "inactive", "graduated", "dropped"].includes(status)) {
      throw new AppError("status fornecido é inválido.", 400);
    }

    // tenta encontrar o usuário primeiro no modelo User (alunos, admins)
    let user: any = await User.findById(userId);

    // se não encontrar, tenta no modelo Professor
    if (!user) {
      user = await Professor.findById(userId);
    }

    // se não encontrou em nenhum dos dois modelos, lança um erro
    if (!user) {
      throw new AppError("usuário não encontrado.", 404);
    }

    // atualiza o status e salva o documento
    user.status = status;
    await user.save();

    // retorna o usuário atualizado (sem a senha, por segurança)
    user.password = undefined;
    return user;
  }
}