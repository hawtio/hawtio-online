#!/bin/sh

# Fail on a single failed command in a pipeline (if supported)
(set -o | grep -q pipefail) && set -o pipefail

# Fail on error and undefined vars
set -eu

./config.sh > config.js

if [ -v HAWTIO_ONLINE_RBAC_ACL ]; then
  echo Using RBAC NGINX configuration
  ln -sf /nginx-gateway.conf /etc/nginx/conf.d/nginx.conf
elif [ "${HAWTIO_ONLINE_GATEWAY:-}" = "true" ]; then
  echo Using gateway NGINX configuration
  ln -sf /nginx-gateway.conf /etc/nginx/conf.d/nginx.conf
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
