import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerDocument = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'API Backend Chat SAEL',
    description: 'Documentação da API do Chat Bot SAEL',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor de Desenvolvimento',
    },
  ],
  paths: {
    '/users': {
      post: {
        tags: ['Auth'],
        summary: 'Criar um novo usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'John Doe' },
                  email: { type: 'string', example: 'john@example.com' },
                  password: { type: 'string', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuário criado com sucesso' },
          400: { description: 'Dados inválidos' },
        },
      },
    },
    '/session': {
      post: {
        tags: ['Auth'],
        summary: 'Autenticar um usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'john@example.com' },
                  password: { type: 'string', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login bem-sucedido' },
          401: { description: 'Credenciais inválidas' },
        },
      },
    },
    '/me': {
      get: {
        tags: ['Auth'],
        summary: 'Pegar Dados de Um Usuário Logado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Dados do usuário recuperados com sucesso',
          },
          401: { description: 'Token inválido ou ausente' },
        },
      },
    },
    '/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Deslogar um usuário',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Logout bem-sucedido' },
          401: { description: 'Usuário não autenticado' },
        },
      },
    },
    '/admin/professors': {
      get: {
        tags: ['Coordinator'],
        summary: 'Listar todos os professores',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Lista de professores recuperada com sucesso',
          },
          403: { description: 'Usuário não autorizado' },
          401: { description: 'Usuário não autenticado' },
        },
      },
    },
    '/admin/professor/{professorId}/students': {
      get: {
        tags: ['Coordinator'],
        summary: 'Listar alunos de um professor',
        parameters: [
          {
            name: 'professorId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID do professor',
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista de alunos recuperada com sucesso' },
          401: { description: 'Usuário não autenticado' },
        },
      },
    },
    '/professor/{professorId}/students': {
      get: {
        tags: ['Professor'],
        summary: 'Listar os alunos de um professor',
        parameters: [
          {
            name: 'professorId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID do professor',
          },
        ],
        responses: {
          200: {
            description: 'Lista de alunos recuperada com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: '1' },
                      name: { type: 'string', example: 'Aluno 1' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Usuário não autenticado' },
        },
      },
    },
    // '/professor/{professorId}/student/{studentId}/history': {
    //   get: {
    //     tags: ['Professor'],
    //     summary: 'Ver histórico de um aluno',
    //     parameters: [
    //       {
    //         name: 'professorId',
    //         in: 'path',
    //         required: true,
    //         schema: { type: 'string' },
    //         description: 'ID do professor',
    //       },
    //       {
    //         name: 'studentId',
    //         in: 'path',
    //         required: true,
    //         schema: { type: 'string' },
    //         description: 'ID do aluno',
    //       },
    //     ],
    //     responses: {
    //       200: { description: 'Histórico do aluno recuperado com sucesso' },
    //       401: { description: 'Usuário não autenticado' },
    //     },
    //   },
    // },
    '/password/send-reset-password': {
      post: {
        tags: ['Reset Password'],
        summary: 'Enviar e-mail de redefinição de senha',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'user@example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'E-mail enviado com sucesso' },
          400: { description: 'Erro ao enviar o e-mail' },
        },
      },
    },
    '/password/reset-password': {
      patch: {
        tags: ['Reset Password'],
        summary: 'Redefinir senha do usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  resetToken: { type: 'string', example: 'token123' },
                  newPassword: { type: 'string', example: 'newPassword123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Senha redefinida com sucesso' },
          400: { description: 'Erro ao redefinir senha' },
        },
      },
    },
    '/sael/talk': {
      post: {
        tags: ['SAEL'],
        summary: 'Iniciar conversa com o SAEL',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Olá, SAEL!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Mensagem enviada ao SAEL com sucesso' },
        },
      },
    },
    '/sael/history': {
      get: {
        tags: ['SAEL'],
        summary: 'Obter histórico de conversas com o SAEL para um aluno',
        parameters: [
          {
            name: 'studentId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'ID do estudante',
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Histórico de conversas recuperado com sucesso' },
          401: { description: 'Usuário não autenticado' },
        },
      },
    },
    '/auth/google/login': {
      get: {
        tags: ['Social Login'],
        summary: 'Login com Google',
        responses: {
          302: { description: 'Redireciona para o Google para autenticação' },
        },
      },
    },
    '/auth/google/signup': {
      get: {
        tags: ['Social Login'],
        summary: 'Cadastro com Google',
        description: 'Redireciona para a janela de escolha de conta do Google.',
        responses: {
          302: { description: 'Redireciona para o Google para cadastro' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('Swagger Docs disponível em http://localhost:3000/api-docs');
};
