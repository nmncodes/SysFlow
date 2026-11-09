FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
RUN npm install -g serve@14
WORKDIR /app
COPY --from=build /app/dist ./dist
USER app
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
