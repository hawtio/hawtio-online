# Generating Certificates Manually

You can generate _proxying_ and _serving_ certificates manually.

## Proxing

For OpenShift, here are the steps to be performed:

1. First, retrieve the service signing certificate authority keys, by executing the following commmands as a _cluster-admin_ user:
    ```sh
    # The CA certificate
    $ oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ca.crt
    # The CA private key
    $ oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.key']}" | base64 --decode > ca.key
    ```

2. Then, generate the client certificate, as documented in [Kubernetes certificates administration](https://kubernetes.io/docs/tasks/administer-cluster/certificates/), using either `easyrsa`, `openssl`, or `cfssl`, e.g., using `openssl`:
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

## Serving

For Kubernetes: TBD
