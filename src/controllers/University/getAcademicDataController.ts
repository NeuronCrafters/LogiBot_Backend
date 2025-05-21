import { Request, Response } from "express";
import { getAcademicDataService } from "../../services/University/getAcademicDataService";
import { Professor } from "../../models/Professor";
import { User } from "../../models/User";

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        email: string;
        role: string[];
        school: string;
        course?: string;
        class?: string;
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

        // Verifica se o usuário tem permissão para acessar dados acadêmicos
        const hasAccess = checkAcademicDataAccess(req.user.role);

        if (!hasAccess.allowed) {
            return res.status(403).json({
                message: hasAccess.message,
                code: "ACCESS_DENIED",
                allowedRoles: ["admin", "course-coordinator", "professor"]
            });
        }

        // Busca dados completos do usuário para ter todas as informações necessárias
        const userData = await getUserCompleteData(req.user._id, req.user.role);

        if (!userData) {
            return res.status(404).json({
                message: "Dados do usuário não encontrados",
                code: "USER_DATA_NOT_FOUND"
            });
        }

        // Log para debug (remover em produção)
        console.log(`[AcademicData] Usuário ${userData._id} (${userData.role.join(', ')}) acessando dados acadêmicos`);

        // Chama o service com os dados completos do usuário
        const data = await getAcademicDataService(userData);

        // Conta totais para incluir no retorno
        const summary = calculateDataSummary(data, userData.role);

        // Retorna dados com informações completas para o frontend
        res.status(200).json({
            success: true,
            data,
            summary,
            user: {
                _id: req.user._id,
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

        // Tratamento de erros específicos
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

function checkAcademicDataAccess(roles: string[]) {
    const allowedRoles = ['admin', 'course-coordinator', 'professor'];
    const hasAllowedRole = allowedRoles.some(role => roles.includes(role));

    if (!hasAllowedRole) {
        return {
            allowed: false,
            message: "Acesso negado. Apenas administradores, coordenadores e professores podem acessar dados acadêmicos."
        };
    }

    return { allowed: true };
}

async function getUserCompleteData(userId: string, roles: string[]) {
    try {
        // Determina se é professor ou estudante baseado nos roles
        const isProfessor = roles.includes('professor') || roles.includes('course-coordinator');
        const isAdmin = roles.includes('admin');

        if (isAdmin) {
            // Admin pode ter dados básicos - sem restrições específicas
            return {
                _id: userId,
                role: roles,
                school: '', // Admin pode acessar todas as escolas
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
                course: professor.courses?.[0]?._id?.toString(), // Primeiro curso (pode ter múltiplos)
                class: undefined, // Professores não têm turma específica
                disciplines: professor.disciplines?.map(d => d._id.toString()) || []
            };
        } else {
            // Estudante (não deveria chegar aqui devido ao checkAccess, mas por segurança)
            const student = await User.findById(userId)
                .populate('school', 'name')
                .populate('course', 'name')
                .populate('class', 'name')
                .populate('disciplines', 'name code')
                .lean();

            if (!student) {
                console.warn(`Estudante não encontrado: ${userId}`);
                return null;
            }

            return {
                _id: userId,
                role: roles,
                school: student.school._id.toString(),
                course: student.course._id.toString(),
                class: student.class._id.toString(),
                disciplines: student.disciplines?.map(d => d._id.toString()) || []
            };
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
        // Permissões de visualização
        canViewAllUniversities: isAdmin,
        canViewAllCourses: isAdmin,
        canViewOwnCourse: isCourseCoordinator || isProfessor,
        canViewClasses: isAdmin || isCourseCoordinator,
        canViewDisciplines: isAdmin || isCourseCoordinator || isProfessor,
        canViewStudents: isAdmin || isCourseCoordinator || isProfessor,
        canViewProfessors: isAdmin || isCourseCoordinator,
        canViewAnalytics: isAdmin || isCourseCoordinator,
        canExportData: isAdmin || isCourseCoordinator,

        // Permissões de gestão (para futuras funcionalidades)
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

        // Permissões de relatórios
        canGenerateReports: isAdmin || isCourseCoordinator,
        canViewDetailedAnalytics: isAdmin || isCourseCoordinator,
        canExportStudentData: isAdmin || isCourseCoordinator,

        // Permissões específicas de professor
        canViewOwnDisciplines: isProfessor,
        canManageOwnDisciplineStudents: isProfessor,
        canViewStudentProgress: isProfessor || isCourseCoordinator || isAdmin
    };
}

function getAccessLevel(roles: string[]): string {
    if (roles.includes('admin')) return 'ADMIN';
    if (roles.includes('course-coordinator')) return 'COORDINATOR';
    if (roles.includes('professor')) return 'PROFESSOR';
    return 'NO_ACCESS'; // Estudantes e outros não têm acesso
}

// middlewares/authMiddleware.ts (versão atualizada e otimizada)
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Professor } from '../models/Professor';

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        email: string;
        role: string[];
        school: string;
        course?: string;
        class?: string;
    };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            message: 'Token de acesso requerido',
            code: 'NO_TOKEN'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Cache de usuário simples (pode implementar Redis depois)
        let user = null;
        let isProfessor = false;

        // Primeiro tenta buscar como usuário (estudante)
        user = await User.findById(decoded.userId)
            .select('-password')
            .populate('school', 'name')
            .lean();

        // Se não encontrar como estudante, busca como professor
        if (!user) {
            user = await Professor.findById(decoded.userId)
                .select('-password')
                .populate('school', 'name')
                .lean();
            isProfessor = true;
        }

        if (!user) {
            return res.status(401).json({
                message: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        // Para estudantes, verifica se está ativo
        if (!isProfessor && user.status !== 'active') {
            return res.status(401).json({
                message: 'Usuário inativo',
                code: 'USER_INACTIVE'
            });
        }

        // Normaliza roles para sempre ser array
        const userRoles = Array.isArray(user.role) ? user.role : [user.role];

        req.user = {
            _id: user._id.toString(),
            email: user.email,
            role: userRoles,
            school: user.school?._id?.toString() || user.school?.toString() || '',
            course: user.course?.toString(),
            class: isProfessor ? undefined : user.class?.toString()
        };

        // Log de acesso (remover em produção)
        console.log(`[Auth] Usuário autenticado: ${req.user._id} (${userRoles.join(', ')})`);

        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                message: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        return res.status(403).json({
            message: 'Falha na autenticação',
            code: 'AUTH_FAILED'
        });
    }
}

// Middleware para verificar roles específicos
export function requireRole(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Usuário não autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        const hasRequiredRole = allowedRoles.some(role => req.user?.role.includes(role));

        if (!hasRequiredRole) {
            return res.status(403).json({
                message: 'Acesso negado. Permissão insuficiente.',
                code: 'INSUFFICIENT_PERMISSION',
                requiredRoles: allowedRoles,
                userRoles: req.user.role
            });
        }

        next();
    };
}

// Middleware para validar acesso específico (opcional)
export function validateResourceAccess(resourceType: 'university' | 'course' | 'class' | 'discipline') {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Usuário não autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Admin sempre tem acesso
        if (req.user.role.includes('admin')) {
            return next();
        }

        // Validações específicas por tipo de recurso
        const { universityId, courseId, classId, disciplineId } = req.params;

        switch (resourceType) {
            case 'university':
                if (universityId && universityId !== req.user.school) {
                    return res.status(403).json({
                        message: 'Acesso negado. Você só pode acessar dados da sua universidade.',
                        code: 'UNIVERSITY_ACCESS_DENIED'
                    });
                }
                break;

            case 'course':
                if (courseId && req.user.course && courseId !== req.user.course) {
                    if (!req.user.role.includes('course-coordinator')) {
                        return res.status(403).json({
                            message: 'Acesso negado. Você só pode acessar dados do seu curso.',
                            code: 'COURSE_ACCESS_DENIED'
                        });
                    }
                }
                break;

            // Adicionar mais validações conforme necessário
        }

        next();
    };
}