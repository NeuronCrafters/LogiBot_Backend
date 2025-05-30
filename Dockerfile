# Etapa 1: Build com Node 18 LTS
FROM node:18 AS build

# Define diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências de produção e desenvolvimento
RUN npm install

# Copia o restante do código
COPY . .

# Compila o projeto (gera o dist/)
RUN npm run build

# Etapa 2: Imagem final para produção
FROM node:18 AS production

WORKDIR /app

# Copia apenas o package.json e o package-lock.json para instalar só prod deps
COPY package*.json ./

# Instala somente as dependências de produção
RUN npm install --only=production

# Copia os arquivos já buildados
COPY --from=build /app/dist ./dist
COPY .env .env

# Expor a porta da aplicação (ajuste se necessário)
EXPOSE 3000

# Comando de inicialização
CMD ["node", "dist/server.js"]
