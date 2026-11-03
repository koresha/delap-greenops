FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN apk upgrade --no-cache
USER 101
COPY app/ /usr/share/nginx/html/
EXPOSE 8080
