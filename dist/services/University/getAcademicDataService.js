"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAcademicDataService = getAcademicDataService;
const University_1 = require("../../models/University");
const Course_1 = require("../../models/Course");
const Class_1 = require("../../models/Class");
const Discipline_1 = require("../../models/Discipline");
const Professor_1 = require("../../models/Professor");
const User_1 = require("../../models/User");
function getAcademicDataService(user) {
    return __awaiter(this, void 0, void 0, function* () {
        // Define que dados buscar baseado no papel do usuário
        const accessConfig = determineUserAccess(user);
        // Busca universidades baseada no acesso
        const universities = yield University_1.University.find(accessConfig.universityFilter)
            .populate('courses', 'name')
            .lean();
        const data = yield Promise.all(universities.map((university) => __awaiter(this, void 0, void 0, function* () {
            const universityData = {
                _id: university._id,
                name: university.name,
                courses: []
            };
            // Busca cursos baseado no acesso do usuário
            const courses = yield Course_1.Course.find(Object.assign({ university: university._id }, accessConfig.courseFilter))
                .populate('classes', 'name')
                .populate('disciplines', 'name code')
                .populate('professors', 'name email role photo')
                .lean();
            universityData.courses = yield Promise.all(courses.map((course) => __awaiter(this, void 0, void 0, function* () {
                const courseData = {
                    _id: course._id,
                    name: course.name,
                    classes: [],
                    disciplines: [],
                    professors: [],
                    students: []
                };
                // TURMAS - apenas coordenadores e admin podem ver
                if (accessConfig.canViewClasses) {
                    const classes = yield Class_1.Class.find(Object.assign({ course: course._id }, accessConfig.classFilter))
                        .populate('students', 'name email status photo level')
                        .populate('disciplines', 'name code')
                        .lean();
                    courseData.classes = yield Promise.all(classes.map((classDoc) => __awaiter(this, void 0, void 0, function* () {
                        const classData = {
                            _id: classDoc._id,
                            name: classDoc.name,
                            students: [],
                            disciplines: classDoc.disciplines || []
                        };
                        // Estudantes da turma (com validação de filtro de acesso)
                        if (accessConfig.canViewStudents) {
                            const studentFilter = Object.assign({ class: classDoc._id, role: { $in: ["student"] } }, accessConfig.studentFilter);
                            const students = yield User_1.User.find(studentFilter, { name: 1, email: 1, status: 1, photo: 1, level: 1 }).lean();
                            classData.students = students;
                        }
                        return classData;
                    })));
                }
                // DISCIPLINAS - coordenadores e professores podem ver
                if (accessConfig.canViewDisciplines) {
                    const disciplines = yield Discipline_1.Discipline.find(Object.assign({ course: course._id }, accessConfig.disciplineFilter))
                        .populate('professors', 'name email role photo')
                        .populate('classes', 'name')
                        .lean();
                    courseData.disciplines = yield Promise.all(disciplines.map((discipline) => __awaiter(this, void 0, void 0, function* () {
                        const disciplineData = {
                            _id: discipline._id,
                            name: discipline.name,
                            code: discipline.code,
                            students: [],
                            professors: [],
                            classes: discipline.classes || []
                        };
                        // Professores da disciplina (com filtro de acesso)
                        if (accessConfig.canViewProfessors) {
                            let professorFilter = {
                                disciplines: discipline._id
                            };
                            // Para admin, não aplica filtro por school
                            if (!user.role.includes('admin') && user.school) {
                                professorFilter.school = user.school;
                            }
                            // Aplica filtros adicionais baseados no access config
                            if (accessConfig.professorFilter && Object.keys(accessConfig.professorFilter).length > 0) {
                                professorFilter = Object.assign(Object.assign({}, professorFilter), accessConfig.professorFilter);
                            }
                            const professors = yield Professor_1.Professor.find(professorFilter, { name: 1, email: 1, role: 1, photo: 1 }).lean();
                            disciplineData.professors = professors;
                        }
                        // Estudantes da disciplina (com filtro de acesso)
                        if (accessConfig.canViewStudents) {
                            const studentFilter = Object.assign({ disciplines: discipline._id, role: { $in: ["student"] } }, accessConfig.studentFilter);
                            const students = yield User_1.User.find(studentFilter, { name: 1, email: 1, status: 1, photo: 1, level: 1, class: 1 })
                                .populate('class', 'name')
                                .lean();
                            disciplineData.students = students;
                        }
                        return disciplineData;
                    })));
                }
                // PROFESSORES DO CURSO - apenas coordenadores e admin podem ver
                if (accessConfig.canViewProfessors) {
                    let professorFilter = {
                        courses: course._id
                    };
                    // Para admin, não aplica filtro por school
                    if (!user.role.includes('admin')) {
                        professorFilter.school = university._id;
                    }
                    // Aplica filtros adicionais baseados no access config
                    if (accessConfig.professorFilter && Object.keys(accessConfig.professorFilter).length > 0) {
                        professorFilter = Object.assign(Object.assign({}, professorFilter), accessConfig.professorFilter);
                    }
                    const professors = yield Professor_1.Professor.find(professorFilter, { name: 1, email: 1, role: 1, photo: 1, disciplines: 1 })
                        .populate('disciplines', 'name code')
                        .lean();
                    courseData.professors = professors;
                }
                // ESTUDANTES DO CURSO - coordenadores e professores podem ver
                if (accessConfig.canViewStudents) {
                    const studentFilter = Object.assign({ course: course._id, role: { $in: ["student"] } }, accessConfig.studentFilter);
                    const students = yield User_1.User.find(studentFilter, { name: 1, email: 1, status: 1, photo: 1, level: 1, class: 1, disciplines: 1 })
                        .populate('class', 'name')
                        .populate('disciplines', 'name code')
                        .lean();
                    courseData.students = students;
                }
                return courseData;
            })));
            return universityData;
        })));
        return { universities: data };
    });
}
function determineUserAccess(user) {
    const isAdmin = user.role.includes('admin');
    const isCourseCoordinator = user.role.includes('course-coordinator');
    const isProfessor = user.role.includes('professor');
    // ADMIN - pode ver tudo, sem filtros
    if (isAdmin) {
        return {
            universityFilter: {},
            courseFilter: {},
            classFilter: {},
            disciplineFilter: {},
            studentFilter: {},
            professorFilter: {}, // Remove filtro por school para admin
            canViewClasses: true,
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: true,
        };
    }
    // COORDENADOR DE CURSO - pode ver dados do seu curso
    if (isCourseCoordinator) {
        return {
            universityFilter: { _id: user.school },
            courseFilter: user.course ? { _id: user.course } : {},
            classFilter: {},
            disciplineFilter: {},
            studentFilter: user.course ? { course: user.course } : {},
            professorFilter: { school: user.school },
            canViewClasses: true,
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: true,
        };
    }
    // PROFESSOR - pode ver dados das disciplinas que leciona
    if (isProfessor) {
        return {
            universityFilter: { _id: user.school },
            courseFilter: user.course ? { _id: user.course } : {},
            classFilter: {},
            disciplineFilter: user.disciplines && user.disciplines.length > 0
                ? { _id: { $in: user.disciplines } }
                : { _id: 'nonexistent' }, // Se não tem disciplinas, não vê nada
            studentFilter: user.disciplines && user.disciplines.length > 0
                ? { disciplines: { $in: user.disciplines } }
                : { _id: 'nonexistent' },
            professorFilter: { _id: user._id }, // só ele mesmo nos professores das disciplinas
            canViewClasses: false, // professor não vê turmas completas
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: false, // não pode ver outros professores do curso
        };
    }
    // ESTUDANTE - SEM ACESSO a dados acadêmicos
    // Fallback - sem acesso (inclui estudantes e qualquer role não autorizado)
    return {
        universityFilter: { _id: 'nonexistent' },
        courseFilter: { _id: 'nonexistent' },
        classFilter: { _id: 'nonexistent' },
        disciplineFilter: { _id: 'nonexistent' },
        studentFilter: { _id: 'nonexistent' },
        professorFilter: { _id: 'nonexistent' },
        canViewClasses: false,
        canViewDisciplines: false,
        canViewStudents: false,
        canViewProfessors: false,
    };
}
