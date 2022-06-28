#!/bin/bash

set -e -o pipefail

usage() {
  cat <<EOT
This script creates a TLS secret for Hawtio serving on Kubernetes.

Usage:
  $(basename $0) [-h] [-k tls_key] [-c tls_crt] [SECRET_NAME] [CN]

Options:
  -c tls_key   TLS key
  -k tls_crt   TLS certificate
  -h           Show this help
EOT
  exit
}

while getopts c:k:h OPT; do
  case $OPT in
    h)
      usage;;
    k)
      TLS_KEY=$OPTARG;;
    c)
      TLS_CRT=$OPTARG;;
    *)
      ;;
  esac
done
shift $((OPTIND - 1))

SECRET_NAME=${1:-hawtio-online-tls-serving}
CN=${2:-hawtio-online.hawtio.svc}

# The TLS private key
if [ -z "$TLS_KEY" ]; then
  echo "Generate tls.key ..."
  openssl genrsa -out tls.key 2048
  TLS_KEY=tls.key
fi

# The TLS certificate
if [ -z "$TLS_CRT" ]; then
  echo "Generate tls.crt ..."
  openssl req -x509 -new -nodes -key tls.key -subj "/CN=${CN}" -days 365 -out tls.crt
  TLS_CRT=tls.crt
fi

# Create the secret for Hawtio Online
kubectl create secret tls $SECRET_NAME --cert tls.crt --key tls.key
