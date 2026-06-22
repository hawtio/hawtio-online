#!/bin/bash

DOMAIN=unit.test

STATE="Unit"
ORGANISATION="Unit Tests"
COMMONNAME=${DOMAIN}

CA_DIR="CA"
KEYS_DIR="private"
CSR_DIR="csr"
CERTS_DIR="certs"

echo "DOMAIN: ${DOMAIN}"
echo "STATE: ${STATE}"
echo "ORGANISATION: ${ORGANISATION}"
echo "COMMONNAME: ${COMMONNAME}"

# Remove any existing items
rm -rf ${CA_DIR} ${KEYS_DIR} ${CSR_DIR} ${CERTS_DIR}

mkdir -p ${CA_DIR}
mkdir -p ${KEYS_DIR}
mkdir -p ${CSR_DIR}
mkdir -p ${CERTS_DIR}

# Create CA certificate
openssl req \
  -nodes -new -x509 -days 3650 -sha256 \
  -keyout "${CA_DIR}/${DOMAIN}-ca.key" \
  -subj "/ST=${STATE}/O=${ORGANISATION}/CN=${COMMONNAME}" \
  -out "${CA_DIR}/${DOMAIN}-ca.crt"

if [ ! -f "${CA_DIR}/${DOMAIN}-ca.key" ]; then
  echo "Error: failed to generate Certificate Authority Key ... exiting"
  exit 1
else
  chmod 400 "${CA_DIR}/${DOMAIN}-ca.key"
fi

if [ ! -f "${CA_DIR}/${DOMAIN}-ca.crt" ]; then
  echo "Error: failed to generate Certificate Authority Certificate ... exiting"
  exit 1
fi

# Create Server Key and CSR
openssl req \
  -nodes \
  -newkey rsa:2048 \
  -keyout "${KEYS_DIR}/server.${DOMAIN}.key" \
  -out "${CSR_DIR}/server.${DOMAIN}.csr" \
  -subj "/ST=${STATE}/O=${ORGANISATION}/CN=server.${COMMONNAME}"

if [ ! -f "${KEYS_DIR}/server.${DOMAIN}.key" ]; then
  echo "Error: failed to generate Server Certificate Key ... exiting"
  exit 1
fi
if [ ! -f "${CSR_DIR}/server.${DOMAIN}.csr" ]; then
  echo "Error: failed to generate Server Certificate CSR ... exiting"
  exit 1
fi

# Create Server Certificate Signed by CA
openssl x509 -req \
  -days 3650 -sha256 \
  -in "${CSR_DIR}/server.${DOMAIN}.csr" \
  -CA "${CA_DIR}/${DOMAIN}-ca.crt" \
  -CAkey "${CA_DIR}/${DOMAIN}-ca.key" \
  -out "${CERTS_DIR}/server.${DOMAIN}.crt"

if [ ! -f "${CERTS_DIR}/server.${DOMAIN}.crt" ]; then
  echo "Error: failed to generate Server Certificate ... exiting"
  exit 1
fi

# Create Proxy Key and CSR
openssl req \
  -nodes \
  -newkey rsa:2048 \
  -keyout "${KEYS_DIR}/proxy.${DOMAIN}.key" \
  -out "${CSR_DIR}/proxy.${DOMAIN}.csr" \
  -subj "/ST=${STATE}/O=${ORGANISATION}/CN=proxy.${COMMONNAME}"

if [ ! -f "${KEYS_DIR}/proxy.${DOMAIN}.key" ]; then
  echo "Error: failed to generate Proxy Certificate Key ... exiting"
  exit 1
fi
if [ ! -f "${CSR_DIR}/proxy.${DOMAIN}.csr" ]; then
  echo "Error: failed to generate Proxy Certificate CSR ... exiting"
  exit 1
fi

# Create Proxy Certificate Signed by CA
openssl x509 -req \
  -days 3650 -sha256 \
  -in "${CSR_DIR}/proxy.${DOMAIN}.csr" \
  -CA "${CA_DIR}/${DOMAIN}-ca.crt" \
  -CAkey "${CA_DIR}/${DOMAIN}-ca.key" \
  -out "${CERTS_DIR}/proxy.${DOMAIN}.crt"

if [ ! -f "${CERTS_DIR}/proxy.${DOMAIN}.crt" ]; then
  echo "Error: failed to generate Proxy Certificate ... exiting"
  exit 1
fi
