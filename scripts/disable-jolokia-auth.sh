#!/bin/sh

# target dc labeled 'provider=fabric8'
names=$(oc get dc --selector='provider=fabric8' -o 'jsonpath={.items[*].metadata.name}')

echo $names | tr " " "\n"
read -p "Disable Jolokia authentication & SSL for these deployment configs? [y/N]: " yn
if [ "$yn" != "y" ]; then
  exit 0
fi

for name in $names; do
  echo "Disabling: $name"

  echo "  oc set env dc/$name AB_JOLOKIA_AUTH_OPENSHIFT=false"
  oc set env dc/$name AB_JOLOKIA_AUTH_OPENSHIFT=false

  echo "  oc set env dc/$name AB_JOLOKIA_PASSWORD_RANDOM=false"
  oc set env dc/$name AB_JOLOKIA_PASSWORD_RANDOM=false

  echo "  oc set env dc/$name AB_JOLOKIA_OPTS=useSslClientAuthentication=false,protocol=https"
  oc set env dc/$name AB_JOLOKIA_OPTS=useSslClientAuthentication=false,protocol=https
done
