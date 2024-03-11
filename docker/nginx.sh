#!/bin/sh

# Fail on error and undefined vars
set -eu

NGINX_HTML="/usr/share/nginx/html"
HAWTIO_HTML="${NGINX_HTML}/online"

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE="${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}"
export NGINX_CLIENT_BODY_BUFFER_SIZE="${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}"
export NGINX_PROXY_BUFFERS="${NGINX_PROXY_BUFFERS:-16 128k}"

export OPENSHIFT=true

check_openshift_api() {
  APISERVER="https://${CLUSTER_MASTER:-kubernetes.default.svc}"
  SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
  TOKEN=$(cat ${SERVICEACCOUNT}/token)
  CACERT=${SERVICEACCOUNT}/ca.crt

  STATUS_CODE=$(curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET "${APISERVER}"/apis/apps.openshift.io/v1 --write-out '%{http_code}' --silent --output /dev/null)
  if [ "${STATUS_CODE}" != "200" ]; then
    OPENSHIFT=false
  fi
  echo "OpenShift API: ${OPENSHIFT} - ${STATUS_CODE} ${APISERVER}/apis/apps.openshift.io/v1"
}

check_openshift_api

#
# Create osconsole/config.json after openshift api check
# so that the OPENSHIFT flag can be provided to it
#
mkdir -p "${HAWTIO_HTML}/osconsole"
./config.sh > "${HAWTIO_HTML}/osconsole/config.json"

generate_nginx_gateway_conf() {
  TEMPLATE=/nginx-gateway.conf.template
  if [ "${OPENSHIFT}" = "false" ]; then
    TEMPLATE=/nginx-gateway-k8s.conf.template
  fi
  # shellcheck disable=SC2016
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    ' < $TEMPLATE > /etc/nginx/conf.d/nginx.conf
}

if [ -n "${HAWTIO_ONLINE_RBAC_ACL+x}" ]; then
  echo Using RBAC NGINX configuration
  generate_nginx_gateway_conf
elif [ "${HAWTIO_ONLINE_GATEWAY:-}" = "true" ]; then
  echo Using gateway NGINX configuration
  generate_nginx_gateway_conf
else
  echo Using legacy NGINX configuration
  ln -sf /nginx.conf /etc/nginx/conf.d/nginx.conf
fi

# shellcheck disable=SC2181
if [ $? = 0 ]; then
  echo Starting NGINX...
  nginx -g 'daemon off;'
else
  echo Failed to configure correctly...
  exit 1
fi
