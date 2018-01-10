# hawtio-online

An Hawtio console deployment that eases the discovery of hawtio-enabled applications on OpenShift.

## Deployment

You can run the following instructions to deploy the Hawtio Online console on your OpenShift cluster.
You may want to read how to [Get started with the CLI](https://docs.openshift.org/latest/cli_reference/get_started_cli.html) for more information about the `oc` client tool.

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

### Clone the repository

```
git clone https://github.com/hawtio/hawtio-online
cd hawtio-online
```

### Install development tools

* [Node.js](http://nodejs.org)
* [Yarn](https://yarnpkg.com)
* [gulp](http://gulpjs.com/)

### Install project dependencies

```
yarn install
```

### Run the web application

```
yarn start
```

### Change the default proxy port

To proxy to a local JVM running on a different port than `8282` specify the `--port` CLI arguement to gulp:
```
gulp --port=8181
```
