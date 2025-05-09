#!/bin/bash

set -o pipefail

usage() {
  cat <<EOT
This script creates a service-account user with a bearer token for form authentication access

Usage:
  $(basename "$0") [-n <namespace>]

Options:
  -n           Target namespace
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

while getopts :h:n: OPT; do
  case $OPT in
    h)
      usage;;
    n)
      NAMESPACE=$OPTARG;;
    *)
      ;;
  esac
done
shift $((OPTIND - 1))

if [ -n "${KUBE}" ]; then
  KUBE=$(kube_binary "${KUBE}")
else
  # try finding oc
  KUBE=$(kube_binary oc)
  if [ -z "${KUBE}" ]; then
    # try finding kubectl
    KUBE=$(kube_binary kubectl)
  fi
fi

if [ -z "${KUBE}" ]; then
  echo "Error: Cannot find kube cluster client command, eg. kubectl or oc"
  exit 1
fi

if [ -z "${NAMESPACE}" ]; then
  NAMESPACE=$(${KUBE} config view --minify -o jsonpath='{..namespace}')

  if [ -z "${NAMESPACE}" ]; then
    echo "Error: Cannot determine the target namespace for the new secret"
    exit 1
  fi
fi

if [ -z "${HAWTIO_USER}" ]; then
  HAWTIO_USER="hawtio-user"
fi

#
# Creating a ServiceAccount
#
${KUBE} get sa ${HAWTIO_USER} > /dev/null
if [ "$?" == "0" ]; then
  echo "Skipping Service Account ... (${HAWTIO_USER}) already exists"
else
  echo "Creating Service Account ${HAWTIO_USER} ..."
  cat <<EOF | ${KUBE} apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${HAWTIO_USER}
  namespace: ${NAMESPACE}
EOF
fi

#
# Creating a RoleBinding/ClusterRoleBinding
#
${KUBE} get ClusterRoleBinding ${HAWTIO_USER} > /dev/null
if [ "$?" == "0" ]; then
  echo "Skipping Cluster Role Binding ... (${HAWTIO_USER}) already exists"
else
  echo "Creating Cluster Role Binding for ${HAWTIO_USER} ..."
  cat <<EOF | ${KUBE} apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${HAWTIO_USER}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: ${HAWTIO_USER}
  namespace: ${NAMESPACE}
EOF
fi

#
# Getting a bearer token
#
echo "Creating bearer token for ${HAWTIO_USER} ..."
${KUBE} -n ${NAMESPACE} create token ${HAWTIO_USER}
