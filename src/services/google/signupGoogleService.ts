import { sign } from 'jsonwebtoken';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';
import domainToSchoolMap from '../../config/socialLogin/domainToSchoolMap.json';

class SignupGoogleService {
  async create(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Email não encontrado no perfil do Google.');
    }

    const emailDomain = email.split('@')[1];
    const school = domainToSchoolMap[emailDomain];
    if (!school) {
      throw new Error('Domínio do email não permitido ou não mapeado.');
    }

    const professor = await Professor.findOne({ school });
    if (!professor) {
      throw new Error('Nenhum professor encontrado para esta escola.');
    }

    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email,
        school,
        photo: profile.photos?.[0]?.value || null,
      });

      professor.students.push(user._id);
      await professor.save();
    }

    const secret = process.env.JWT_SECRET || 'defaultSecret';
    const token = sign({ sub: user.id, role: user.role }, secret, {
      expiresIn: '1h',
    });

    return { user, token };
  }
}

export { SignupGoogleService };
