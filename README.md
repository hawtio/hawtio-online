# hawtio-online

An Hawtio console that eases the discovery and management of _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed on OpenShift.

## Deployment

You can run the following instructions to deploy the Hawtio Online console on your OpenShift cluster.
You may want to read how to [get started with the CLI](https://docs.openshift.org/latest/cli_reference/get_started_cli.html) for more information about the `oc` client tool.

There exist two OpenShift templates to choose from, depending on the following characteristics:

| Template | Descripton |
| -------- | ---------- |
| [deployment-cluster.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-cluster.yml) | Use an OAuth client that requires the `cluster-admin` role to be created. The Hawtio Online console can discover and connect to _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed across multiple namespaces / projects. |
| [deployment-namespace.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml) | Use a service account as OAuth client, which only requires `admin` role in a project to be created. This restricts the Hawtio Online console access to this single project, and as such acts as a single tenant deployment. |

To deploy the Hawtio Online console, execute the following command:

```sh
$ oc new-app -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml \
  -p OPENSHIFT_MASTER=<URL> \
  -p ROUTE_HOSTNAME=<HOST>
```

Note that the `ROUTE_HOSTNAME` parameter can be omitted when using the `deployment-namespace` template.
In that case, OpenShift automatically generates one for you.

You can obtain more information about the template parameters, by executing the following command:

```sh
$ oc process --parameters -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml
NAME                DESCRIPTION                                                                   GENERATOR           VALUE
ROUTE_HOSTNAME      The externally-reachable host name that routes to the Hawtio Online service
OPENSHIFT_MASTER    The OpenShift master URL used to obtain OAuth access tokens
```

You can obtain the status of your deployment, by running:

```sh
$ oc status
In project hawtio on server https://192.168.64.12:8443

https://hawtio-online-hawtio.192.168.64.12.nip.io (redirects) (svc/hawtio-online)
  dc/hawtio-online deploys istag/hawtio-online:latest 
    deployment #1 deployed 2 minutes ago - 1 pod
```

Open the route URL displayed above from your Web browser to access the Hawtio Online console.

## Development

### Tools

You must have the following tools installed:

* [Node.js](http://nodejs.org)
* [Yarn](https://yarnpkg.com)
* [gulp](http://gulpjs.com/)

### Build

```
$ yarn install
```

### Install

In order to authenticate and obtain OAuth access tokens for the Hawtio console be authorized to watch for _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed in your cluster, you have to create an OAuth client that matches localhost development URLs.

##### Cluster mode

```sh
$ oc create -f oauthclient.yml
```

See [OAuth Clients](https://docs.openshift.com/container-platform/latest/architecture/additional_concepts/authentication.html#oauth-clients) for more information.

##### Namespace mode

```sh
$ oc create -f serviceaccount.yml
```

See [Service Accounts as OAuth Clients](https://docs.openshift.com/container-platform/latest/architecture/additional_concepts/authentication.html#service-accounts-as-oauth-clients) for more information.

### Run

##### Cluster mode

```
$  yarn start --master=`oc whoami --show-server` --mode=cluster
```

##### Namespace mode

```
$  yarn start --master=`oc whoami --show-server` --mode=namespace --namespace=`oc project -q`
```

You can access the console at <http://localhost:2772/>.

---

<a name="f1">1</a>. Containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.
