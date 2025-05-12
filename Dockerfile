# Usa Node 18 LTS com Alpine para uma imagem leve
FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Copia só package.json + lockfile pra cache de deps
COPY package*.json ./

# Instala dependências
RUN npm ci

# Copia fonte
COPY . .

# Compila TypeScript
RUN npm run build

# Expõe a porta que seu Express usa (3000)
EXPOSE 3000

# Comando final para rodar a versão compilada
CMD ["node", "dist/server.js"]
