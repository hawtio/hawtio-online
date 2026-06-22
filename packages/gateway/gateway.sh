#!/bin/sh

# Fail on error and undefined vars
set -eu

export OPENSHIFT=true

check_openshift_api() {
  APISERVER="https://${CLUSTER_MASTER:-kubernetes.default.svc}"
  SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
  TOKEN=$(cat ${SERVICEACCOUNT}/token)
  CACERT=${SERVICEACCOUNT}/ca.crt

  STATUS_CODE=$(curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET "${APISERVER}"/apis/apps.openshift.io/v1 --write-out '%{http_code}' --silent --output /dev/null || echo "000")
  if [ "${STATUS_CODE}" != "200" ]; then
    OPENSHIFT=false
  fi
  echo "OpenShift API: ${OPENSHIFT} - ${STATUS_CODE} ${APISERVER}/apis/apps.openshift.io/v1"
}

check_openshift_api

export HAWTIO_ONLINE_GATEWAY_LOG_LEVEL="${HAWTIO_ONLINE_GATEWAY_LOG_LEVEL:-info}"

HAWTIO_ONLINE_GATEWAY_ENV_FILE="/opt/hawtio-online-gateway/env.product"

if [ -f "${HAWTIO_ONLINE_GATEWAY_ENV_FILE}" ]; then
  cp ${HAWTIO_ONLINE_GATEWAY_ENV_FILE} /tmp
  sed -i -e "s/^LOG_LEVEL.*/LOG_LEVEL=${HAWTIO_ONLINE_GATEWAY_LOG_LEVEL}/" /tmp/env.product
  sed -i -e "s/^HAWTIO_ONLINE_GATEWAY_CLUSTER_IS_OPENSHIFT.*/HAWTIO_ONLINE_GATEWAY_CLUSTER_IS_OPENSHIFT=${OPENSHIFT}/" /tmp/env.product
  if [ "${OPENSHIFT}" = "true" ]; then
    sed -i -e "s~^HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE.*~HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE=/etc/tls/private/proxying/tls.crt~" /tmp/env.product
    sed -i -e "s~^HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY.*~HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY=/etc/tls/private/proxying/tls.key~" /tmp/env.product
  fi
  cat /tmp/env.product > ${HAWTIO_ONLINE_GATEWAY_ENV_FILE}
fi

node \
  --enable-source-maps \
  --env-file=${HAWTIO_ONLINE_GATEWAY_ENV_FILE} \
  /opt/hawtio-online-gateway/gateway-api.js
