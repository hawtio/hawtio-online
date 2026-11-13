#!/bin/bash

set -e -o pipefail

. common-functions.sh

HOST=localhost
SERVER_KEY="server.${HOST}.key"
SERVER_CSR="server.${HOST}.csr"
SERVER_CRT="server.${HOST}.crt"
SERVER_BUNDLE_CRT="server.${HOST}.bundle.crt"

PROXY_CSR_CONF="proxy-csr.conf"
PROXY_KEY="proxy.${HOST}.key"
PROXY_CSR="proxy.${HOST}.csr"
PROXY_CRT="proxy.${HOST}.crt"

KUBECLI=$(kube_binary)

extract_ca ${KUBECLI}

##############################################
#
# Generate server certificate
#
##############################################

if [ -f "${SERVER_CRT}" ] && [ -f ${SERVER_BUNDLE_CRT} ]; then
  echo "Server Certificates already created"
else
  # Create Server Key and CSR
  openssl req \
    -nodes \
    -newkey rsa:2048 \
    -keyout "${SERVER_KEY}" \
    -out "${SERVER_CSR}" \
    -subj "/CN=${HOST}"

  if [ ! -f "${SERVER_KEY}" ]; then
    echo "Error: failed to generate Server Certificate Key ... exiting"
    exit 1
  fi
  if [ ! -f "${SERVER_CSR}" ]; then
    echo "Error: failed to generate Server Certificate CSR ... exiting"
    exit 1
  fi

  # Create Server Certificate Signed by CA
  openssl x509 -req \
    -days 3650 -sha256 \
    -CA "${CA_CERT}" \
    -CAkey "${CA_KEY}" \
    -in "${SERVER_CSR}" \
    -out "${SERVER_CRT}"

  if [ ! -f "${SERVER_CRT}" ]; then
    echo "Error: failed to generate signed Server Certificate ... exiting"
    exit 1
  else
    # No longer need the CSR
    rm -f "${SERVER_CSR}"
  fi

  # Create bundle certificate (cert + CA chain)
  if [ -f "${SERVER_CRT}" ] && [ -f "${CA_CERT}" ]; then
    cat "${SERVER_CRT}" "${CA_CERT}" > "${SERVER_BUNDLE_CRT}"
    echo "Server Bundle Certificate created"
  fi

fi

##############################################
#
# Generate proxy certificate
#
##############################################

if [ -f "${PROXY_CRT}" ]; then
  echo "Proxy Certificate already created"
else
  # Write the CSR config file
  cat <<EOT > ${PROXY_CSR_CONF}
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[ dn ]
CN = ${HOST}

[ v3_ext ]
authorityKeyIdentifier=keyid,issuer:always
keyUsage=keyEncipherment,dataEncipherment,digitalSignature
extendedKeyUsage=serverAuth,clientAuth
EOT

  # Create Server Key and CSR
  openssl req \
    -nodes \
    -newkey rsa:2048 \
    -config ${PROXY_CSR_CONF} \
    -keyout "${PROXY_KEY}" \
    -out "${PROXY_CSR}" \
    -subj "/CN=${HOST}"

  if [ ! -f "${PROXY_KEY}" ]; then
    echo "Error: failed to generate Proxy Certificate Key ... exiting"
    exit 1
  fi
  if [ ! -f "${PROXY_CSR}" ]; then
    echo "Error: failed to generate Proxy Certificate CSR ... exiting"
    exit 1
  fi

  # Create Proxy Certificate Signed by CA
  openssl x509 -req \
    -days 3650 -sha256 \
    -CA "${CA_CERT}" \
    -CAkey "${CA_KEY}" \
    -CAcreateserial \
    -extensions v3_ext \
    -extfile ${PROXY_CSR_CONF} \
    -in "${PROXY_CSR}" \
    -out "${PROXY_CRT}"

  if [ ! -f "${PROXY_CRT}" ]; then
    echo "Error: failed to generate signed Proxy Certificate ... exiting"
    exit 1
  else
    # No longer need the CSR
    rm -f "${PROXY_CSR_CONF}" "${PROXY_CSR}"
  fi

fi

# Ensure all files are readable by console
chmod 644 *.crt
chmod 644 *.key
chmod 644 *.srl
