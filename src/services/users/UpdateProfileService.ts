import { hash } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { User, IUser } from "../../models/User";

interface UpdateProfileDTO {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
}

class UpdateProfileService {
  async updateProfile({ userId, name, email, password }: UpdateProfileDTO) {

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("Usuário não encontrado!", 404);
    }


    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        throw new AppError("Email já está em uso por outro usuário!", 409);
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (password !== undefined) user.password = await hash(password, 10);

    await user.save();

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

export { UpdateProfileService };