import { sign } from 'jsonwebtoken';
import { User } from '../../models/User';

class SigninGoogleService {
  async login(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Email não encontrado no perfil do Google.');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return { user: null, token: null, message: 'Usuário não encontrado.' };
    }

    const secret = process.env.JWT_SECRET || 'defaultSecret';
    const token = sign({ sub: user.id, role: user.role }, secret, {
      expiresIn: '1h',
    });

    return { user, token, message: null };
  }
}

export { SigninGoogleService };
