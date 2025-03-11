import { Request, Response } from "express";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Discipline } from "../../models/Discipline";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";

async function getUniversitiesWithCoursesAndClasses(req: Request, res: Response) {
  try {
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

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar instituições acadêmicas", error });
  }
}

// Listar cursos de uma universidade específica
async function getCoursesByUniversityId(req: Request, res: Response) {
  const { universityId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const courses = await Course.find({ university: universityId }).lean();
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar cursos", error });
  }
}

// Listar disciplinas de um curso dentro de uma universidade
async function getDisciplinesByCourseId(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const disciplines = await Discipline.find({ course: courseId }).lean();
    res.status(200).json(disciplines);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar disciplinas", error });
  }
}

// Listar turmas de um curso dentro de uma universidade
async function getClassesByCourseId(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const classes = await Class.find({ course: courseId }).lean();
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar turmas", error });
  }
}

// Listar professores vinculados a uma universidade e, opcionalmente, a um curso
async function getProfessorsByUniversityId(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    let query = { university: universityId } as any;
    if (courseId) {
      const course = await Course.findOne({ _id: courseId, university: universityId });
      if (!course) {
        return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
      }
      query.course = courseId;
    }

    const professors = await Professor.find(query).lean();
    res.status(200).json(professors);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar professores", error });
  }
}

// Listar alunos de uma turma específica que pertence a um curso de uma universidade
async function getStudentsByClassId(req: Request, res: Response) {
  const { universityId, courseId, classId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const classDoc = await Class.findOne({ _id: classId, course: courseId });
    if (!classDoc) {
      return res.status(404).json({ message: "Turma não encontrada para esse curso" });
    }

    const students = await User.find(
      { class: classId, role: "student" },
      { name: 1, email: 1, status: 1, photo: 1 }
    ).lean();

    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos", error });
  }
}

// Listar alunos de uma disciplina específica dentro de um curso e universidade
async function getStudentsByDisciplineId(req: Request, res: Response) {
  const { universityId, courseId, disciplineId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const discipline = await Discipline.findOne({ _id: disciplineId, course: courseId });
    if (!discipline) {
      return res.status(404).json({ message: "Disciplina não encontrada para esse curso" });
    }

    const students = await User.find(
      { disciplines: disciplineId, role: "student" },
      { name: 1, email: 1, status: 1, photo: 1 }
    ).lean();

    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos da disciplina", error });
  }
}

// Listar todos os alunos de um curso dentro de uma universidade
async function getStudentsByCourseId(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const students = await User.find(
      { course: courseId, role: "student" },
      { name: 1, email: 1, status: 1, photo: 1 }
    ).lean();

    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos do curso", error });
  }
}


export {
  getUniversitiesWithCoursesAndClasses,
  getCoursesByUniversityId,
  getDisciplinesByCourseId,
  getClassesByCourseId,
  getProfessorsByUniversityId,
  getStudentsByClassId,
  getStudentsByDisciplineId,
  getStudentsByCourseId
};