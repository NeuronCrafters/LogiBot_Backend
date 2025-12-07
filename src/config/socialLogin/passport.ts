import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

passport.serializeUser((user: any, done) => {
  done(null, { id: user.id, type: user.type });
});

passport.deserializeUser(async (data: any, done) => {
  try {
    let user;
    if (data.type === "professor") {
      user = await Professor.findById(data.id);
    } else {
      user = await User.findById(data.id);
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const name = profile.displayName;

          console.log("autenticação google iniciada para:", email);

          if (!email) {
            console.log("email não fornecido pelo google");
            return done(new Error("email não fornecido pelo google"), undefined);
          }

          let user = await Professor.findOne({
            $or: [{ googleId }, { email }]
          });

          let userType = "professor";

          if (!user) {
            user = await User.findOne({
              $or: [{ googleId }, { email }]
            });
            userType = "student";
          }

          if (!user) {
            console.log("usuário não cadastrado no sistema:", email);
            return done(new Error("usuário não cadastrado no sistema"), undefined);
          }

          if (user.status !== "active") {
            console.log("conta inativa:", email);
            return done(new Error("conta inativa"), undefined);
          }

          if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
            console.log("googleid vinculado ao usuário:", email);
          }

          console.log("autenticação google bem-sucedida:", email);
          return done(null, { ...user.toObject(), type: userType });
        } catch (error) {
          console.error("erro na estratégia do google:", error);
          return done(error, undefined);
        }
      }
    )
  );
}

export default passport;