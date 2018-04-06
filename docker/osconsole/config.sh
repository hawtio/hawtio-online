#!/bin/sh

if [ ! -n "${OPENSHIFT_MASTER:-}" ]; then
  >&2 echo OPENSHIFT_MASTER must be set
  exit 1
fi

if [ "${HAWTIO_ONLINE_MODE}" = "cluster" ]; then 
cat << EOF
window.OPENSHIFT_CONFIG = {
  master_uri: new URI().query('').path('/master').toString(),
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}'
  },
  openshift: {
    master_uri: '${OPENSHIFT_MASTER}',
    oauth_authorize_uri: new URI('${OPENSHIFT_MASTER}').path('/oauth/authorize').toString(),
    oauth_client_id: '${HAWTIO_OAUTH_CLIENT_ID:-hawtio-online}',
    scope: 'user:info user:check-access user:list-projects role:edit:*'
  }
};
EOF
elif [ "${HAWTIO_ONLINE_MODE}" = "namespace" ]; then
if [ -n "${HAWTIO_ONLINE_NAMESPACE:-}" ]; then
cat << EOF
window.OPENSHIFT_CONFIG = {
  master_uri: new URI().query('').path('/master').toString(),
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}',
    namespace: '${HAWTIO_ONLINE_NAMESPACE}'
  },
  openshift: {
    master_uri: '${OPENSHIFT_MASTER}',
    oauth_authorize_uri: new URI('${OPENSHIFT_MASTER}').path('/oauth/authorize').toString(),
    oauth_client_id: 'system:serviceaccount:${HAWTIO_ONLINE_NAMESPACE}:${HAWTIO_OAUTH_CLIENT_ID:-hawtio-online}',
    scope: 'user:info user:check-access role:edit:${HAWTIO_ONLINE_NAMESPACE}'
  }
};
EOF
else
  >&2 echo HAWTIO_ONLINE_NAMESPACE must be set when HAWTIO_ONLINE_MODE=namespace
  exit 1
fi
else
  >&2 echo Invalid value for the HAWTIO_ONLINE_MODE environment variable.
  >&2 echo It should either be \'cluster\' or \'namespace\', but is "${HAWTIO_ONLINE_MODE:-not set}".
  exit 1
fi;
