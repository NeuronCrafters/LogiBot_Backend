import { createSqlCompatModel } from "./sqlCompatModel";

export interface IUniversity {
  _id?: string;
  id?: string;
  name: string;
  courses?: string[];
}

export const University = createSqlCompatModel("University");
