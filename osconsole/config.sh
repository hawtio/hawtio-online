#!/bin/sh

cat << EOF
window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {
  hawtio: {
    namespace: '${HAWTIO_NAMESPACE}'
  }
  openshift: {
    oauth_authorize_uri: '${OPENSHIFT_MASTER}/oauth/authorize',
    oauth_client_id: 'system:serviceaccount:${HAWTIO_NAMESPACE}:hawtio-oauth-client',
    scope: 'user:info user:check-access role:edit:${HAWTIO_NAMESPACE}'
  }
};
EOF
