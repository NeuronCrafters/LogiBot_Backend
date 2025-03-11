import { Router } from "express";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Discipline } from "../../models/Discipline";
import { Professor } from "../../models/Professor";

const publicAcademicRoute = Router();

/** listar todas as universidades com cursos e turmas */
publicAcademicRoute.get("/institutions", async (req, res) => {
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
});

/** listar disciplinas de um curso dentro de uma universidade */
publicAcademicRoute.get("/disciplines/:universityId/:courseId", async (req, res) => {
  const { universityId, courseId } = req.params;

  try {
    const courseExists = await Course.findOne({ _id: courseId, university: universityId });
    if (!courseExists) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const disciplines = await Discipline.find({ course: courseId });
    res.status(200).json(disciplines);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar disciplinas", error });
  }
});

/** listar turmas de um curso dentro de uma universidade */
publicAcademicRoute.get("/classes/:universityId/:courseId", async (req, res) => {
  const { universityId, courseId } = req.params;

  try {
    const courseExists = await Course.findOne({ _id: courseId, university: universityId });
    if (!courseExists) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const classes = await Class.find({ course: courseId });
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar turmas", error });
  }
});

/** listar professores vinculados a uma universidade */
publicAcademicRoute.get("/professors/:universityId", async (req, res) => {
  const { universityId } = req.params;

  try {
    const universityExists = await University.findById(universityId);
    if (!universityExists) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const professors = await Professor.find({ university: universityId });
    res.status(200).json(professors);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar professores", error });
  }
});

export { publicAcademicRoute };
