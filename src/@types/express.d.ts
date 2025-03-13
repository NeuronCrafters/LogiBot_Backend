declare namespace Express {
  export interface Request {
    user: {
      id: string;
      name: string;
      email: string;
      role: string[];
      school: string | null;
    };
    useragent?: useragent.Details;
  }
}
