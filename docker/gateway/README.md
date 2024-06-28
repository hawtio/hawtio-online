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

## Development

The project file for the gateway provides the following commands that will aid in development and testing of the image:

- `yarn start:gateway-dev`: Starts a development server that replicates the functions of the hawtio online nginx web server;
- `yarn start:gateway-server`: Starts a development version of the gateway server;
- `yarn start:gateway`: Starts both the development servers that should point to one another to allow end-to-end testing of the functionality;
- `yarn build`: Builds the product version of the gateway server.

### Changing properties of the development servers

An `.env.development` file should be created in the [gateway](https://github.com/hawtio/hawtio-online/tree/main/docker/gateway) package directory. A [default](https://github.com/hawtio/hawtio-online/tree/main/docker/gateway/env.development.defaults) version is already provided in the directory and can be copied and modified to suit the individual install. The following are environment variables that can be updated:

- HAWTIO_ONLINE_GATEWAY_APP_PORT: The port that the gateway server listens on. It has a default of 3000. Probably only if there is a conflict on the individual system should need to be changed;
- LOG_LEVEL: This is the minimum level of logging to display. Should extra logging be displayed then other values are `debug` and `trace`;
- NODE_TLS_REJECT_UNAUTHORIZED: Tells node to ignore verification of certificates. In some kubernetes installs, certificates might be self-signed and so prevents the gateway server connecting to the kubernetes api server. Therefore, by setting to '0', verification is disabled. Only if certain, should this probably be changed;
- HAWTIO_ONLINE_GATEWAY_DEV_WEB_PORT: The port that the development web server listens on (3001 by default). Modifying this will change both this server and the gateway server to ensure both can still contact one another. Probably only if there is a conflict on the individual system should need to be changed;
- HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER: The URI of the kubenenetes cluster api server, eg. [https://api.crc.testing:6443](https://api.crc.testing:6443). This should be changed to the correct location for the installed kubernetes cluster;
- HAWTIO_ONLINE_GATEWAY_CLUSTER_TOKEN: A token that allows connection to the kubernetes cluster. In production, this is obtained from the Hawtio Online authentication mechanisms. For development this should be provided. Note: this token can expire so should be updated if testing starts resulting in 403 errors;LOKIA_SERVICE=test-jolokia

Since the development nginx server is external to the kubernetes cluster, it is unable to access internal application jolokia ports. Therefore, the jolokia server of this test app must be exposed using a service. This service can be created by populating and applying the template [file](https://github.com/hawtio/hawtio-online/tree/main/docker/gateway/jolokia-testing-service.yml) included in the project:

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

The following properties allow the gateway server to be started using the https protocol. This is the default for the production builds but populating these can start the development server also:

- HAWTIO_ONLINE_GATEWAY_SSL_KEY: path to a valid ssl key file
- HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE: path to a valid ssl certificate file
- HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA: path to a valid ssl certificate authority file
