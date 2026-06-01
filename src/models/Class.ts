import { createSqlCompatModel } from "./sqlCompatModel";

export interface IClass {
  _id?: string;
  id?: string;
  name: string;
  course: string;
  students?: string[];
  disciplines?: string[];
}

export const Class = createSqlCompatModel("Class");
