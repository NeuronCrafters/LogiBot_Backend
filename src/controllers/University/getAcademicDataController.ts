import { Request, Response } from "express";
import { getAcademicDataService } from "../../services/University/getAcademicDataService";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        role: string[];
        school: string | null;
    };
}

export async function getAcademicDataController(req: AuthenticatedRequest, res: Response) {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Usuário não autenticado",
                code: "NOT_AUTHENTICATED"
            });
        }

        const userData = await getUserCompleteData(req.user.id, req.user.role);

        if (!userData) {
            return res.status(404).json({
                message: "Dados do usuário não encontrados",
                code: "USER_DATA_NOT_FOUND"
            });
        }

        console.log(`[AcademicData] Usuário ${userData._id} (${userData.role.join(', ')}) acessando dados acadêmicos`);

        const data = await getAcademicDataService(userData);

        const summary = calculateDataSummary(data, userData.role);

        res.status(200).json({
            success: true,
            data,
            summary,
            user: {
                _id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                permissions: getUserPermissions(req.user.role),
                accessLevel: getAccessLevel(req.user.role),
                context: {
                    school: userData.school,
                    course: userData.course,
                    disciplines: userData.disciplines?.length || 0
                }
            },
            meta: {
                timestamp: new Date().toISOString(),
                version: "2.0",
                source: "academic-data-service"
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dados acadêmicos:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Dados de entrada inválidos",
                code: "VALIDATION_ERROR",
                details: error.message
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                message: "ID inválido fornecido",
                code: "INVALID_ID",
                details: error.message
            });
        }

        res.status(500).json({
            message: "Erro interno do servidor",
            code: "INTERNAL_ERROR",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

async function getUserCompleteData(userId: string, roles: string[]) {
    try {
        const isProfessor = roles.includes('professor') || roles.includes('course-coordinator');
        const isAdmin = roles.includes('admin');

        if (isAdmin) {
            return {
                _id: userId,
                role: roles,
                school: '',
                course: undefined,
                class: undefined,
                disciplines: undefined
            };
        }

        if (isProfessor) {
            const professor = await Professor.findById(userId)
                .populate('school', 'name')
                .populate('courses', 'name')
                .populate('disciplines', 'name code')
                .lean();

            if (!professor) {
                console.warn(`Professor não encontrado: ${userId}`);
                return null;
            }

            return {
                _id: userId,
                role: roles,
                school: professor.school._id.toString(),
                course: professor.courses?.[0]?._id?.toString(),
                classes: professor.classes?.map(c => c.toString()) || [],
                disciplines: professor.disciplines?.map(d => d._id.toString()) || []
            };
        } else {
            console.warn(`Estudante tentando acessar dados acadêmicos: ${userId}`);
            return null;
        }
    } catch (error) {
        console.error('Erro ao buscar dados completos do usuário:', error);
        return null;
    }
}

function calculateDataSummary(data: any, userRoles: string[]) {
    const summary = {
        universities: 0,
        courses: 0,
        classes: 0,
        disciplines: 0,
        professors: 0,
        students: 0,
        userLevel: getAccessLevel(userRoles)
    };

    data.universities.forEach((university: any) => {
        summary.universities++;

        university.courses.forEach((course: any) => {
            summary.courses++;
            summary.classes += course.classes?.length || 0;
            summary.disciplines += course.disciplines?.length || 0;
            summary.professors += course.professors?.length || 0;
            summary.students += course.students?.length || 0;
        });
    });

    return summary;
}

function getUserPermissions(roles: string[]) {
    const isAdmin = roles.includes('admin');
    const isCourseCoordinator = roles.includes('course-coordinator');
    const isProfessor = roles.includes('professor');

    return {
        canViewAllUniversities: isAdmin,
        canViewAllCourses: isAdmin,
        canViewOwnCourse: isCourseCoordinator || isProfessor,
        canViewClasses: isAdmin || isCourseCoordinator,
        canViewDisciplines: isAdmin || isCourseCoordinator || isProfessor,
        canViewStudents: isAdmin || isCourseCoordinator || isProfessor,
        canViewProfessors: isAdmin || isCourseCoordinator,
        canViewAnalytics: isAdmin || isCourseCoordinator,
        canExportData: isAdmin || isCourseCoordinator,
        canCreateCourse: isAdmin,
        canEditCourse: isAdmin || isCourseCoordinator,
        canCreateClass: isAdmin || isCourseCoordinator,
        canEditClass: isAdmin || isCourseCoordinator,
        canCreateDiscipline: isAdmin || isCourseCoordinator,
        canEditDiscipline: isAdmin || isCourseCoordinator,
        canManageStudents: isAdmin || isCourseCoordinator,
        canManageProfessors: isAdmin || isCourseCoordinator,
        canAssignProfessors: isAdmin || isCourseCoordinator,
        canManageEnrollments: isAdmin || isCourseCoordinator,
        canGenerateReports: isAdmin || isCourseCoordinator,
        canViewDetailedAnalytics: isAdmin || isCourseCoordinator,
        canExportStudentData: isAdmin || isCourseCoordinator,
        canViewOwnDisciplines: isProfessor,
        canManageOwnDisciplineStudents: isProfessor,
        canViewStudentProgress: isProfessor || isCourseCoordinator || isAdmin
    };
}

function getAccessLevel(roles: string[]): string {
    if (roles.includes('admin')) return 'ADMIN';
    if (roles.includes('course-coordinator')) return 'COORDINATOR';
    if (roles.includes('professor')) return 'PROFESSOR';
    return 'NO_ACCESS';
}