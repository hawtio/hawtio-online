#!/bin/sh

set -e

# The CA certificate
oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.crt']}" | base64 --decode > ca.crt

# The CA private key
oc get secrets/signing-key -n openshift-service-ca -o "jsonpath={.data['tls\.key']}" | base64 --decode > ca.key

# Generate the private key
openssl genrsa -out server.key 2048

# Write the CSR config file
cat <<EOT > csr.conf
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
openssl req -new -key server.key -out server.csr -config csr.conf

# Issue the signed certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 10000 -extensions v3_ext -extfile csr.conf

# Create the secret for Hawtio Online
oc create secret tls hawtio-online-tls-proxying --cert server.crt --key server.key
