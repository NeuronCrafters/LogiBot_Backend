declare namespace Express {
  export interface Request {
    language?: import("../i18n").Language;
    user?: {
      id: string;
      name: string;
      email: string;
      role: string[];
      school: string | null;
      preferredLanguage?: string | null;
      courses?: string[] | string | null;
      classes?: string[] | string | null;
      disciplines?: string[];
    };
    useragent?: useragent.Details;
  }
}
