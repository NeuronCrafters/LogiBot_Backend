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
exports.getAcademicDataController = getAcademicDataController;
const getAcademicDataService_1 = require("../../services/University/getAcademicDataService");
const Professor_1 = require("../../models/Professor");
function getAcademicDataController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            if (!req.user) {
                return res.status(401).json({
                    message: "Usuário não autenticado",
                    code: "NOT_AUTHENTICATED"
                });
            }
            // Busca dados completos do usuário para ter todas as informações necessárias
            const userData = yield getUserCompleteData(req.user.id, req.user.role);
            if (!userData) {
                return res.status(404).json({
                    message: "Dados do usuário não encontrados",
                    code: "USER_DATA_NOT_FOUND"
                });
            }
            // Log para debug (remover em produção)
            console.log(`[AcademicData] Usuário ${userData._id} (${userData.role.join(', ')}) acessando dados acadêmicos`);
            // Chama o service com os dados completos do usuário
            const data = yield (0, getAcademicDataService_1.getAcademicDataService)(userData);
            // Conta totais para incluir no retorno
            const summary = calculateDataSummary(data, userData.role);
            // Retorna dados com informações completas para o frontend
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
                        disciplines: ((_a = userData.disciplines) === null || _a === void 0 ? void 0 : _a.length) || 0
                    }
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    version: "2.0",
                    source: "academic-data-service"
                }
            });
        }
        catch (error) {
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
    });
}
function getUserCompleteData(userId, roles) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            // Determina se é professor ou coordenador baseado nos roles
            const isProfessor = roles.includes('professor') || roles.includes('course-coordinator');
            const isAdmin = roles.includes('admin');
            if (isAdmin) {
                // Admin pode ter dados básicos - sem restrições específicas
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
                const professor = yield Professor_1.Professor.findById(userId)
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
                    course: (_c = (_b = (_a = professor.courses) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString(),
                    class: undefined,
                    disciplines: ((_d = professor.disciplines) === null || _d === void 0 ? void 0 : _d.map(d => d._id.toString())) || []
                };
            }
            else {
                console.warn(`Estudante tentando acessar dados acadêmicos: ${userId}`);
                return null;
            }
        }
        catch (error) {
            console.error('Erro ao buscar dados completos do usuário:', error);
            return null;
        }
    });
}
function calculateDataSummary(data, userRoles) {
    const summary = {
        universities: 0,
        courses: 0,
        classes: 0,
        disciplines: 0,
        professors: 0,
        students: 0,
        userLevel: getAccessLevel(userRoles)
    };
    data.universities.forEach((university) => {
        summary.universities++;
        university.courses.forEach((course) => {
            var _a, _b, _c, _d;
            summary.courses++;
            summary.classes += ((_a = course.classes) === null || _a === void 0 ? void 0 : _a.length) || 0;
            summary.disciplines += ((_b = course.disciplines) === null || _b === void 0 ? void 0 : _b.length) || 0;
            summary.professors += ((_c = course.professors) === null || _c === void 0 ? void 0 : _c.length) || 0;
            summary.students += ((_d = course.students) === null || _d === void 0 ? void 0 : _d.length) || 0;
        });
    });
    return summary;
}
function getUserPermissions(roles) {
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
function getAccessLevel(roles) {
    if (roles.includes('admin'))
        return 'ADMIN';
    if (roles.includes('course-coordinator'))
        return 'COORDINATOR';
    if (roles.includes('professor'))
        return 'PROFESSOR';
    return 'NO_ACCESS';
}
