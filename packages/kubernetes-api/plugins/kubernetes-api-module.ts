/// <reference path="kubernetes-api.helpers.ts"/>

namespace KubernetesAPI {

  export const _module = angular.module(pluginName, []);

  function addProductInfo(aboutService: About.AboutService) {
    'ngInject';
    aboutService.addProductInfo('Hawtio Kubernetes API', 'PACKAGE_VERSION_PLACEHOLDER');
  }

  _module.run(addProductInfo);

  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'KubernetesApiConfig',
    depends: ['KubernetesApiInit'],
    task: (next) => {
      K8S_PREFIX = Core.trimLeading(Core.pathGet(osConfig, ['api', 'k8s', 'prefix']) || K8S_PREFIX, '/');
      next();
    }
  });

  // Since we're using jenkinshift in vanilla k8s, let's poll build configs by default
  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'AddPolledTypes',
    depends: ['KubernetesApiInit'],
    task: (next) => {
      if (!isOpenShift) {
        KubernetesAPI.pollingOnly.push(KubernetesAPI.WatchTypes.BUILD_CONFIGS);
      }
      next();
    }
  });

  // Detect if we're running against openshift or not
  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'KubernetesAPIProviderInit',
    depends: ['HawtioOAuthBootstrap', 'KubernetesApiInit'],
    task: (next) => {
      isOpenShift = false;
      const testURL = new URI(KubernetesAPI.masterUrl).segment('apis/apps.openshift.io/v1').toString();
      $.ajax(<any>{
        url: testURL,
        method: 'GET',
        success: (data) => {
          log.info("Backend is an openshift instance");
          isOpenShift = true;
          next();
        },
        error: (jqXHR, textStatus, errorThrown) => {
          log.info("Error probing " + testURL + " assuming backend is not an openshift instance.  Error details: status:", textStatus, "errorThrown: ", errorThrown, "jqXHR instance:", jqXHR);
          next();
        }
      });
    }
  });

  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'FetchConfig',
    task: (next) => {
      $.getScript('osconsole/config.js')
        .always(() => {
          log.debug('Fetched openshift config:', window['OPENSHIFT_CONFIG']);
          log.debug('Fetched keycloak config:', window['KeycloakConfig']);
          OSOAuthConfig = _.get(window, 'OPENSHIFT_CONFIG.openshift');
          GoogleOAuthConfig = _.get(window, 'OPENSHIFT_CONFIG.google');
          if (!OSOAuthConfig) {
            next();
            return;
          }
          if (OSOAuthConfig.oauth_authorize_uri) {
            next();
          } else if (OSOAuthConfig.oauth_metadata_uri) {
            log.debug('Fetching OAuth server metadata from:', OSOAuthConfig.oauth_metadata_uri);
            $.getJSON(OSOAuthConfig.oauth_metadata_uri)
              .done((metadata) => {
                OSOAuthConfig.oauth_authorize_uri = metadata.authorization_endpoint;
                OSOAuthConfig.issuer = metadata.issuer;
              })
              .always(() => next());
          } else {
            next();
          }
        });
    }
  }, true);

  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'KubernetesApiInit',
    depends: ['FetchConfig'],
    task: (next) => {
      const config: KubernetesConfig = KubernetesAPI.osConfig = window['OPENSHIFT_CONFIG'];
      log.debug("Fetched OAuth config:", config);
      let master = config.master_uri;
      if (!master && config.api && config.api.k8s) {
        const masterUri = new URI().host(config.api.k8s.hostPort).path("").query("");
        if (config.api.k8s.proto) {
          masterUri.protocol(config.api.k8s.proto);
        }
        master = masterUri.toString();
      }

      if (OSOAuthConfig && !master) {
        const oauth_authorize_uri = OSOAuthConfig.oauth_authorize_uri;
        if (oauth_authorize_uri) {
          const text = oauth_authorize_uri;
          let idx = text.indexOf("://");
          if (idx > 0) {
            idx += 3;
            idx = text.indexOf("/", idx);
            if (idx > 0) {
              master = text.substring(0, ++idx);
            }
          }
        }
      }
      // We'll just grab the URI for the document here in case we need it
      const documentURI = new URI().path(HawtioCore.documentBase());
      if (!master || master === "/") {
        // lets default the master to the current protocol and host/port
        // in case the master url is "/" and we are
        // serving up static content from inside /api/v1/namespaces/default/services/fabric8 or something like that
        log.info("master_url unset or set to '/', assuming API server is at /");
        master = documentURI.query("").toString();
      }
      if (master === "k8s") {
        // We're using the built-in kuisp proxy to access the API server
        log.info("master_url set to 'k8s', assuming proxy is being used");
        master = documentURI.query("").segment(master).toString();
      }
      log.info("Using kubernetes API URL:", master);
      KubernetesAPI.masterUrl = master;
      next();
    }
  });

  hawtioPluginLoader.addModule(pluginName);
}
