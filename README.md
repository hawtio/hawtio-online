# hawtio-online

An Hawtio console deployment that eases the discovery of _hawtio-enabled_ <sup>[1](#f1)</sup> applications on OpenShift.

## Deployment

You can run the following instructions to deploy the Hawtio Online console on your OpenShift cluster.
You may want to read how to [get started with the CLI](https://docs.openshift.org/latest/cli_reference/get_started_cli.html) for more information about the `oc` client tool.

To deploy the Hawtio Online console, execute the following command:

```sh
$ oc new-app -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment.yml \
  -p OPENSHIFT_MASTER=<URL> \
  -p ROUTE_HOSTNAME=<HOST>
```

Note that the `ROUTE_HOSTNAME` parameter can be omitted. In that case, OpenShift automatically generates one for you.

You can obtain more information about the template parameters, by executing the following command:

```sh
$ oc process --parameters -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment.yml
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

### Install

In order to authenticate and obtain OAuth access tokens for the Hawtio console be authorized to watch for _hawtio-enabled_ <sup>[1](#myfootnote1)</sup> applications deployed in your cluster, you have to create an OAuth client by executing the following command:

```sh
$ oc new-project hawtio
$ oc create -f service-account.yml
```

See [Service Accounts as OAuth Clients](https://docs.openshift.com/container-platform/latest/architecture/additional_concepts/authentication.html#service-accounts-as-oauth-clients) for more information.

### Build

```
$ yarn install
```

### Run

```
$ yarn start
```

You can access the console at <http://localhost:2772/>.

<a name="f1">1</a> Containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.
