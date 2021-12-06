#!/bin/sh

set -e

trap exithandler EXIT

TEMP_DIR=$(mktemp --tmpdir -d generate-certificate.XXXXXX)

exithandler() {
  exitcode=$?
  if [ "$exitcode" != "0" ]; then
    echo "WARNING: unsuccessful exit code: $?" >&2
  fi

  rm -rf "$TEMP_DIR"

  exit $exitcode
}

usage() {
  cat <<EOT
This script generates a client certificate and create a secret with it
on OpenShift 4.

Usage:
  $(basename $0) [-h] [SECRET_NAME] [CN]

Options:
  -h    Show this help
EOT
  exit
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

SECRET_NAME=${1:-hawtio-online-tls-proxying}
CN=${2:-hawtio-online.hawtio.svc}

cd "$TEMP_DIR"

# The CA certificate
kubectl get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ca.crt

# The CA private key
kubectl get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.key']}" | base64 --decode > ca.key

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
CN = $CN

[ v3_ext ]
authorityKeyIdentifier=keyid,issuer:always
keyUsage=keyEncipherment,dataEncipherment,digitalSignature
extendedKeyUsage=serverAuth,clientAuth
EOT

# Generate the CSR
openssl req -new -key server.key -out server.csr -config csr.conf

# Issue the signed certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 10000 -extensions v3_ext -extfile csr.conf

# Create the secret for Hawtio Online
kubectl create secret tls $SECRET_NAME --cert server.crt --key server.key
