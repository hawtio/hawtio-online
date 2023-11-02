#!/bin/bash

set -e -o pipefail

if [ -z "${1}" ]; then
  echo "Error: no directory specified"
  exit 1
fi

if [ ! -d "${1}" ]; then
  echo "Error: directory does not exist"
  exit 1
fi

kubectl \
  kustomize --load-restrictor LoadRestrictionsNone "${1}" | \
  kubectl apply -f -
