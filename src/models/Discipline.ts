import { createSqlCompatModel } from "./sqlCompatModel";

export interface IDiscipline {
  _id?: string;
  id?: string;
  name: string;
  course: string;
  classes?: string[];
  professors?: string[];
  students?: string[];
  code: string;
}

export const Discipline = createSqlCompatModel("Discipline");
