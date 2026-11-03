# Image durcie (TP4, étape 2) : base minimale Alpine, utilisateur non-root, port 8080.
# À l'étape 4, vous ajouterez la mise à jour des paquets (USER root / apk upgrade / USER 101).
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY app/ /usr/share/nginx/html/
EXPOSE 8080
