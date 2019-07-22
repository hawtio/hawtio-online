#!/bin/sh

# Fail on a single failed command in a pipeline (if supported)
(set -o | grep -q pipefail) && set -o pipefail

# Fail on error and undefined vars
set -eu

./config.sh > config.js

if [ "${HAWTIO_ONLINE_GATEWAY:-}" = "true" ]; then
  ln -sf /nginx-gateway.conf /etc/nginx/conf.d/nginx.conf
else
  ln -sf /nginx.conf /etc/nginx/conf.d/nginx.conf
fi

if [ $? = 0 ]; then
  echo Starting NGINX...
  nginx -g 'daemon off;'
else
  exit 1
fi
