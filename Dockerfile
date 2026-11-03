# Image de départ : volontairement simple. On la durcira au TP4.
FROM nginx:1.27
COPY app/ /usr/share/nginx/html/
