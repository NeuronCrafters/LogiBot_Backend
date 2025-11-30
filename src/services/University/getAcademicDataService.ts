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
    const accessConfig = determineUserAccess(user);
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

                                if (accessConfig.canViewProfessors) {
                                    let professorFilter: any = {
                                        disciplines: discipline._id
                                    };

                                    if (!user.role.includes('admin') && user.school) {
                                        professorFilter.school = user.school;
                                    }

                                    if (accessConfig.professorFilter && Object.keys(accessConfig.professorFilter).length > 0) {
                                        professorFilter = { ...professorFilter, ...accessConfig.professorFilter };
                                    }

                                    const professors = await Professor.find(
                                        professorFilter,
                                        { name: 1, email: 1, role: 1, photo: 1 }
                                    ).lean();

                                    disciplineData.professors = professors;
                                }

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

                    if (accessConfig.canViewProfessors) {
                        let professorFilter: any = {
                            courses: course._id
                        };

                        if (!user.role.includes('admin')) {
                            professorFilter.school = university._id;
                        }

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

    if (isAdmin) {
        return {
            universityFilter: {},
            courseFilter: {},
            classFilter: {},
            disciplineFilter: {},
            studentFilter: {},
            professorFilter: {},
            canViewClasses: true,
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: true,
        };
    }

    if (isCourseCoordinator) {
        return {
            universityFilter: { _id: user.school },
            courseFilter: user.course ? { _id: user.course } : { _id: { $in: [] } },
            classFilter: {},
            disciplineFilter: {},
            studentFilter: user.course ? { course: user.course } : { _id: { $in: [] } },
            professorFilter: { school: user.school },
            canViewClasses: true,
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: true,
        };
    }

    if (isProfessor) {
        return {
            universityFilter: { _id: user.school },
            courseFilter: user.course ? { _id: user.course } : { _id: { $in: [] } },

            classFilter: user.classes && user.classes.length
                ? { _id: { $in: user.classes } }
                : { _id: { $in: [] } },

            disciplineFilter: user.disciplines?.length
                ? { _id: { $in: user.disciplines } }
                : { _id: { $in: [] } },

            studentFilter: user.disciplines?.length
                ? { disciplines: { $in: user.disciplines } }
                : { _id: { $in: [] } },

            professorFilter: { _id: user._id },
            canViewClasses: true,
            canViewDisciplines: true,
            canViewStudents: true,
            canViewProfessors: false,
        };
    }

    return {
        universityFilter: { _id: { $in: [] } },
        courseFilter: { _id: { $in: [] } },
        classFilter: { _id: { $in: [] } },
        disciplineFilter: { _id: { $in: [] } },
        studentFilter: { _id: { $in: [] } },
        professorFilter: { _id: { $in: [] } },
        canViewClasses: false,
        canViewDisciplines: false,
        canViewStudents: false,
        canViewProfessors: false,
    };
}