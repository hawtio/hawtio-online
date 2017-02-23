window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {
  master_uri: 'https://open.paas.redhat.com/',
  auth: {
    oauth_authorize_uri: 'https://open.paas.redhat.com/oauth/authorize',
    oauth_client_id: 'system:serviceaccount:hawtio:hawtio-oauth-client',
    scope: 'user:info user:check-access role:edit:hawtio'
  }
};