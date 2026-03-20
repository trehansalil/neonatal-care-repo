# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Nginx with React build + legacy HTML
FROM nginx:1.25
COPY --from=frontend-build /app/dist /usr/share/nginx/html
# Legacy HTML is mounted via docker-compose volume at /usr/share/nginx/html/old
