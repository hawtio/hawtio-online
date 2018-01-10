# hawtio-online

An Hawtio console deployment that eases the discovery of hawtio-enabled applications on OpenShift.

## Deployment

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
