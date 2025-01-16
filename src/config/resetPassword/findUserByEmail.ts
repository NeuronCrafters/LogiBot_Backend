import { User, IUser } from "../../models/User";
import { Professor, IProfessor } from "../../models/Professor";

export const findUserByEmail = async (
  email: string,
  model: "User" | "Professor"
): Promise<IUser | IProfessor | null> => {

  if (model === "User") {
    return await User.findOne({ email }) as IUser | null;
  } else {
    return await Professor.findOne({ email }) as IProfessor | null;
  }
};
