#!/bin/sh

# Fail on error and undefined vars
set -eu

NGINX_HTML="/usr/share/nginx/html"
HAWTIO_HTML="${NGINX_HTML}/online"

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE="${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}"
export NGINX_CLIENT_BODY_BUFFER_SIZE="${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}"
export NGINX_PROXY_BUFFERS="${NGINX_PROXY_BUFFERS:-16 128k}"
export HAWTIO_ONLINE_GATEWAY_APP_PORT="${HAWTIO_ONLINE_GATEWAY_APP_PORT:-3000}"
export HAWTIO_ONLINE_SSL_CERTIFICATE="${HAWTIO_ONLINE_SSL_CERTIFICATE:-}"
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

  if [ -n "${HAWTIO_ONLINE_SSL_CERTIFICATE}" ]; then
    echo "Configurating nginx SSL protocol"
    if [ -z "${HAWTIO_ONLINE_SSL_KEY}" ]; then
      echo "SSL mode needs both HAWTIO_ONLINE_SSL_CERTIFICATE and HAWTIO_ONLINE_SSL_KEY env vars"
      exit 1
    fi

    export LISTEN_SERVER_PORT="8443 ssl"
    export SERVING_SSL_CERTIFICATE="ssl_certificate     ${HAWTIO_ONLINE_SSL_CERTIFICATE};"
    export SERVING_SSL_KEY="ssl_certificate_key ${HAWTIO_ONLINE_SSL_KEY};"
    export SERVING_SSL_PROTOCOLS="ssl_protocols TLSv1.2 TLSv1.3;"
    export HAWTIO_ONLINE_GATEWAY_APP_PROTOCOL="https"
  else
    echo "Configuration nginx for plain protocol"

    export LISTEN_SERVER_PORT="8080"
    export SERVING_SSL_CERTIFICATE=
    export SERVING_SSL_KEY=
    export SERVING_SSL_PROTOCOLS=
    export HAWTIO_ONLINE_GATEWAY_APP_PROTOCOL="http"
  fi

  if [ "${OPENSHIFT}" = "true" ]; then
    export PROXY_SSL_CERTIFICATE="proxy_ssl_certificate     /etc/tls/private/proxying/tls.crt;"
    export PROXY_SSL_KEY="proxy_ssl_certificate_key     /etc/tls/private/proxying/tls.key;"
  fi

  # shellcheck disable=SC2016
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    $LISTEN_SERVER_PORT
    $SERVING_SSL_CERTIFICATE
    $SERVING_SSL_KEY
    $PROXY_SSL_CERTIFICATE
    $PROXY_SSL_KEY
    $SERVING_SSL_PROTOCOLS
    $HAWTIO_ONLINE_GATEWAY_APP_PROTOCOL
    $HAWTIO_ONLINE_GATEWAY_APP_PORT
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
