import { SigninGoogleService } from "../../services/google/signinGoogleService";

class SigninGoogleController {
  private service: SigninGoogleService;

  constructor() {
    this.service = new SigninGoogleService();
  }

  async handle(accessToken: string, refreshToken: string, profile: any, done: any) {
    try {
      const { user, token, message } = await this.service.login(profile);

      if (!user) {
        return done(null, false, { message });
      }

      return done(null, { user, token });
    } catch (error) {
      console.error('Erro no controlador de login com Google:', error);
      return done(error);
    }
  }
}

export { SigninGoogleController };
