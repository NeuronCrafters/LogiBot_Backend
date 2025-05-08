import { Professor } from "../../models/Professor";

class ListAllProfessorsService {
  async execute() {
    return await Professor.find().select("name email role school courses");
  }
}

export { ListAllProfessorsService };
