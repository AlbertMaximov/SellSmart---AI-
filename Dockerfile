# Этап сборки (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Принимаем аргументы и задаем их как переменные окружения.
# Так как проект использует Vite и клиентский рендеринг,
# Vite зашивает переменные в бандл на этапе сборки.
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

ARG APP_URL
ENV APP_URL=$APP_URL

# Собираем клиентское приложение
RUN npm run build

# Продакшен этап (Nginx)
FROM nginx:alpine

# Копируем собранную статику
COPY --from=builder /app/dist /usr/share/nginx/html

# Настраиваем Nginx на работу с портом 3000 и маршрутизацию SPA (react-router и тп)
RUN echo $'server { \\n\
    listen 3000; \\n\
    location / { \\n\
        root /usr/share/nginx/html; \\n\
        index index.html index.htm; \\n\
        try_files $uri $uri/ /index.html; \\n\
    } \\n\
}' > /etc/nginx/conf.d/default.conf

# Открываем порт 3000 (согласно требованиям инфраструктуры)
EXPOSE 3000

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
