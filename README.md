# Hawtio Online

[![Test](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml/badge.svg)](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml)

An Hawtio console that eases the discovery and management of [_hawtio-enabled_ applications](#hawtio-enabled-application-examples) deployed on OpenShift and Kubernetes.

<p align="center">
  <img align="center" src="docs/overview.gif" alt="Hawtio Online overview">
</p>

## Hawtio-enabled application examples

A _hawtio-enabled_ application is an application that is composed of containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.

Look at the separate examples project for understanding how you can set up a _hawtio-enabled_ application for Hawtio Online.

- [Hawtio-Enabled Application Examples for Hawtio Online](https://github.com/hawtio/hawtio-online-examples)

## Installation

There are alternative methods of installation available to directly install Hawtio-Online:

* via [Helm Charts](docs/install/helm-charts.md)
* via [Makefile and Kustomize](docs/install/kustomize.md)
* via [Manual Commands](docs/install/manual.md)

Each method will require the following: 

* specifying the type of cluster targetted for the installation (either OpenShift or Kubernetes), thereby ensuring the correct certificates are generated for secure (SSL) access;
* the namespace targetted for the installation
* the 'mode' of the installation, ie. whether hawtio-online should be able to discover jolokia application cluster-wide (cluster) or only in the installed namespace (namespace);

### Verification of Install

The Hawtio-Online deployment, pod and service should be installed into the cluster:
```
$ oc get deploy
NAME                                   READY   UP-TO-DATE   AVAILABLE   AGE
hawtio-online                          1/1     1            1           26m

$ oc get pods
NAME                                   READY   STATUS      RESTARTS        AGE
hawtio-online-65dcfdd49c-jfzvj         2/2     Running     0              26m

$ oc get services
NAME                                   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)         AGE
hawtio-online                          NodePort    10.217.4.162   <none>        443:31914/TCP   27m
```

### Authentication

Hawtio Online currently supports two authentication modes: `oauth` and `form`, which is configured through `HAWTIO_ONLINE_AUTH` environment variable on Deployment.

| Mode | Description |
| ---- | ----------- |
| oauth | Authenticates requests through [OpenShift OAuth server](https://docs.openshift.com/container-platform/4.9/authentication/understanding-authentication.html). It is available only on OpenShift. |
| form | Authenticates requests with [bearer tokens](https://kubernetes.io/docs/reference/access-authn-authz/authentication/) throught the Hawtio login form. |

### Creating user for Form authentication

With the Form authentication mode, any user with a bearer token can be authenticated. See [Authenticating](https://kubernetes.io/docs/reference/access-authn-authz/authentication/) for different ways to provide users with bearer tokens.

Here we illustrate how to create a `ServiceAccount` as a user to log in to the Hawtio console as an example. See [Creating a Hawtio user for Form authentication](docs/create-user.md) for more details.

## RBAC

To provision the installation for RBAC support, please see [RBAC](docs/rbac.md).

## Development

### Tools

You must have the following tools installed:

- [Node.js](http://nodejs.org) (version `18` or higher)
- [Yarn](https://yarnpkg.com) (version `3.6.0` or higher)

### Build

```sh
yarn install
```

### Install

In order to authenticate and obtain OAuth access tokens for the Hawtio console be authorized to watch for _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed in your cluster, you have to create an OAuth client that matches localhost development URLs.

#### Cluster mode

```sh
oc create -f oauthclient.yml
```

See [OAuth Clients](https://docs.openshift.com/container-platform/latest/authentication/configuring-oauth-clients.html#oauth-default-clients_configuring-oauth-clients) for more information.

#### Namespace mode

```sh
oc create -f serviceaccount.yml
```

See [Service Accounts as OAuth Clients](https://docs.openshift.com/container-platform/latest/authentication/using-service-accounts-as-oauth-client.html) for more information.

### Run

#### Cluster mode

```sh
yarn start --master=`oc whoami --show-server` --mode=cluster
```

#### Namespace mode

```sh
yarn start --master=`oc whoami --show-server` --mode=namespace --namespace=`oc project -q`
```

You can access the console at <http://localhost:2772/>.

### Disable Jolokia authentication for deployments (dev only)

In order for a local hawtio-online to detect the hawtio-enabled applications, each application container needs to be configured with the following environment variables:

```sh
AB_JOLOKIA_AUTH_OPENSHIFT=false
AB_JOLOKIA_PASSWORD_RANDOM=false
AB_JOLOKIA_OPTS=useSslClientAuthentication=false,protocol=https
```

The following script lets you apply the above environment variables to all the deployments with a label `provider=fabric8` in a batch:

```sh
./scripts/disable-jolokia-auth.sh
```
