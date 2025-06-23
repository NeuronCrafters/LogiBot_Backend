import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Discipline } from "../../models/Discipline";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";

interface UserContext {
    _id: string;
    role: string[];
    school: string;
    course?: string;
    classes?: string[];
    disciplines?: string[];
}

interface AcademicDataResponse {
    universities: Array<{
        _id: string;
        name: string;
        courses: Array<{
            _id: string;
            name: string;
            classes: Array<{
                _id: string;
                name: string;
                disciplines: Array<{
                    _id: string;
                    name: string;
                    code: string;
                }>;
                students: Array<{
                    _id: string;
                    name: string;
                    email: string;
                    status: string;
                    photo?: string;
                    level?: string;
                }>;
            }>;
            disciplines: Array<{
                _id: string;
                name: string;
                code: string;
                classes: Array<{
                    _id: string;
                    name: string;
                }>;
                students: Array<{
                    _id: string;
                    name: string;
                    email: string;
                    status: string;
                    photo?: string;
                    level?: string;
                    class: {
                        _id: string;
                        name: string;
                    };
                }>;
                professors: Array<{
                    _id: string;
                    name: string;
                    email: string;
                    role: string[];
                    photo?: string;
                }>;
            }>;
            professors: Array<{
                _id: string;
                name: string;
                email: string;
                role: string[];
                photo?: string;
                disciplines: Array<{
                    _id: string;
                    name: string;
                    code: string;
                }>;
            }>;
            students: Array<{
                _id: string;
                name: string;
                email: string;
                status: string;
                photo?: string;
                level?: string;
                class: {
                    _id: string;
                    name: string;
                };
                disciplines: Array<{
                    _id: string;
                    name: string;
                    code: string;
                }>;
            }>;
        }>;
    }>;
}

