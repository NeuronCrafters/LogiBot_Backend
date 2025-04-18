# 🧠 Chat SAEL - Backend

Este projeto é a base do backend do sistema de chatbot educacional **Chat SAEL**, construído com **Node.js**, **TypeScript**, **Express** e **MongoDB**.

## 📁 Estrutura de Pastas

Abaixo está um resumo da estrutura do projeto e o propósito de cada pasta e arquivo:

```
📁 src
├── 📁 @types
│   Contém declarações de tipos globais ou personalizados utilizados no projeto.
│
├── 📁 config
│   Configurações gerais da aplicação.
│   ├── 📁 resetPassword      → Utilitários e lógica de recuperação de senha.
│   ├── 📁 socialLogin        → Configurações para login com Google OAuth2.
│   └── 📁 swagger            → Documentação da API com Swagger.
│
├── 📁 controllers
│   Controladores responsáveis por receber as requisições HTTP e chamar os serviços.
│   ├── 📁 AcademicPublic     → Listagem pública de universidades, cursos, turmas, etc.
│   ├── 📁 admin              → Administração de professores e alunos.
│   ├── 📁 google             → Login/cadastro via Google.
│   ├── 📁 Logs               → Recuperação de logs de interação por aluno, curso, turma, etc.
│   ├── 📁 password           → Fluxo de recuperação e alteração de senha.
│   ├── 📁 professor          → Funcionalidades voltadas a professores.
│   ├── 📁 rasa               → Ações relacionadas ao chatbot (Rasa).
│   ├── 📁 University         → CRUD de universidade, curso, disciplina e turma.
│   └── 📁 users              → Cadastro, login, perfil e autenticação.
│
├── 📁 exceptions
│   Define a classe base de erro (`AppError`) usada na aplicação para padronização.
│
├── 📁 middlewares
│   Middlewares de autenticação, autorização e tratamento de erros.
│   ├── isAuthenticated       → Valida JWT no cookie.
│   ├── isAuthorized          → Valida se o usuário é o dono do recurso.
│   └── isPermissions         → Verifica se o usuário possui permissão (por perfil).
│
├── 📁 models
│   Define os esquemas do banco MongoDB com o Mongoose.
│   Exemplos: `User`, `University`, `Course`, `Class`, `Discipline`, `UserAnalysis`.
│
├── 📁 routes
│   Contém o roteador principal da aplicação (`routes.ts`) e suas divisões por domínio:
│   └── 📁 routesPaths
│       ├── academicInstitutionRoute
│       ├── academicPublicRoutes
│       ├── adminRoute
│       ├── authRoute
│       ├── logsRoutes
│       ├── passwordRoute
│       ├── professorRoute
│       ├── rasaRoute
│       └── socialLoginRoute
│
├── 📁 services
│   Lógica de negócio da aplicação, separada dos controllers.
│   ├── 📁 AcademicPublic     → Listagem pública de cursos, turmas, etc.
│   ├── 📁 admin              → Gerenciamento de professores e alunos.
│   ├── 📁 google             → Login/cadastro com Google.
│   ├── 📁 Logs               → Coleta e processamento de logs.
│   ├── 📁 password           → Reset e alteração de senha.
│   ├── 📁 professor          → Lógica de listagem de alunos para o professor.
│   ├── 📁 rasa               → Integrações com o Rasa Open Source (ações customizadas).
│   ├── 📁 University         → Lógicas de criação, deleção e listagem acadêmica.
│   └── 📁 users              → Autenticação, cadastro e atualização de perfil.
│
├── server.ts                 → Ponto de entrada da aplicação.
```

## 🧰 Bibliotecas Utilizadas

### Dependências principais

| Pacote                    | Utilidade principal                                     |
|--------------------------|----------------------------------------------------------|
| `express`                | Framework para API REST                                 |
| `mongoose`               | ODM para MongoDB                                        |
| `jsonwebtoken`           | Geração e verificação de tokens JWT                     |
| `bcryptjs`               | Criptografia de senhas                                  |
| `passport`               | Middleware de autenticação                              |
| `passport-google-oauth20`| Autenticação via conta Google                           |
| `dotenv`                 | Carrega variáveis de ambiente                          |
| `swagger-jsdoc`          | Geração de documentação Swagger                         |
| `swagger-ui-express`     | Interface visual do Swagger                             |
| `cookie-parser`          | Faz parsing dos cookies de requisições                 |
| `express-session`        | Gerenciamento de sessão (usado no social login)         |
| `cors`                   | Liberação de CORS para APIs                            |
| `axios`                  | Requisições HTTP externas                               |
| `nodemailer`             | Envio de e-mails (recuperação de senha)                |

### Dependências de desenvolvimento

| Pacote                 | Utilidade principal                                      |
|-----------------------|-----------------------------------------------------------|
| `typescript`          | Tipagem estática no JavaScript                           |
| `jest`                | Testes unitários e integração                            |
| `ts-jest`             | Suporte do Jest para TypeScript                          |
| `supertest`           | Testes de integração para rotas HTTP                     |
| `@types/*`            | Tipagens para as bibliotecas usadas                     |
| `ts-node-dev`         | Execução de servidor com hot reload                     |
| `tsconfig-paths`      | Suporte a `@/` como alias nos imports                   |
| `mongodb-memory-server` | Mongo em memória para testes automatizados            |
| `cross-env`           | Suporte a variáveis de ambiente multiplataforma         |

---
