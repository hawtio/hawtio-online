#!/bin/sh

# Fail on error and undefined vars
set -eu

NGINX_HTML="/usr/share/nginx/html"
HAWTIO_HTML="${NGINX_HTML}/online"

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE="${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}"
export NGINX_CLIENT_BODY_BUFFER_SIZE="${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}"
export NGINX_PROXY_BUFFERS="${NGINX_PROXY_BUFFERS:-16 128k}"
export PROXY_SSL_CERTIFICATE=
export PROXY_SSL_KEY=

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
  if [ "${OPENSHIFT}" = "true" ]; then
    export PROXY_SSL_CERTIFICATE="proxy_ssl_certificate     /etc/tls/private/proxying/tls.crt;"
    export PROXY_SSL_KEY="proxy_ssl_certificate_key     /etc/tls/private/proxying/tls.key;"
  fi

  # shellcheck disable=SC2016
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    $PROXY_SSL_CERTIFICATE
    $PROXY_SSL_KEY
    ' < ${TEMPLATE} > /etc/nginx/conf.d/nginx.conf
}

echo Generating gateway NGINX configuration
generate_nginx_gateway_conf

# shellcheck disable=SC2181
if [ $? = 0 ]; then
  echo Starting NGINX...
  nginx -g 'daemon off;'
else
  echo Failed to configure correctly...
  exit 1
fi
