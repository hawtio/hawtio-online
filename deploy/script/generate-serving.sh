#!/bin/bash

set -e -o pipefail

usage() {
  cat <<EOT
This script creates a TLS secret for Hawtio serving on Kubernetes.

Usage:
  $(basename "$0") [-h] [-k tls_key] [-c tls_crt] [SECRET_NAME] [CN]

Options:
  -c tls_key   TLS key
  -k tls_crt   TLS certificate
  -h           Show this help
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
  echo "Error: Cannot find kube cluster client command, eg. kubectl or oc"
  exit 1
fi

if [ -z "${NAMESPACE}" ]; then
  NAMESPACE=$(${KUBECLI} config view --minify -o jsonpath='{..namespace}')

  if [ -z "${NAMESPACE}" ]; then
    echo "Error: Cannot determine the target namespace for the new secret"
    exit 1
  fi
fi

SECRET_NAME=${1:-hawtio-online-tls-serving}
CN=${2:-hawtio-online.hawtio.svc}

# The TLS private key
if [ -z "${TLS_KEY}" ]; then
  echo "Generate tls.key ..."
  openssl genrsa -out tls.key 2048
  TLS_KEY=tls.key
fi

# The TLS certificate
if [ -z "${TLS_CRT}" ]; then
  echo "Generate tls.crt ..."
  openssl req -x509 -new -nodes -key tls.key -subj "/CN=${CN}" -days 365 -out tls.crt
  TLS_CRT=tls.crt
fi

if ${KUBECLI} get secret "${SECRET_NAME}" -n "${NAMESPACE}" 1> /dev/null 2>& 1; then
  echo "The secret ${SECRET_NAME} in ${NAMESPACE} already exists"
  exit 0
fi

# Create the secret for Hawtio Online
${KUBECLI} create secret tls "${SECRET_NAME}" --cert tls.crt --key tls.key -n "${NAMESPACE}"
