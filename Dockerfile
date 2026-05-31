FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /api
COPY api/package*.json ./
RUN npm install
COPY api .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api /api/package*.json ./
COPY --from=api /api/dist ./dist
RUN npm install --omit=dev
EXPOSE 8080
CMD ["node", "dist/server.js"]
