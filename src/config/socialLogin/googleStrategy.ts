import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../../models/User";
import { allowedDomains } from "./allowedDomains";

export const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error("Email não encontrado no perfil do Google."), null);
      }

      const emailDomain = email.split("@")[1];
      if (!allowedDomains.includes(emailDomain)) {
        return done(new Error("Domínio do email não permitido."), null);
      }

      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email,
          photo: profile.photos?.[0]?.value || null,
        });
      }

      return done(null, user);
    } catch (error) {
      console.error("Erro na autenticação com o Google:", error);
      return done(error);
    }
  }
);