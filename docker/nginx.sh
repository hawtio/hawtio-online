#!/bin/sh

# Fail on a single failed command in a pipeline (if supported)
(set -o | grep -q pipefail) && set -o pipefail

# Fail on error and undefined vars
set -eu

./config.sh > config.js

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE=${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}
export NGINX_CLIENT_BODY_BUFFER_SIZE=${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}
export NGINX_PROXY_BUFFERS=${NGINX_PROXY_BUFFERS:-16 128k}

generate_nginx_gateway_conf() {
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    ' < /nginx-gateway.conf.template > /etc/nginx/conf.d/nginx.conf
}

if [ -v HAWTIO_ONLINE_RBAC_ACL ]; then
  echo Using RBAC NGINX configuration
  generate_nginx_gateway_conf
elif [ "${HAWTIO_ONLINE_GATEWAY:-}" = "true" ]; then
  echo Using gateway NGINX configuration
  generate_nginx_gateway_conf
else
  echo Using legacy NGINX configuration
  ln -sf /nginx.conf /etc/nginx/conf.d/nginx.conf
fi

if [ $? = 0 ]; then
  echo Starting NGINX...
  nginx -g 'daemon off;'
else
  exit 1
fi
