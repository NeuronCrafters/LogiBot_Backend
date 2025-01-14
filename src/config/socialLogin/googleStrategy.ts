import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { sign } from 'jsonwebtoken';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';
import domainToSchoolMap from './domainToSchoolMap.json';

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('Email não encontrado no perfil do Google.'), null);
      }

      const emailDomain = email.split('@')[1];

      // Verifique se o domínio é permitido e mapeie para a escola
      if (!domainToSchoolMap[emailDomain]) {
        return done(new Error('Domínio do email não permitido ou não mapeado.'), null);
      }

      const school = domainToSchoolMap[emailDomain];

      // Verifique se existe um professor associado à escola
      const professor = await Professor.findOne({ school });
      if (!professor) {
        return done(new Error('Nenhum professor encontrado para esta escola.'), null);
      }

      // Verifique se o usuário já existe
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        // Crie o novo usuário
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email,
          school,
          photo: profile.photos?.[0]?.value || null,
        });

        // Vincule o aluno ao professor
        professor.students.push(user._id);
        await professor.save();
      }

      const secret = process.env.JWT_SECRET || 'defaultSecret';
      const token = sign(
        { sub: user.id, role: user.role },
        secret,
        { expiresIn: '1h' }
      );

      return done(null, { user, token });
    } catch (error) {
      console.error('Erro na autenticação com o Google:', error);
      return done(error);
    }
  }
);

export { googleStrategy };
