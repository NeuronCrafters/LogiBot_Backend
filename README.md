# Backend Chat SAEL - Configuração com Docker

Este projeto utiliza **NodeJS** e TypeScript juntamente de **Docker** para gerenciar serviços como MongoDB, Rasa e Action Server. Este guia explica como configurar e executar o ambiente.

---

## **Bibliotecas Utilizadas no Projeto:**
- express: Framework web para o backend.
- mongodb e mongoose: Para gerenciar conexões e modelos do banco de dados MongoDB.
- jsonwebtoken: Autenticação JWT.
- axios: Utilizada para requisições a API Rasa.
- cors: Utilizado para permitir requisições de servers distintos.
- dotenv: Responsável por gerenciar as variáveis de ambiente.
- bcryptjs: Hashing de senhas.
- nodemailer: Envio de e-mails (como recuperação de senha).
- passport e passport-google-oauth20: Autenticação social com Google.
- swagger-jsdoc e swagger-ui-express: Documentação interativa da API

## **Bibliotecas de Desenvolvimento Utilizadas no Projeto:**
- typescript: Tipagem estática para JavaScript.
- ts-node-dev: Reinicialização automática para desenvolvimento.
- nodemon: Monitoramento de alterações no código.
- swagger-autogen: Geração automática de documentação Swagger.

