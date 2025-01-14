import passport from "passport";
import { googleStrategy } from "./googleStrategy";
import { User } from "../../models/User";

passport.use(googleStrategy);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return done(new Error("Usuário não encontrado durante a deserialização."), null);
    }
    done(null, user);
  } catch (error) {
    console.error("Erro ao desserializar o usuário:", error);
    done(error, null);
  }
});
