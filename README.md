# Hawtio Online

[![Test](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml/badge.svg)](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml)

An Hawtio console that eases the discovery and management of [_hawtio-enabled_ applications](#hawtio-enabled-application-examples) deployed on OpenShift and Kubernetes.

<p align="center">
  <img align="center" src="docs/overview.gif">
</p>

## Hawtio-enabled application examples

A _hawtio-enabled_ application is an application that is composed of containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.

Look at the separate examples project for understanding how you can set up a _hawtio-enabled_ application for Hawtio Online.

- [Hawtio-Enabled Application Examples for Hawtio Online](https://github.com/hawtio/hawtio-online-examples)

## Preparation

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

For Kubernetes, proxing certificates are disabled by default and you don't need to go through the steps.

> :warning: This means that client certificate authentication between Hawtio Online and the Jolokia agents is not available by default for Kubernetes, and the Jolokia agents need to disable client certificate authentication so that Hawtio Online can connect to them. You can still use TLS for securing the communication between them.
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

| Deployment Mode | Descripton |
| --------------- | ---------- |
| Cluster | The Hawtio Online console can discover and connect to _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed across multiple namespaces / projects. <br> **OpenShift:** Use an OAuth client that requires the `cluster-admin` role to be created. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See the [Preparation - OpenShift](#openshift) section for more information. |
| Namespace | This restricts the Hawtio Online console access to a single namespace / project, and as such acts as a single tenant deployment. <br> **OpenShift:** Use a service account as OAuth client, which only requires `admin` role in a project to be created. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See the [Preparation - OpenShift](#openshift) section for more information. |

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

## Authentication

Hawtio Online currently supports two authentication modes: `oauth` and `form`, which is configured through `HAWTIO_ONLINE_AUTH` environment variable on Deployment.

| Mode | Description |
| ---- | ----------- |
| oauth | Authenticates requests through [OpenShift OAuth server](https://docs.openshift.com/container-platform/4.9/authentication/understanding-authentication.html). It is available only on OpenShift. |
| form | Authenticates requests with [bearer tokens](https://kubernetes.io/docs/reference/access-authn-authz/authentication/) throught the Hawtio login form. |

### Creating user for Form authentication

With the Form authentication mode, any user with a bearer token can be authenticated. See [Authenticating](https://kubernetes.io/docs/reference/access-authn-authz/authentication/) for different ways to provide users with bearer tokens.

Here we illustrate how to create a `ServiceAccount` as a user to log in to the Hawtio console as an example. See [Creating a Hawtio user for Form authentication](docs/create-user.md) for more details.

## RBAC

See [RBAC](docs/rbac.md).

## Development

### Tools

You must have the following tools installed:

- [Node.js](http://nodejs.org) (version `18` or higher)
- [Yarn](https://yarnpkg.com) (version `3.6.0` or higher)

### Build

```
yarn install
```

### Install

In order to authenticate and obtain OAuth access tokens for the Hawtio console be authorized to watch for _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed in your cluster, you have to create an OAuth client that matches localhost development URLs.

##### Cluster mode

```sh
oc create -f oauthclient.yml
```

See [OAuth Clients](https://docs.openshift.com/container-platform/latest/authentication/configuring-oauth-clients.html#oauth-default-clients_configuring-oauth-clients) for more information.

##### Namespace mode

```sh
oc create -f serviceaccount.yml
```

See [Service Accounts as OAuth Clients](https://docs.openshift.com/container-platform/latest/authentication/using-service-accounts-as-oauth-client.html) for more information.

### Run

##### Cluster mode

```
yarn start --master=`oc whoami --show-server` --mode=cluster
```

##### Namespace mode

```
yarn start --master=`oc whoami --show-server` --mode=namespace --namespace=`oc project -q`
```

You can access the console at <http://localhost:2772/>.

### Disable Jolokia authentication for deployments (dev only)

In order for a local hawtio-online to detect the hawtio-enabled applications, each application container needs to be configured with the following environment variables:

```
AB_JOLOKIA_AUTH_OPENSHIFT=false
AB_JOLOKIA_PASSWORD_RANDOM=false
AB_JOLOKIA_OPTS=useSslClientAuthentication=false,protocol=https
```

The following script lets you apply the above environment variables to all the deployments with a label `provider=fabric8` in a batch:

```sh
./scripts/disable-jolokia-auth.sh
```
