import { createSqlCompatModel } from "./sqlCompatModel";

export interface ICourse {
  _id?: string;
  id?: string;
  name: string;
  university: string;
  classes?: string[];
  professors?: string[];
  disciplines?: string[];
}

export const Course = createSqlCompatModel("Course");
