## Helm Chart Installation

Helm Charts help define, install, and upgrade Kubernetes application. Hawtio-Online now has a set of charts to allow for full installation and customization.

The repository for the charts is located at [https://hawtio.github.io/hawtio-charts](https://hawtio.github.io/hawtio-charts).

### Preparation

Add the chart repository to the local helm [configuration](https://helm.sh/docs/helm/helm_repo_add):
```
$ helm repo add hawtio https://hawtio.github.io/hawtio-charts
```

Confirm the addition of the repository:
```
$ helm repo list

NAME    URL
hawtio  https://hawtio.github.io/hawtio-charts
```

List the contents of the helm repository using the helm [search](https://helm.sh/docs/helm/helm_search_repo) command (the `--devel` switch is required due to the versions being development releases):
```
$ helm search repo hawtio

NAME                                    CHART VERSION   APP VERSION     DESCRIPTION
...
hawtio/hawtio-online                    1.0.0           2.2.0           A Helm chart for installing HawtIO
...
```

### Installation

> [!WARNING]
> It is important to ensure the correct cluster type is chosen for the install, since helm has no way to verify the type of cluster is correct. Asserting the wrong cluster type can have unexpected results due to issues such as certificate generation and signing

##### Default Configuration

Hawtio-Online can be installed using the following command:
```
$ helm install hawtio-online hawtio/hawtio-online

NAME: hawtio-online
LAST DEPLOYED: Tue Apr  1 18:27:36 2025
NAMESPACE: hawtio-dev
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
Thank you for installing hawtio-online 2.2.0.

The release is named hawtio-online.

The following install configuration was selected
- The type of the target cluster [openshift | k8s]:         openshift
- The mode of installation [cluster | namespace]:           namespace
- Whether to use the hawtconfig config map [true | false]:  true

To learn more about the release, try:

  $ helm status hawtio-online
  $ helm get all hawtio-online

To learn more about hawtio, please visit https://hawt.io.
```
This default install makes a number of assumptions about the installation:
* The namespace of the installation has already been selected in the target cluster since helm will install into the current namespace;
* The cluster type is OpenShift since this is the default of the helm charts configuration;
* The mode is defaulted to 'namespace';
* A hawtconfig configmap resource is created by default.


##### Customized Configuration

To change any value in the install configuration, it is necessary to add it to the helm install command. This is standard way for customizing a helm installation and documentation is available from [helm](https://helm.sh/docs/intro/using_helm/#customizing-the-chart-before-installing).

The values that can be customized in the hawtio-online install are displayed using:
```
$ helm show values hawtio/hawtio-online

# Default values for hawtio-online.

# The mode of installation [ cluster | namespace ]
mode: namespace
# The type of the target cluster [ openshift | k8s ]
clusterType: openshift
# Use hawtconfig config map [ true | false ]
hawtconfig: true
# Use internal SSL [ true | false ]
#  - Only required if clusterType is k8s
internalSSL: true

# The url of the OpenShift Console
# (only applicable to clusterType: openshift)
# consoleUrl:

online:
  name: hawtio-online
  shortname: hawtio
  rbac:
    name: hawtio-rbac
  application: hawtio-online
  replicaCount: 1
  image:
    name: quay.io/hawtio/online
    tag: 2.3.0
    pullPolicy: Always
  deployment:
    plain:
      scheme: HTTP
      port: 8080
    ssl:
      scheme: HTTPS
      port: 8443
    port: 8443
  service:
    plain:
      port: 80
    ssl:
      port: 443
  resources:
    requests:
      cpu: "0.2"
      memory: 32Mi
    limits:
      cpu: "1.0"
      memory: 500Mi
  secrets:
    serving:
      name: hawtio-online-tls-serving
    proxy:
      name: hawtio-online-tls-proxying
  authClientId: hawtio-online

gateway:
  name: hawtio-online-gateway
  image:
    name: quay.io/hawtio/online-gateway
    tag: 2.3.0
    pullPolicy: Always
  deployment:
    port: 3000
```

So, as the helm documentation describes, either
* use the `--values` switch to specify a yaml file with updated properties or
* use the `--set` switch to override particular properties.

For example, to install Hawtio-Online using the following configuration:
* Cluster type: Kubernetes
* Mode: cluster
```
$ helm install \
  --set clusterType=k8s \
  --set mode=cluster \
  hawtio-online hawtio/hawtio-online
```

###### SSL Termination at Ingress
In some kubernetes clusters, it may be preferred to terminate the SSL encryption at the ingress and have unsecured communication internal to the cluster. In that case, override the `internalSSL` property:
```
$ helm install \
  --set clusterType=k8s \
  --set mode=cluster \
  --set internalSSL=false \
  hawtio-online hawtio/hawtio-online
```
This has the effect of stripping out the _hawtio-serving_ certificate being applied to the internal deployment servers, updates the http protocol to plain rather from SSL and changes the ports to expected plain values.
