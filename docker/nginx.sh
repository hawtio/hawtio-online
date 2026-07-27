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

  # Secure Default: If HAWTIO_TRUSTED_NETWORK_SUBNET is not explicitly
  # provided by the operator, limit trust strictly to the pod's /16
  # network segment (or host IP).
  if [ -n "${HAWTIO_TRUSTED_NETWORK_SUBNET:-}" ]; then
    CUSTOM_POD_NETWORK="${HAWTIO_TRUSTED_NETWORK_SUBNET}"
  elif echo "${LOCAL_IP}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    # IPv4: Calculate the /16 subnet for this specific pod
    # node/pod SDN subnets almost always allocate pod ranges
    # within a /14 or /16 chunk per node or per cluster segment.
    # Masking to /16 ensures that the Router pod/node IP and the
    # hawtio-online pod IP share the trusted rule, even if not on
    # the exact same .x third octet.
    CUSTOM_POD_NETWORK=$(echo "${LOCAL_IP}" | awk -F. '{print $1"."$2".0.0/16"}')
  elif echo "${LOCAL_IP}" | grep -q ':'; then
    # IPv6: Trust only the local /64 subnet
    CUSTOM_POD_NETWORK=$(echo "${LOCAL_IP}" | awk -F: '{print $1":"$2":"$3"::/64"}')
  else
    # Failsafe: Trust only the specific host IP (/32)
    CUSTOM_POD_NETWORK="${LOCAL_IP}/32"
  fi

  # Export for use in nginx template
  export CUSTOM_POD_NETWORK="${CUSTOM_POD_NETWORK}"

  echo "Detected Local IP: ${LOCAL_IP}"
  echo "Trusting pod subnet: ${CUSTOM_POD_NETWORK}"

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
    $CUSTOM_POD_NETWORK
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
