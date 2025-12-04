#!/bin/sh

# Fail on error and undefined vars
set -eu

NGINX_HTML="/usr/share/nginx/html"
HAWTIO_HTML="${NGINX_HTML}/online"

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE="${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}"
export NGINX_CLIENT_BODY_BUFFER_SIZE="${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}"
export NGINX_PROXY_BUFFERS="${NGINX_PROXY_BUFFERS:-16 128k}"
export NGINX_MASTER_BURST="${NGINX_MASTER_BURST:-5000}"
export NGINX_LOG_LEVEL="${HAWTIO_ONLINE_LOG_LEVEL:-info}"
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

  STATUS_CODE=$(curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET "${APISERVER}"/apis/apps.openshift.io/v1 --write-out '%{http_code}' --silent --output /dev/null || echo "000")
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

  # Get the local IP (handle cases where hostname -i returns multiple IPs)
  LOCAL_IP=$(awk 'END{print $1}' /etc/hosts)

  # Extract the first octet (e.g., 10, 172, 192)
  FIRST_OCTET=$(echo "${LOCAL_IP}" | cut -d'.' -f1)
  if [ "${FIRST_OCTET}" = "10" ]; then
     # Class A Private Network
     export REAL_IP_FROM="10.0.0.0/8"
  elif [ "${FIRST_OCTET}" = "172" ]; then
     # Class B Private Network
     export REAL_IP_FROM="172.16.0.0/12"
  elif [ "${FIRST_OCTET}" = "192" ]; then
     # Class C Private Network
     export REAL_IP_FROM="192.168.0.0/16"
  else
     # Fallback: If we can't determine the private net, we must default to 0.0.0.0/0
     # to ensure the app works, though it reduces the precision of the rate limiting.
     echo "WARNING: Could not determine private subnet from IP ${LOCAL_IP}. Defaulting 'set_real_ip_from' to 0.0.0.0/0"
     export REAL_IP_FROM="0.0.0.0/0"
  fi

  echo "Detected Local IP: ${LOCAL_IP}. Trusting subnet for Real IP: ${REAL_IP_FROM}"

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
    $NGINX_MASTER_BURST
    $LISTEN_SERVER_PORT
    $SERVING_SSL_CERTIFICATE
    $SERVING_SSL_KEY
    $PROXY_SSL_CERTIFICATE
    $PROXY_SSL_KEY
    $SERVING_SSL_PROTOCOLS
    $HAWTIO_ONLINE_GATEWAY_APP_PROTOCOL
    $HAWTIO_ONLINE_GATEWAY_APP_PORT
    $NGINX_LOG_LEVEL
    $REAL_IP_FROM
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
