# Usa imagem oficial Node.js 18 LTS com Alpine
FROM node:18-alpine

# Definindo o maintainer
LABEL maintainer="ramoncbarbosa@unifesspa.edu.br"

# Define o diretório de trabalho no container
WORKDIR /app

# Copia apenas os arquivos de dependências primeiro (melhora cache)
COPY package*.json ./

# Instala as dependências (produção e dev)
RUN npm install

# Copia o restante da aplicação
COPY . .

# Faz o build do TypeScript
RUN npm run build

# Expõe a porta (ajuste se seu backend não rodar na 3000)
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["npm", "start"]
