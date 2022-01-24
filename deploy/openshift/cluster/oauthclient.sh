#!/bin/bash

# OAuthClient requires a redirect URI with a route host name which
# the platform assigns to the route.

set -eu -o pipefail

redirect_uri=${1:-}
if [ -z "$redirect_uri" ]; then
  redirect_uri=$(oc get route hawtio-online -ojsonpath='{$.spec.host}')
fi

cat <<EOT | oc apply -f -
apiVersion: oauth.openshift.io/v1
kind: OAuthClient
metadata:
  name: hawtio-online
grantMethod: auto
redirectURIs:
- https://${redirect_uri}
EOT
