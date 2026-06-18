FROM node:20-alpine

WORKDIR /app

# Copiar e instalar dependências do backend (incluindo tsx)
COPY package*.json ./
RUN npm install

# Copiar código do backend
COPY server/ ./server/

# Copiar e instalar dependências do frontend
COPY client/package*.json ./client/
RUN cd client && npm install

# Copiar código do frontend e fazer build
COPY client/ ./client/
RUN cd client && npm run build

# Configuração de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Criar pasta para o storage persistente e declarar volume
RUN mkdir -p /app/storage
VOLUME /app/storage

EXPOSE 3001

CMD ["npm", "start"]
