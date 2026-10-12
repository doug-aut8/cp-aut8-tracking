# Etapa 1: Build da aplicação
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa 2: Imagem final, somente para servir os arquivos gerados
FROM node:20-alpine

WORKDIR /app

# Instala o pacote global "serve"
RUN npm install -g serve

# Copia apenas os arquivos da build final
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Comando que inicia o servidor de arquivos estáticos na porta 3000
CMD ["serve", "dist", "-l", "3000", "-s"]
