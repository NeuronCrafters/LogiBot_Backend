import { SigninGoogleService } from "../../services/google/signinGoogleService";

class SigninGoogleController {
  private service: SigninGoogleService;

  constructor() {
    this.service = new SigninGoogleService();
  }

  async handle(accessToken: string, refreshToken: string, profile: any, done: any) {
    try {
      if (!profile || !profile.id || !profile.emails) {
        return done(null, false, { message: "Perfil do Google inválido." });
      }

      const { user, token, message } = await this.service.login(profile);

      if (!user) {
        return done(null, false, { message });
      }

      return done(null, {
        user,
        token,
        authMethod: "google",
      });
    } catch (error) {

      return done(error);
    }
  }
}

export { SigninGoogleController };
