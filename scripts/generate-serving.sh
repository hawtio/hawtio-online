#!/bin/bash

set -e -o pipefail

trap exithandler EXIT

TEMP_DIR=$(mktemp --tmpdir -d generate-serving.XXXXXX)

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
This script generates a certificate and then creates a TLS secret with it
for Hawtio serving on Kubernetes.

Usage:
  $(basename $0) [-h] [-k ca_key] [-c ca_crt] [MASTER_CLUSTER_IP] [MASTER_IP] [SECRET_NAME]

Options:
  -c ca_key    CA key
  -k ca_crt    CA certificate
  -h           Show this help
EOT
  exit
}

while getopts c:k:h OPT; do
  case $OPT in
    h)
      usage;;
    k)
      CA_KEY=$OPTARG;;
    c)
      CA_CRT=$OPTARG;;
  esac
done
shift $((OPTIND - 1))

MASTER_CLUSTER_IP=${1:-}
MASTER_IP=${2:-}
SECRET_NAME=${3:-hawtio-online-tls-serving}

if [ -z "$MASTER_CLUSTER_IP" ]; then
  echo "Argument <MASTER_CLUSTER_IP> must be set."
  exit 1
fi

if [ -z "$MASTER_IP" ]; then
  MASTER_IP=$(kubectl get nodes -ojsonpath='{$.items[].status.addresses[?(@.type=="InternalIP")].address}')
fi

DIR=`pwd`

# The CA private key
if [ -z "$CA_KEY" ]; then
  echo "Generate ca.key ..."
  openssl genrsa -out ca.key 2048
  CA_KEY=ca.key
fi

# The CA certificate
if [ -z "$CA_CRT" ]; then
  echo "Generate ca.crt ..."
  openssl req -x509 -new -nodes -key ca.key -subj "/CN=${MASTER_IP}" -days 10000 -out ca.crt
  CA_CRT=ca.crt
fi

cd "$TEMP_DIR"
cp "$DIR"/$CA_KEY ca.key
cp "$DIR"/$CA_CRT ca.crt

# Generate the private key
openssl genrsa -out server.key 2048

# Write the CSR config file
cat <<EOT > csr.conf
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[ dn ]
CN = $MASTER_IP

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster
DNS.5 = kubernetes.default.svc.cluster.local
IP.1 = $MASTER_IP
IP.2 = $MASTER_CLUSTER_IP

[ v3_ext ]
authorityKeyIdentifier=keyid,issuer:always
basicConstraints=CA:FALSE
keyUsage=keyEncipherment,dataEncipherment
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=@alt_names
EOT

# Generate the CSR
openssl req -new -key server.key -out server.csr -config csr.conf

# Issue the signed certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 10000 \
  -extensions v3_ext -extfile csr.conf

# View the certificate signing request & certificate
openssl req -noout -text -in ./server.csr
openssl x509 -noout -text -in ./server.crt

# Create the secret for Hawtio Online
kubectl create secret tls $SECRET_NAME --cert server.crt --key server.key
