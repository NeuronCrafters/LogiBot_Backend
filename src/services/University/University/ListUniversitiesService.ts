import { University } from "../../../models/University";

class ListUniversitiesService {
  async execute() {
    const universities = await University.find().populate("courses", "name");
    return universities;
  }
}

export { ListUniversitiesService };
