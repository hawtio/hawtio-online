#!/bin/sh

FORM_URI=/online/login.html

openshift_config_cluster() {
  cat << EOF
{
  master_uri: '/master',
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}'
  },
  openshift: {
    oauth_metadata_uri: '/master/.well-known/oauth-authorization-server',
    oauth_client_id: '${HAWTIO_OAUTH_CLIENT_ID:-hawtio-online}',
    scope: 'user:info user:check-access user:full',
    web_console_url: '${OPENSHIFT_WEB_CONSOLE_URL:-}',
    cluster_version: '${OPENSHIFT_CLUSTER_VERSION:-}'
  }
};
EOF
}

openshift_config_namespace() {
  cat << EOF
{
  master_uri: '/master',
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}',
    namespace: '${HAWTIO_ONLINE_NAMESPACE}',
  },
  openshift: {
    oauth_metadata_uri: '/master/.well-known/oauth-authorization-server',
    oauth_client_id: '${HAWTIO_OAUTH_CLIENT_ID:-hawtio-online}',
    scope: 'user:info user:check-access user:full',
    web_console_url: '${OPENSHIFT_WEB_CONSOLE_URL:-}',
    cluster_version: '${OPENSHIFT_CLUSTER_VERSION:-}'
  }
};
EOF
}

form_config_cluster() {
  cat << EOF
{
  master_uri: new URI().query('').path('/master').toString(),
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}'
  },
  form: {
    uri: new URI().query('').path('${FORM_URI}').toString()
  }
};
EOF
}

form_config_namespace() {
  cat << EOF
{
  master_uri: new URI().query('').path('/master').toString(),
  hawtio: {
    mode: '${HAWTIO_ONLINE_MODE}',
    namespace: '${HAWTIO_ONLINE_NAMESPACE}'
  },
  form: {
    uri: new URI().query('').path('${FORM_URI}').toString()
  }
};
EOF
}

cluster() {
  case "${HAWTIO_ONLINE_AUTH}" in
    "form") form_config_cluster;;
    "oauth") openshift_config_cluster;;
    *)
      # fallback to OpenShift OAuth for backward compatibility
      openshift_config_cluster;;
  esac
}

namespace() {
  if [ -z "${HAWTIO_ONLINE_NAMESPACE:-}" ]; then
    >&2 echo HAWTIO_ONLINE_NAMESPACE must be set when HAWTIO_ONLINE_MODE=namespace
    exit 1
  fi

  case "${HAWTIO_ONLINE_AUTH}" in
    "form") form_config_namespace;;
    "oauth") openshift_config_namespace;;
    *)
      # fallback to OpenShift OAuth for backward compatibility
      openshift_config_namespace;;
  esac
}

invalid() {
  >&2 echo Invalid value for the HAWTIO_ONLINE_MODE environment variable.
  >&2 echo It should either be \'cluster\' or \'namespace\', but is "${HAWTIO_ONLINE_MODE:-not set}".
  exit 1
}

case "${HAWTIO_ONLINE_MODE}" in
  "cluster") cluster;;
  "namespace") namespace;;
  *) invalid;;
esac
