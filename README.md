# Hawtio Online

An Hawtio console that eases the discovery and management of _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed on OpenShift.

<p align="center">
  <img align="center" src="docs/overview.gif">
</p>

## Deployment

You can run the following instructions to deploy the Hawtio Online console on your OpenShift cluster.
You may want to read how to [get started with the CLI](https://docs.openshift.org/latest/cli_reference/get_started_cli.html) for more information about the `oc` client tool.

There exist different OpenShift templates to choose from, depending on the following characteristics:

| Template | Descripton |
| -------- | ---------- |
| [deployment-cluster.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-cluster.yml) | Use an OAuth client that requires the `cluster-admin` role to be created. The Hawtio Online console can discover and connect to _hawtio-enabled_ <sup>[1](#f1)</sup> applications deployed across multiple namespaces / projects. |
| [deployment-cluster-os4.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-cluster-os4.yml) | Same as `deployment-cluster.yml`, to be used for OpenShift 4. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See [OpenShift 4](#openshift-4) section for more information. |
| [deployment-namespace.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml) | Use a service account as OAuth client, which only requires `admin` role in a project to be created. This restricts the Hawtio Online console access to this single project, and as such acts as a single tenant deployment. |
| [deployment-namespace-os4.yml](https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace-os4.yml) | Same as `deployment-namespace.yml`, to be used for OpenShift 4. By default, this requires the generation of a client certificate, signed with the [service signing certificate][service-signing-certificate] authority, prior to the deployment. See [OpenShift 4](#openshift-4) section for more information. |

[service-signing-certificate]: https://docs.openshift.com/container-platform/4.1/authentication/certificates/service-serving-certificate.html

To deploy the Hawtio Online console, execute the following command:

```sh
$ oc new-app -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml \
  -p ROUTE_HOSTNAME=<HOST>
```

Note that the `ROUTE_HOSTNAME` parameter can be omitted when using the `deployment-namespace` template.
In that case, OpenShift automatically generates one for you.

You can obtain more information about the template parameters, by executing the following command:

```sh
$ oc process --parameters -f https://raw.githubusercontent.com/hawtio/hawtio-online/master/deployment-namespace.yml
NAME                DESCRIPTION                                                                   GENERATOR           VALUE
ROUTE_HOSTNAME      The externally-reachable host name that routes to the Hawtio Online service
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

## OpenShift 4

To secure the communication between Hawtio Online and the Jolokia agents, a client certificate must be generated and mounted into the Hawtio Online pod with a secret, to be used for TLS client authentication. This client certificate must be signed using the [service signing certificate][service-signing-certificate] authority private key.

Here are the steps to be performed prior to the deployment:

1. First, retrieve the service signing certificate authority keys, by executing the following commmands as a _cluster-admin_ user:
    ```sh
    # The CA certificate
    $ oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ca.crt
    # The CA private key
    $ oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.key']}" | base64 --decode > ca.key
    ```

2. Then, generate the client certificate, as documented in [Kubernetes certificates administration](https://kubernetes.io/docs/concepts/cluster-administration/certificates/), using either `easyrsa`, `openssl`, or `cfssl`, e.g., using `openssl`:
    ```sh
    # Generate the private key
    $ openssl genrsa -out server.key 2048
    # Write the CSR config file
    $ cat <<EOT >> csr.conf
      [ req ]
      default_bits = 2048
      prompt = no
      default_md = sha256
      distinguished_name = dn

      [ dn ]
      CN = hawtio-online.hawtio.svc

      [ v3_ext ]
      authorityKeyIdentifier=keyid,issuer:always
      keyUsage=keyEncipherment,dataEncipherment,digitalSignature
      extendedKeyUsage=serverAuth,clientAuth
    EOT
    # Generate the CSR
    $ openssl req -new -key server.key -out server.csr -config csr.conf
    # Issue the signed certificate
    $ openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 10000 -extensions v3_ext -extfile csr.conf
    ```

3. Finally, you can create the secret to be mounted in Hawtio Online, from the generated certificate:
   ```sh
   $ oc create secret tls hawtio-online-tls-proxying --cert server.crt --key server.key
   ```

Note that `CN=hawtio-online.hawtio.svc` must be trusted by the Jolokia agents, for which client certification authentication is enabled. See the `clientPrincipal` parameter from the [Jolokia agent configuration options](https://jolokia.org/reference/html/agents.html#agent-jvm-config).

You can then proceed with the [deployment](#deployment).

## Development

### Tools

You must have the following tools installed:

* [Node.js](http://nodejs.org)
* [Yarn](https://yarnpkg.com) (version `1.5.1` or higher)
* [gulp](http://gulpjs.com/) (version `4.x`)

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

See [Service Accounts as OAuth Clients](https://docs.openshift.com/container-platform/latest/authentication/using-service-accounts-as-oauth-client.html) for more information.

### Run

##### Cluster mode

```
$ yarn start --master=`oc whoami --show-server` --mode=cluster
```

##### Namespace mode

```
$ yarn start --master=`oc whoami --show-server` --mode=namespace --namespace=`oc project -q`
```

You can access the console at <http://localhost:2772/>.

---

<a name="f1">1</a>. Containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.
