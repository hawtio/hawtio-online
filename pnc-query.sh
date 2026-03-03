#!/bin/bash

ONLINE_PACKAGE_JSON_FILE=packages/online-shell/package.json
if [ ! -f ${ONLINE_PACKAGE_JSON_FILE} ]; then
  echo "Cannot find the online-shell/package.json file. Something has gone wrong!"
  exit 1
fi

MGMT_PACKAGE_JSON_FILE=packages/management-api/package.json
if [ ! -f ${MGMT_PACKAGE_JSON_FILE} ]; then
  echo "Cannot find the management-api/package.json file. Something has gone wrong!"
  exit 1
fi

declare -A DEPENDENCY_PACKAGE=(
  ["@hawtio/react"]="${ONLINE_PACKAGE_JSON_FILE}"
  ["jolokia.js"]="${MGMT_PACKAGE_JSON_FILE}"
  ["@jolokia.js/simple"]="${MGMT_PACKAGE_JSON_FILE}"
)

declare -A COMM_VERSIONS
declare -A COMM_MINOR_VERSIONS
for PKG in "${!DEPENDENCY_PACKAGE[@]}"; do
  FILE="${DEPENDENCY_PACKAGE[${PKG}]}"

  COMM_VERSIONS[${PKG}]=$(cat ${FILE} | jq -r --arg pkg_name "${PKG}" '.dependencies.[$pkg_name]' | sed -E 's/^[~^]//')
  COMM_MINOR_VERSIONS[${PKG}]=$(echo ${COMM_VERSIONS[${PKG}]} | cut -d. -f1,2)
  echo "Community version of ${PKG} => ${COMM_VERSIONS[${PKG}]} (${COMM_MINOR_VERSIONS[${PKG}]})"
done

PNC_ARTIFACTS_URL="http://orch.psi.redhat.com/pnc-rest/v2/artifacts"

declare -A PROD_VERSIONS
for PKG in "${!DEPENDENCY_PACKAGE[@]}"; do
  # query should translate to testing *hawtio*react*1.10*
  query=$(echo "%2A${PKG}:${COMM_MINOR_VERSIONS[${PKG}]}%2A" | sed 's#/#%2A#g')
  identifier=$(curl -s "${PNC_ARTIFACTS_URL}/filter?identifier=${query}&qualities=NEW&repoType=NPM" | jq -r '.content|last|.identifier')
  if [ -z "${identifier}" ]; then
    echo "Error: No identifer for ${PKG} can be found with a major/minor version of ${COMM_MINOR_VERSIONS[${PKG}]}"
    exit 1
  fi
  PROD_VERSIONS[${PKG}]=$(echo ${identifier} | sed 's/.*:\(.*\)/\1/')
  echo "Production version of ${PKG} => ${PROD_VERSIONS[${PKG}]}"
done

HAWTIO_REACT_NPM_VERSION=${PROD_VERSIONS["@hawtio/react"]}
echo "Using @hawtio/react npm version ${HAWTIO_REACT_NPM_VERSION}"

JOLOKIA_PINNED_VERSION={{jolokiaVersion}}
if [ -n "${JOLOKIA_PINNED_VERSION}" ] && [ "${JOLOKIA_PINNED_VERSION}" != "{{jolokiaVersion}}" ]; then
  JOLOKIA_JS_NPM_VERSION=${JOLOKIA_PINNED_VERSION}
  JOLOKIA_SIMPLE_NPM_VERSION=${JOLOKIA_PINNED_VERSION}
else
  JOLOKIA_JS_NPM_VERSION=${PROD_VERSIONS["jolokia.js"]}
  JOLOKIA_SIMPLE_NPM_VERSION=${PROD_VERSIONS["@jolokia.js/simple"]}
fi

echo "Using jolokia.js npm version ${JOLOKIA_JS_NPM_VERSION}"
echo "Using @jolokia.js/simple npm version ${JOLOKIA_SIMPLE_NPM_VERSION}"

ARTEMIS_PINNED_NAME={{artemisName}}
ARTEMIS_PINNED_VERSION={{artemisVersion}}
if [ -n "${ARTEMIS_PINNED_VERSION}" ] && [ "${ARTEMIS_PINNED_VERSION}" != "{{artemisVersion}}" ]; then
  ARTEMIS_NPM_NAME=${ARTEMIS_PINNED_NAME}
  ARTEMIS_NPM_VERSION=${ARTEMIS_PINNED_VERSION}
else
  pkg="@hawtio/artemis-console-plugin"
  query=$(echo "%2A${pkg}:%2A" | sed 's#/#%2A#g')
  identifier=$(curl -s "${PNC_ARTIFACTS_URL}/filter?identifier=${query}&qualities=NEW&repoType=NPM" | jq -r '.content|last|.identifier')
  if [ -z "${identifier}" ]; then
    echo "Error: No identifer for ${pkg} can be found."
    exit 1
  fi

  ARTEMIS_NPM_NAME=$(echo ${identifier} | sed 's/\(.*\):.*/\1/')
  ARTEMIS_NPM_VERSION=$(echo ${identifier} | sed 's/.*:\(.*\)/\1/')

  if [ -z "${ARTEMIS_NPM_NAME}" ] || [ -z "${ARTEMIS_NPM_VERSION}" ]; then
    echo "ERROR: Artemis NPM name or version not extracted!"
    exit 1
  fi

  echo "Production name of ${pkg} => ${ARTEMIS_NPM_NAME}"
  echo "Production version of ${pkg} => ${ARTEMIS_NPM_VERSION}"
fi

echo "Using artemis npm version ${ARTEMIS_NPM_NAME}"
echo "Using artemis npm version ${ARTEMIS_NPM_VERSION}"
