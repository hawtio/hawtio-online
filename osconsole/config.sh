#!/bin/sh

cat << EOF
window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {
  openshift: {
    oauth_authorize_uri: '${OPENSHIFT_MASTER}/oauth/authorize',
    oauth_client_id: 'system:serviceaccount:hawtio:hawtio-oauth-client',
    scope: 'user:info user:check-access role:edit:hawtio'
  }
};
EOF
