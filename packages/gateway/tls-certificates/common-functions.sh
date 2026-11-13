CA_KEY=certificate-authority.key
CA_CERT=certificate-authority.crt

cli_binary() {
  local k
  c=$(command -v "${1}" 2> /dev/null)
  # shellcheck disable=SC2181
  if [ $? != 0 ]; then
    return
  fi

  echo "${c}"
}

kube_binary() {
  if [ -n "${KUBECLI}" ]; then
    k=$(cli_binary "${KUBECLI}")
  else
    # try finding oc
    k=$(cli_binary oc)
    if [ -z "${KUBECLI}" ]; then
      # try finding kubectl
      k=$(cli_binary kubectl)
    fi
  fi

  if [ -z "${k}" ]; then
    echo "Error: Cannot find kube cluster client command, eg. oc or kubectl"
    exit 1
  fi

  echo ${k}
}

extract_ca() {
  local k=${1:kubectl}

  # The CA private key
  ${k} get secrets/signing-key \
    -n openshift-service-ca \
    -o "jsonpath={.data['tls\.key']}" | base64 --decode > ${CA_KEY}

  if [ ! -f "${CA_KEY}" ]; then
    echo "Error: failed to extract Server Certificate Authority Key from cluster ... exiting"
    exit 1
  fi

  # The CA certificate
  ${k} get secrets/signing-key \
    -n openshift-service-ca \
    -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ${CA_CERT}

  if [ ! -f "${CA_CERT}" ]; then
    echo "Error: failed to extract Server Certificate Authority Certificate from cluster ... exiting"
    exit 1
  fi
}
