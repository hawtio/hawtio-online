#!/bin/bash

set -e -o pipefail

trap exithandler EXIT

TEMP_DIR=$(mktemp --tmpdir -d generate-proxying.XXXXXX)

exithandler() {
  exitcode=$?
  if [ "$exitcode" != "0" ]; then
    echo "WARNING: unsuccessful exit code: $exitcode" >&2
  fi

  rm -rf "$TEMP_DIR"

  exit $exitcode
}

usage() {
  cat <<EOT
This script generates a client certificate and then creates a TLS secret with it
for Hawtio proxying on OpenShift 4.

Usage:
  $(basename "$0") [-h] [SECRET_NAME] [CN]

Options:
  -h    Show this help
EOT
  exit
}

kube_binary() {
  local k
  k=$(command -v "${1}" 2> /dev/null)
  # shellcheck disable=SC2181
  if [ $? != 0 ]; then
    return
  fi

  echo "${k}"
}

while getopts h OPT; do
  case $OPT in
    h)
      usage
      ;;
    *)
      ;;
  esac
done

if [ -n "${KUBECLI}" ]; then
  KUBECLI=$(kube_binary "${KUBECLI}")
else
  # try finding oc
  KUBECLI=$(kube_binary oc)
  if [ -z "${KUBECLI}" ]; then
    # try finding kubectl
    KUBECLI=$(kube_binary kubectl)
  fi
fi

if [ -z "${KUBECLI}" ]; then
  echo "Error: Cannot find kube cluster client command, eg. oc or kubectl"
  exit 1
fi

if [ -z "${NAMESPACE}" ]; then
  NAMESPACE=$(${KUBECLI} config view --minify -o jsonpath='{..namespace}')

  if [ -z "${NAMESPACE}" ]; then
    echo "Error: Cannot determine the target namespace for the new secret"
    exit 1
  fi
fi

SECRET_NAME=${1:-hawtio-online-tls-proxying}
CN=${2:-hawtio-online.hawtio.svc}

cd "$TEMP_DIR"

# The CA private key
${KUBECLI} get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.key']}" | base64 --decode > ca.key

# The CA certificate
${KUBECLI} get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ca.crt

# Generate the private key
openssl genrsa -out server.key 2048

# Write the CSR config file
cat <<EOT > csr.conf
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[ dn ]
CN = ${CN}

[ v3_ext ]
authorityKeyIdentifier=keyid,issuer:always
keyUsage=keyEncipherment,dataEncipherment,digitalSignature
extendedKeyUsage=serverAuth,clientAuth
EOT

# Generate the CSR
openssl req -new -key server.key -out server.csr -config csr.conf

# Issue the signed certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 10000 -extensions v3_ext -extfile csr.conf

if ${KUBECLI} get secret "${SECRET_NAME}" -n "${NAMESPACE}" 1> /dev/null 2>& 1; then
  echo "The secret ${SECRET_NAME} in ${NAMESPACE} already exists"
  exit 0
fi

# Create the secret for Hawtio Online
${KUBECLI} create secret tls "${SECRET_NAME}" --cert server.crt --key server.key -n "${NAMESPACE}"
