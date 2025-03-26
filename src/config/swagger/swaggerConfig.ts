import swaggerAutogen from 'swagger-autogen';

const outputFile = './src/config/swagger/swagger_output.json';
const endpointsFiles = ['./src/routes/routes.ts'];

const doc = {
  info: {
    title: 'API - Chat SAEL',
    description: 'Documentação das rotas da API do SAEL',
  },
  host: 'localhost:3000',
  schemes: ['http'],
  tags: [
    { name: 'Auth', description: 'Rotas de autenticação' },
    { name: 'Admin', description: 'Rotas administrativas' },
    { name: 'Professor', description: 'Acesso de professores' },
    { name: 'SAEL (ChatBot)', description: 'Interação com o ChatBot' },
    { name: 'Logs', description: 'Logs de usuários, cursos, disciplinas e turmas' },
    { name: 'Instituições Acadêmicas', description: 'CRUD acadêmico (admin)' },
    { name: 'Acadêmico Público', description: 'Rotas públicas de cursos e universidades' },
  ],
};

swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointsFiles, doc);
