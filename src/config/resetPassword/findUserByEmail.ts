import { User, IUser } from "../../models/User";
import { Professor, IProfessor } from "../../models/Professor";

/**
 * Busca usuário (User ou Professor) pelo e-mail.
 */
export const findUserByEmail = async (email: string): Promise<IUser | IProfessor | null> => {
  if (!email) return null;

  const user = await User.findOne({ email });
  if (user) return user as IUser;

  const professor = await Professor.findOne({ email });
  if (professor) return professor as IProfessor;

  return null;
};
