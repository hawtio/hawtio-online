#!/bin/sh

# Fail on a single failed command in a pipeline (if supported)
(set -o | grep -q pipefail) && set -o pipefail

# Fail on error and undefined vars
set -eu

./config.sh > config.json

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE=${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}
export NGINX_CLIENT_BODY_BUFFER_SIZE=${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}
export NGINX_PROXY_BUFFERS=${NGINX_PROXY_BUFFERS:-16 128k}

OPENSHIFT=true

check_openshift_api() {
  APISERVER="https://${CLUSTER_MASTER:-kubernetes.default.svc}"
  SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
  TOKEN=$(cat ${SERVICEACCOUNT}/token)
  CACERT=${SERVICEACCOUNT}/ca.crt

  STATUS_CODE=$(curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/apis/apps.openshift.io/v1 --write-out '%{http_code}' --silent --output /dev/null)
  if [ "${STATUS_CODE}" != "200" ]; then
    OPENSHIFT=false
  fi
  echo OpenShift API: ${OPENSHIFT} - ${STATUS_CODE} ${APISERVER}/apis/apps.openshift.io/v1
}

check_openshift_api

generate_nginx_gateway_conf() {
  TEMPLATE=/nginx-gateway.conf.template
  if [ "${OPENSHIFT}" = "false" ]; then
    TEMPLATE=/nginx-gateway-k8s.conf.template
  fi
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    ' < $TEMPLATE > /etc/nginx/conf.d/nginx.conf
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
  echo Failed to configure correctly...
  exit 1
fi
