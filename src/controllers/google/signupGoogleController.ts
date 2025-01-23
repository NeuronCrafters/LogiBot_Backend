import { SignupGoogleService } from "../../services/google/signupGoogleService";

class SignupGoogleController {
  private service: SignupGoogleService;

  constructor() {
    this.service = new SignupGoogleService();
  }

  async handle(accessToken: string, refreshToken: string, profile: any, done: any) {
    try {
      const { user, token } = await this.service.create(profile);
      return done(null, { user, token });
    } catch (error) {
      console.error('Erro no controlador de cadastro com Google:', error);
      return done(error);
    }
  }
}

export { SignupGoogleController };
