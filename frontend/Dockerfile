FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG REACT_APP_API_BASE=http://localhost:4000/api
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
