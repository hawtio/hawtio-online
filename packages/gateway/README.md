# Hawtio Online Gateway

A partner image, base on [node](https://nodejs.org), to the Hawtio Online image that provides support to the functions of the Hawtio Online nginx server.

- The Hawtio Online nginx server will defer to the gateway's [_/master_] endpoint to check the permissability of the requested uri. If the uri is acceptable then the gateway will
  proxy to the cluster API server;
- The Hawtio Online nginx server will defer to the gateway's [_/managment_] endpoint to access
  the jolokia endpoint. The result of this endpoint involves a back and forth between internal
  endpoints of both the nginx and gateway servers;
- The Hawtio Online nginx server will defer to the gateway's [_/logout_] endpoint to redirect
  to the uri's _redirect_uri_ parameter;
- The gateway also has a [_/status_] endpoint which provides a heartbeat capability.

This image replaces the functionality originally provided by nginx njs.

## Deployment

No additional effort should be required to install the gateway image from the [deploy](https://github.com/hawtio/hawtio-online/tree/main/deploy) as it is included in the existing install command (`make install`).

### Custom Deployment

Should there be a need to create a custom, development, version then the environment variable, `CUSTOM_GATEWAY_IMAGE` can be populated to change the image. However, bear in mind that the version of this image should always be the same as the hawtio online image so populating `CUSTOM_VERSION` will also require a latter image with that version.

### Logging of the Deployment

By default, the logging level of the gateway container log is set to 'info'. Should more
information be required then this can be modified to either 'debug' or 'trace' by adding
the environment variable `HAWTIO_ONLINE_GATEWAY_LOG_LEVEL` to the deployment:

- `kubectl/oc edit deployment hawtio-online`: Open the deployment resource for editing
- Add the environment variable `HAWTIO_ONLINE_GATEWAY_LOG_LEVEL` with the preferred level
  to the `hawtio-online-gateway` container:
  ```
  - env:
    - name: HAWTIO_ONLINE_RBAC_ACL
    ...
    - name: HAWTIO_ONLINE_GATEWAY_LOG_LEVEL
      value: trace
  ```
- Save the edit and await the re-deployment of the pod.

## Development

The project file for the gateway provides the following commands that will aid in development and testing of the image:

- `yarn start:gateway-dev`: Starts a development server that replicates the functions of the hawtio online nginx web server;
- `yarn start:gateway-server`: Starts a development version of the gateway server;
- `yarn start:gateway`: Starts both the development servers that should point to one another to allow end-to-end testing of the functionality;
- `yarn build`: Builds the product version of the gateway server.

### Changing properties of the development servers

An `.env.development` file should be created in the [gateway](https://github.com/hawtio/hawtio-online/tree/main/packages/gateway) package directory. A [default](https://github.com/hawtio/hawtio-online/tree/main/packages/gateway/env.development.defaults) version is already provided in the directory and can be copied and modified to suit the individual install. The following are available environment variables:

#### Common variables

- HAWTIO_ONLINE_GATEWAY_APP_PORT: The port that the gateway server listens on. It has a default of 3000. Probably only if there is a conflict on the individual system should need to be changed;
- LOG_LEVEL: This is the minimum level of logging to display. Should extra logging be displayed then other values are `debug` and `trace`;
- NODE_TLS_REJECT_UNAUTHORIZED: Tells node to ignore verification of certificates. In some kubernetes installs, certificates might be self-signed and so prevents the gateway server connecting to the kubernetes api server. Therefore, by setting to '0', verification is disabled. Only if certain, should this probably be changed;
- HAWTIO_ONLINE_GATEWAY_CLUSTER_IS_OPENSHIFT: Tells the gateway the kind of cluster to expect. Certain api calls, eg. SAR endpoints, are different between vanilla kubernetes and OpenShift so if the gateway is run external to a cluster then it has to be told the type of cluster;
- HAWTIO_ONLINE_GATEWAY_IS_EXTERNAL: Tells the gateway whether it is running internal to a cluster or externally. Some calls to jolokia endpoints are different if the server is running internally to the cluster, ie. the external kubernetes API is not required since the target app can be accessed directly via internal ip addresses.
- HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER: The URI of the kubenenetes cluster api server, eg. [https://api.crc.testing:6443](https://api.crc.testing:6443). This will be the default of [https://kubernetes.default] if running internally in a cluster but should be changed to the correct location for the kubernetes cluster, if running externally;
- HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY: Specifies an **SSL certificate key** to allow access to target apps secured with an SSL certificate. By default, OpenShift requires this for connection to any target app;
- HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE: Specifies an **SSL certificate** to allow access to target apps secured with an SSL certificate. By default, OpenShift requires this for connection to any target app;
- HAWTIO_ONLINE_GATEWAY_SSL_KEY: path to a valid **SSL certificate key** file for starting the gateway server in https mode;
- HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE: path to a valid **SSL certificate** file for starting the gateway server in https mode;
- HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA: path to a valid **SSL certificate authority** file for starting the gateway server in https mode;
- HAWTIO_ONLINE_MASK_IP_ADDRESSES: Can hide any ip addresses that are displayed in any responses returned from target app jolokia communication. Care should be taken as this can break certain responses (default is false).

#### Variables used with development web server (proxy-dev-server.js)

- HAWTIO_ONLINE_GATEWAY_DEV_WEB_PORT: The port that the development web server listens on (3001 by default). Modifying this will change both this server and the gateway server to ensure both can still contact one another. Probably only if there is a conflict on the individual system should need to be changed;
- HAWTIO_ONLINE_GATEWAY_CLUSTER_TOKEN: A token that allows connection to the kubernetes cluster. In production, this is obtained from the Hawtio Online authentication mechanisms. For development this should be provided. Note: this token can expire so should be updated if testing starts resulting in 403 errors;LOKIA_SERVICE=test-jolokia

Since the development nginx server is external to the kubernetes cluster, it is unable to access internal application jolokia ports. Therefore, the jolokia server of this test app must be exposed using a service. This service can be created by populating and applying the template [file](https://github.com/hawtio/hawtio-online/tree/main/packages/gateway/jolokia-testing-service.yml) included in the project:

```
apiVersion: v1
kind: Service
metadata:
  name: test-jolokia
  namespace: <TEST APP NAMESPACE>
spec:
  ports:
  - port: <EXPOSED JOLOKIA-PORT>
    protocol: TCP
    targetPort: <EXPOSED JOLOKIA-PORT>
  selector:
    app: <SELECT-POD-LABEL>
  type: ClusterIP

# TEST APP NAMESPACE is the namespace where the test app is located
# SELECT-POD-LABEL is a unique label that is located on the test app pod and allows the service to find the correct pod
```

Once the service has been created then the following properties should be populated in the `.env.development` file:

- TEST_JOLOKIA_PORT: The exposed port of the jolokia service;
- TEST_JOLOKIA_PATH: The part of the jolokia service accessed on the test app, eg. `actuator/jolokia/?ignoreErrors=true&canonicalNaming=false`
