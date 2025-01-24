import { User, IUser } from "../../models/User";
import { Professor, IProfessor } from "../../models/Professor";

export const findUserByEmail = async (email: string): Promise<IUser | IProfessor | null> => {
  const user = await User.findOne({ email });
  if (user) {
    return user as IUser;
  }

  const professor = await Professor.findOne({ email });
  if (professor) {
    return professor as IProfessor;
  }

  return null;
};
