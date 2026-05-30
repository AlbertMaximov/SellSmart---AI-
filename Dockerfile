# Этап сборки (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем фронтенд-клиент и бандлим экспресс-сервер на бэкенде
RUN npm run build

# Продакшен этап (Node.js)
FROM node:20-alpine

WORKDIR /app

# Переменная окружения продакшена
ENV NODE_ENV=production

# Копируем package.json
COPY package*.json ./

# Устанавливаем только продакшен зависимости (для легковесного контейнера)
RUN npm ci --only=production

# Копируем билд из builder-этапа (статические файлы и скомпилированный сервер)
COPY --from=builder /app/dist ./dist

# Открываем порт 3000 (согласно требованиям Cloud Run / Nginx)
EXPOSE 3000

# Запуск нашего полноценного бэкенд сервера
CMD ["npm", "run", "start"]