export async function getAcademicDataService(user: UserContext): Promise<AcademicDataResponse> {

    // Define que dados buscar baseado no papel do usuário
    const accessConfig = determineUserAccess(user);

    // Busca universidades baseada no acesso
    const universities = await University.find(accessConfig.universityFilter)
        .populate('courses', 'name')
        .lean();

    const data = await Promise.all(
        universities.map(async (university) => {
            const universityData: any = {
                _id: university._id,
                name: university.name,
                courses: []
            };

            // Busca cursos baseado no acesso do usuário
            const courses = await Course.find({
                university: university._id,
                ...accessConfig.courseFilter
            })
                .populate('classes', 'name')
                .populate('disciplines', 'name code')
                .populate('professors', 'name email role photo')
                .lean();

            universityData.courses = await Promise.all(
                courses.map(async (course) => {
                    const courseData: any = {
                        _id: course._id,
                        name: course.name,
                        classes: [],
                        disciplines: [],
                        professors: [],
                        students: []
                    };

                    // TURMAS - apenas coordenadores e admin podem ver
                    if (accessConfig.canViewClasses) {
                        const classes = await Class.find({
                            course: course._id,
                            ...accessConfig.classFilter
                        })
                            .populate('students', 'name email status photo level')
                            .populate('disciplines', 'name code')
                            .lean();

                        courseData.classes = await Promise.all(
                            classes.map(async (classDoc) => {
                                const classData: any = {
                                    _id: classDoc._id,
                                    name: classDoc.name,
                                    students: [],
                                    disciplines: classDoc.disciplines || []
                                };

                                // Estudantes da turma (com validação de filtro de acesso)
                                if (accessConfig.canViewStudents) {
                                    const studentFilter = {
                                        class: classDoc._id,
                                        role: { $in: ["student"] },
                                        ...accessConfig.studentFilter
                                    };

                                    const students = await User.find(
                                        studentFilter,
                                        { name: 1, email: 1, status: 1, photo: 1, level: 1 }
                                    ).lean();

                                    classData.students = students;
                                }

                                return classData;
                            })
                        );
                    }

                    // DISCIPLINAS - coordenadores e professores podem ver
                    if (accessConfig.canViewDisciplines) {
                        const disciplines = await Discipline.find({
                            course: course._id,
                            ...accessConfig.disciplineFilter
                        })
                            .populate('professors', 'name email role photo')
                            .populate('classes', 'name')
                            .lean();

                        courseData.disciplines = await Promise.all(
                            disciplines.map(async (discipline) => {
                                const disciplineData: any = {
                                    _id: discipline._id,
                                    name: discipline.name,
                                    code: discipline.code,
                                    students: [],
                                    professors: [],
                                    classes: discipline.classes || []
                                };

                                // Professores da disciplina (com filtro de acesso)
                                if (accessConfig.canViewProfessors) {
                                    let professorFilter: any = {
                                        disciplines: discipline._id
                                    };

                                    // Para admin, não aplica filtro por school
                                    if (!user.role.includes('admin') && user.school) {
                                        professorFilter.school = user.school;
                                    }

                                    // Aplica filtros adicionais baseados no access config
                                    if (accessConfig.professorFilter && Object.keys(accessConfig.professorFilter).length > 0) {
                                        professorFilter = { ...professorFilter, ...accessConfig.professorFilter };
                                    }

                                    const professors = await Professor.find(
                                        professorFilter,
                                        { name: 1, email: 1, role: 1, photo: 1 }
                                    ).lean();

                                    disciplineData.professors = professors;
                                }

                                // Estudantes da disciplina (com filtro de acesso)
                                if (accessConfig.canViewStudents) {
                                    const studentFilter = {
                                        disciplines: discipline._id,
                                        role: { $in: ["student"] },
                                        ...accessConfig.studentFilter
                                    };

                                    const students = await User.find(
                                        studentFilter,
                                        { name: 1, email: 1, status: 1, photo: 1, level: 1, class: 1 }
                                    )
                                        .populate('class', 'name')
                                        .lean();

                                    disciplineData.students = students;
                                }

                                return disciplineData;
                            })
                        );
                    }

                    // PROFESSORES DO CURSO - apenas coordenadores e admin podem ver
                    if (accessConfig.canViewProfessors) {
                        let professorFilter: any = {
                            courses: course._id
                        };

                        // Para admin, não aplica filtro por school
                        if (!user.role.includes('admin')) {
                            professorFilter.school = university._id;
                        }

                        // Aplica filtros adicionais baseados no access config
                        if (accessConfig.professorFilter && Object.keys(accessConfig.professorFilter).length > 0) {
                            professorFilter = { ...professorFilter, ...accessConfig.professorFilter };
                        }

                        const professors = await Professor.find(
                            professorFilter,
                            { name: 1, email: 1, role: 1, photo: 1, disciplines: 1 }
                        )
                            .populate('disciplines', 'name code')
                            .lean();

                        courseData.professors = professors;
                    }

                    // ESTUDANTES DO CURSO - coordenadores e professores podem ver
                    if (accessConfig.canViewStudents) {
                        const studentFilter = {
                            course: course._id,
                            role: { $in: ["student"] },
                            ...accessConfig.studentFilter
                        };

                        const students = await User.find(
                            studentFilter,
                            { name: 1, email: 1, status: 1, photo: 1, level: 1, class: 1, disciplines: 1 }
                        )
                            .populate('class', 'name')
                            .populate('disciplines', 'name code')
                            .lean();

                        courseData.students = students;
                    }

                    return courseData;
                })
            );

            return universityData;
        })
    );

    return { universities: data };
}

function determineUserAccess(user: UserContext) {
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
    // if (isProfessor) {
    //     return {
    //         universityFilter: { _id: user.school },
    //         courseFilter: user.course ? { _id: user.course } : {},
    //         classFilter: {},
    //         disciplineFilter: user.disciplines && user.disciplines.length > 0
    //             ? { _id: { $in: user.disciplines } }
    //             : { _id: 'nonexistent' }, // Se não tem disciplinas, não vê nada
    //         studentFilter: user.disciplines && user.disciplines.length > 0
    //             ? { disciplines: { $in: user.disciplines } }
    //             : { _id: 'nonexistent' },
    //         professorFilter: { _id: user._id }, // só ele mesmo nos professores das disciplinas
    //         canViewClasses: false, // professor não vê turmas completas
    //         canViewDisciplines: true,
    //         canViewStudents: true,
    //         canViewProfessors: false, // não pode ver outros professores do curso
    //     };
    // }

    if (isProfessor) {
        return {
            universityFilter: { _id: user.school },
            courseFilter: user.course ? { _id: user.course } : {},
            classFilter: user.classes && user.classes.length
                ? { _id: { $in: user.classes } }
                : { _id: 'nonexistent' },
            disciplineFilter: user.disciplines?.length
                ? { _id: { $in: user.disciplines } }
                : { _id: 'nonexistent' },
            studentFilter: user.disciplines?.length
                ? { disciplines: { $in: user.disciplines } }
                : { _id: 'nonexistent' },
            professorFilter: { _id: user._id },
            canViewClasses: true,                // ← libera turmas
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: false,
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