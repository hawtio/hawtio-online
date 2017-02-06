FROM jimmidyson/caddy:v0.9.3

COPY Caddyfile /etc/Caddyfile
COPY site /srv
