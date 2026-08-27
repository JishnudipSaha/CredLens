# CredLens frontend - build static bundle, then serve with nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# When running behind a reverse proxy, we want the SPA to call the same
# origin (/api/v1/*). The frontend bundle uses VITE_API_BASE to decide;
# leaving it unset means it falls back to '/api/v1' (relative).
ARG VITE_API_BASE=
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
