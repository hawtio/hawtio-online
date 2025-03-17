## Manual Installation

Prior to the deployment, depending on the cluster types you need to generate either of the _proxying_ or _serving_ certificates.

| Certificate | Description |
| ------------| ----------- |
| _Proxying_  | Used to secure the communication between Hawtio Online and the Jolokia agents. A client certificate is generated and mounted into the Hawtio Online pod with a secret, to be used for TLS client authentication. |
| _Serving_   | Used to secure the communication between the client and Hawtio Online. |

### OpenShift

#### Proxying certificates

For OpenShift, a client certificate must be generated using the [service signing certificate][service-signing-certificate] authority private key.

[service-signing-certificate]: https://docs.openshift.com/container-platform/latest/security/certificates/service-serving-certificate.html

Run the following script to generate and set up a client certificate for Hawtio Online:

```sh
./scripts/generate-proxying.sh
```

or if you have Yarn installed, this will also do the same thing:

```sh
yarn gen:proxying
```

#### Serving certificates

For OpenShift, a serving certificate is automatically generated for your Hawtio Online deployment using the [service signing certificate][service-signing-certificate] feature.

### Kubernetes

#### Proxying certificates

For Kubernetes, proxying certificates are disabled by default and you don't need to go through the steps.

> [!WARNING]
> This means that client certificate authentication between Hawtio Online and the Jolokia agents is not available by default for Kubernetes, and the Jolokia agents need to disable client certificate authentication so that Hawtio Online can connect to them. You can still use TLS for securing the communication between them.
>
> It is possible to use a proxying client certificate for Hawtio Online on Kubernetes; it requires you to generate or provide a custom CA for the certificate and then mount/configure it into the Jolokia agent for its client certificate authentication.

#### Serving certificates

For Kubernetes, a serving certificate must be generated manually. Run the following script to generate and set up a certificate for Hawtio Online:

```sh
./scripts/generate-serving.sh [-k tls.key] [-c tls.crt] [SECRET_NAME] [CN]
```

or:

```sh
yarn gen:serving [-k tls.key] [-c tls.crt] [SECRET_NAME] [CN]
```

You can provide an existing TLS key and certificate by passing parameters `-k tls.key` and `-c tls.crt` respectively. Otherwise, a self-signed `tls.key` and `tls.crt` will be generated automatically in the working directory and used for creating the serving certificate secret.

You can optionally pass `SECRET_NAME` and `CN` to customise the secret name and Common Name used in the TLS certificate. The default secret name is `hawtio-online-tls-serving` and CN is `hawtio-online.hawtio.svc`.

### Manual steps

Instead of running the scripts you can choose to perform everything manually.

For manual steps, see [Generating Certificates Manually](docs/generate-certificates.md).

## Deployment

Now you can run the following instructions to deploy the Hawtio Online console on your OpenShift/Kubernetes cluster.

There are two deployment modes you can choose from: **cluster** and **namespace**.

| Deployment Mode | Description |
| --------------- | ---------- |
| Cluster | The Hawtio Online console can discover and connect to _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed across multiple namespaces / projects. <br> **OpenShift:** Use an OAuth client that requires the `cluster-admin` role to be created. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See the [Preparation - OpenShift](#openshift) section for more information. |
| Namespace | This restricts the Hawtio Online console access to a single namespace / project, and as such acts as a single tenant deployment. <br> **OpenShift:** Use a service account as OAuth client, which only requires `admin` role in a project to be created. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See the [Preparation - OpenShift](#openshift) section for more information. |

<a name="f1">1</a>. Containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.

### OpenShift

You may want to read how to [get started with the CLI](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html) for more information about the `oc` client tool.

To deploy the Hawtio Online console on OpenShift, follow the steps below.

#### Cluster mode

If you have Yarn installed:

```sh
yarn deploy:openshift:cluster
```

otherwise (two commands):

```sh
oc apply -k deploy/openshift/cluster/
./deploy/openshift/cluster/oauthclient.sh
```

#### Namespace mode

If you have Yarn installed:

```sh
yarn deploy:openshift:namespace
```

otherwise:

```sh
oc apply -k deploy/openshift/namespace/
```

You can obtain the status of your deployment, by running:

```sh
$ oc status
In project hawtio on server https://192.168.64.12:8443

https://hawtio-online-hawtio.192.168.64.12.nip.io (reencrypt) (svc/hawtio-online)
  deployment/hawtio-online deploys hawtio/online:latest
    deployment #1 deployed 2 minutes ago - 1 pod
```

Open the route URL displayed above from your Web browser to access the Hawtio Online console.

### Kubernetes

You may want to read how to [get started with the CLI](https://kubernetes.io/docs/reference/kubectl/overview/) for more information about the `kubectl` client tool.

To deploy the Hawtio Online console on Kubernetes, follow the steps below.

#### Cluster mode

If you have Yarn installed:

```sh
yarn deploy:k8s:cluster
```

otherwise:

```sh
kubectl apply -k deploy/k8s/cluster/
```

#### Namespace mode

If you have Yarn installed:

```sh
yarn deploy:k8s:namespace
```

otherwise:

```sh
kubectl apply -k deploy/k8s/namespace/
```

