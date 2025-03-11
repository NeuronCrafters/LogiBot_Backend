import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Discipline } from "../../models/Discipline";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";

// Listar todas as universidades com cursos e turmas
async function getUniversitiesWithCoursesAndClasses() {
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

// Listar cursos de uma universidade específica
async function getCoursesByUniversityId(universityId: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  const courses = await Course.find({ university: universityId }).lean();
  return courses;
}

// Listar disciplinas de um curso dentro de uma universidade
async function getDisciplinesByCourseId(universityId: string, courseId: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) {
    throw new Error("Curso não encontrado para essa universidade");
  }

  const disciplines = await Discipline.find({ course: courseId }).lean();
  return disciplines;
}

// Listar turmas de um curso dentro de uma universidade
async function getClassesByCourseId(universityId: string, courseId: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) {
    throw new Error("Curso não encontrado para essa universidade");
  }

  const classes = await Class.find({ course: courseId }).lean();
  return classes;
}

// Listar professores vinculados a uma universidade e, opcionalmente, a um curso
async function getProfessorsByUniversityId(universityId: string, courseId?: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  let query = { university: universityId } as any;
  if (courseId) {
    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      throw new Error("Curso não encontrado para essa universidade");
    }
    query.course = courseId;
  }

  const professors = await Professor.find(query).lean();
  return professors;
}

// Listar alunos de uma turma específica que pertence a um curso de uma universidade
async function getStudentsByClassId(universityId: string, courseId: string, classId: string) {
  const university = await University.findById(universityId);
  if (!university) {
    throw new Error("Universidade não encontrada");
  }

  const course = await Course.findOne({ _id: courseId, university: universityId });
  if (!course) {
    throw new Error("Curso não encontrado para essa universidade");
  }

  const classDoc = await Class.findOne({ _id: classId, course: courseId });
  if (!classDoc) {
    throw new Error("Turma não encontrada para esse curso");
  }

  const students = await User.find(
    { class: classId, role: "student" },
    { name: 1, email: 1, status: 1, photo: 1 }
  ).lean();

  return students;
}

export {
  getUniversitiesWithCoursesAndClasses,
  getCoursesByUniversityId,
  getDisciplinesByCourseId,
  getClassesByCourseId,
  getProfessorsByUniversityId,
  getStudentsByClassId,
};