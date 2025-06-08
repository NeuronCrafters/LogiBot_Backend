declare namespace Express {
  export interface Request {
    user: {
      id: string;
      name: string;
      email: string;
      role: string[];
      school: string | null;
      courses?: string[] | string | null;
      classes?: string[] | string | null;
    };
    useragent?: useragent.Details;
  }
}
