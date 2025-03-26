import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";

export async function getUniversitiesWithCoursesAndClassesService() {
  const universities = await University.find().lean();

  const data = await Promise.all(
    universities.map(async (university) => {
      const courses = await Course.find({ university: university._id }).lean();
      const coursesWithClasses = await Promise.all(
        courses.map(async (course) => {
          const classes = await Class.find({ course: course._id }).lean();
          return {
            _id: course._id,
            name: course.name,
            classes: classes.map(cls => ({ _id: cls._id, name: cls.name })),
          };
        })
      );

      return {
        _id: university._id,
        name: university.name,
        courses: coursesWithClasses,
      };
    })
  );

  return data;
}
