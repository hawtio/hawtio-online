#!/bin/sh

# Fail on error and undefined vars
set -eu

export HAWTIO_ONLINE_GATEWAY_LOG_LEVEL="${HAWTIO_ONLINE_GATEWAY_LOG_LEVEL:-info}"

HAWTIO_ONLINE_GATEWAY_ENV_FILE="/opt/hawtio-online-gateway/env.product"

if [ -f "${HAWTIO_ONLINE_GATEWAY_ENV_FILE}" ]; then
  cp ${HAWTIO_ONLINE_GATEWAY_ENV_FILE} /tmp
  sed -i -e "s/^LOG_LEVEL.*/LOG_LEVEL=${HAWTIO_ONLINE_GATEWAY_LOG_LEVEL}/" /tmp/env.product
  cat /tmp/env.product > ${HAWTIO_ONLINE_GATEWAY_ENV_FILE}
fi

node \
  --enable-source-maps \
  --env-file=${HAWTIO_ONLINE_GATEWAY_ENV_FILE} \
  /opt/hawtio-online-gateway/gateway-api.js