## **Pré-requisitos**
- **NodeJS** e **TypeScript** instalados:
  - [Instalar NodeJS](https://nodejs.org/download/release/v22.11.0/)
  - [Instalar TypeScript](https://www.typescriptlang.org/)
- **Docker** e **Docker Compose** instalados:
  - [Instalar Docker](https://docs.docker.com/get-docker/)
  - [Instalar Docker Compose](https://docs.docker.com/compose/install/)

---

## **Estrutura do Projeto**
```
└── 📁backend_Chat_SAEL
    └── 📁src
        └── 📁@types
            └── express.d.ts
        └── 📁config
            └── database.ts
            └── 📁resetPassword
                └── findUserByEmail.ts
                └── generateResetToken.ts
                └── mailOptions.ts
                └── nodemailerTransport.ts
            └── 📁socialLogin
                └── allowedDomains.ts
                └── domainToSchoolMap.json
                └── googleLoginStrategy.ts
                └── googleStrategy.ts
                └── passport.ts
            └── 📁swagger
                └── swaggerConfig.ts
        └── 📁controllers
            └── 📁admin
                └── createProfessorController.ts
                └── DeleteProfessorController.ts
                └── ListProfessorsByCourseController.ts
                └── ListProfessorsController.ts
                └── ListStudentsProfessorController.ts
            └── 📁faq_store
                └── CreateFAQEntryController.ts
                └── GetFAQEntriesController.ts
            └── 📁google
                └── signinGoogleController.ts
                └── signupGoogleController.ts
            └── 📁password
                └── resetPasswordController.ts
                └── sendResetPasswordEmailController.ts
                └── updatePasswordController.ts
            └── 📁professor
                └── listStudentsController.ts
                └── viewStudentHistoryController.ts
            └── 📁rasa
                └── rasaGetHistoryController.ts
                └── rasaSendController.ts
            └── 📁University
                └── 📁Class
                    └── CreateClassController.ts
                    └── DeleteClassController.ts
                    └── ListClassesByCourseController.ts
                └── 📁Course
                    └── CreateCourseController.ts
                    └── DeleteCourseController.ts
                    └── ListCoursesByUniversityController.ts
                └── 📁Discipline
                    └── CreateDisciplineController.ts
                    └── DeleteDisciplineController.ts
                    └── ListDisciplinesController.ts
                └── 📁University
                    └── CreateUniversityController.ts
                    └── DeleteUniversityCourseController.ts
                    └── ListUniversitiesController.ts
                └── 📁UniversityOuthers
                    └── AssignDisciplineController.ts
                    └── GetClassWithStudentsController.ts
            └── 📁userAnalysis
                └── addInteracaoForaDaSalaController.ts
                └── addInteractionController.ts
                └── endSessionController.ts
                └── getUserAnalysisController.ts
                └── registerUserAnswerController.ts
                └── setTaxaDeAcertosController.ts
                └── startSessionController.ts
            └── 📁users
                └── AuthUserController.ts
                └── CreateUserController.ts
                └── DetailsUserController.ts
                └── LogoutController.ts
        └── 📁exceptions
            └── AppError.ts
        └── 📁middlewares
            └── errorHandler.ts
            └── 📁isAuthenticated
                └── isAuthenticated.ts
            └── 📁isAuthorized
                └── isAuthorized.ts
            └── 📁isPermissions
                └── isPermissions.ts
        └── 📁models
            └── Class.ts
            └── Course.ts
            └── Discipline.ts
            └── FAQStore.ts
            └── History.ts
            └── Professor.ts
            └── University.ts
            └── User.ts
            └── UserAnalysis.ts
        └── 📁routes
            └── routes.ts
            └── 📁routesPaths
                └── academicInstitutionRoute.ts
                └── adminRoute.ts
                └── authRoute.ts
                └── faqStoreRoute.ts
                └── passwordRoute.ts
                └── professorRoute.ts
                └── rasaRoute.ts
                └── socialLoginRoute.ts
                └── userAnalysisRoute.ts
        └── 📁services
            └── 📁admin
                └── createProfessorService.ts
                └── deleteProfessorService.ts
                └── ListProfessorsByCourseService.ts
                └── ListProfessorsService.ts
                └── ListStudentsProfessorService.ts
            └── 📁faq_store
                └── createFAQEntryService.ts
                └── getFAQEntriesService.ts
            └── 📁google
                └── signinGoogleService.ts
                └── signupGoogleService.ts
            └── 📁password
                └── resetPasswordService.ts
                └── sendResetPasswordEmailService.ts
                └── updatePasswordService.ts
            └── 📁professor
                └── listStudentsService.ts
                └── viewStudentHistoryService.ts
            └── 📁rasa
                └── rasaGetHistoryService.ts
                └── rasaSendService.ts
            └── 📁University
                └── 📁Class
                    └── CreateClassService.ts
                    └── DeleteClassService.ts
                    └── ListClassesByCourseService.ts
                └── 📁Course
                    └── CreateCourseService.ts
                    └── DeleteCourseService.ts
                    └── ListCoursesByUniversityService.ts
                └── 📁Discipline
                    └── CreateDisciplineService.ts
                    └── DeleteDisciplineService.ts
                    └── ListDisciplinesService.ts
                └── 📁University
                    └── CreateUniversityService.ts
                    └── DeleteUniversityCourseService.ts
                    └── ListUniversitiesService.ts
                └── 📁UniversityOuthers
                    └── AssignDisciplineService.ts
                    └── GetClassWithStudentsService.ts
            └── 📁users
                └── AuthUserService.ts
                └── CreateUserService.ts
                └── DetailsUserService.ts
                └── LogoutUserService.ts
        └── server.ts
    └── .env
    └── .gitignore
    └── docker-compose.yml
    └── mongo-init.js
    └── mongo-init.ts
    └── package-lock.json
    └── package.json
    └── README.md
    └── swagger_output.json
    └── tsconfig.json
```


---


## **Configuração do Docker**

### 1. **Arquivo `.env`**
Certifique-se de que o arquivo `.env` contém:
```env
MONGO_URI
DB_NAME

JWT_SECRET
BASE_URL_BACKEND=http://localhost:3000
```

### 2. **Executar o Projeto:**
```bash
docker-compose up -d
```

```bash
docker run -d --name mongo -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=example mongo:latest
```

### 3. Para Acessar Dentro do MongoDB Compass:
```bash
mongodb://root:example@localhost:27017
```