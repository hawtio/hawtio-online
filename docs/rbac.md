# RBAC

Hawtio installation comes with a default `hawtio-rbac` _ConfigMap_ [configmap-hawtio-rbac.yml](../deploy/base/configmap-hawtio-rbac.yml), that contains the configuration file used to define the roles allowed for MBean operations.
This _ConfigMap_ is mounted into the Hawtio Online container, and the `HAWTIO_ONLINE_RBAC_ACL` environment variable is used to pass the configuration file path to the server.
If that environment variable is not set, RBAC support is disabled, and only users granted the `update` verb on the pod resources are authorized to call MBeans operations.

## Roles

For the time being, only the `viewer` and `admin` roles are supported.
Once the current invocation is authenticated, these roles are inferred from the permissions the user impersonating the request is granted for the pod hosting the operation being invoked.

A user that's granted the `update` verb on the pod resource is bound to the `admin` role, i.e.:

```sh
$ oc auth can-i update pods/<pod> --as <user>
yes
```

Else, a user granted the `get` verb on the pod resource is bound the `viewer` role, i.e.:

```sh
$ oc auth can-i get pods/<pod> --as <user>
yes
```

Otherwise the user is not bound any roles, i.e.:

```sh
$ oc auth can-i get pods/<pod> --as <user>
no
```

## ACL

The ACL definition for JMX operations works as follows:

Based on the _ObjectName_ of the JMX MBean, a key composed with the _ObjectName_ domain, optionally followed by the `type` attribute, can be declared, using the convention `<domain>.<type>`.
For example, the `java.lang.Threading` key for the MBean with the _ObjectName_ `java.lang:type=Threading` can be declared.
A more generic key with the domain only can be declared (e.g. `java.lang`).
A `default` top-level key can also be declared.
A key can either be an unordered or ordered map, whose keys can either be string or regexp, and whose values can either be string or array of strings, that represent roles that are allowed to invoke the MBean member.

The default ACL definition can be found in the `hawtio-rbac` _ConfigMap_ from the `deployment-cluster-rbac.yml` and `deployment-namespace-rbac.yml` templates.

## Authorization

The system looks for allowed roles using the following process:

The most specific key is tried first. E.g. for the above example, the `java.lang.Threading` key is looked up first.
If the most specific key does not exist, the domain-only key is looked up, otherwise, the `default` key is looked up.
Using the matching key, the system looks up its map value for:

1. An exact match for the operation invocation, using the operation signature, and the invocation arguments, e.g.:

   `uninstall(java.lang.String)[0]: [] # no roles can perform this operation`

2. A regexp match for the operation invocation, using the operation signature, and the invocation arguments, e.g.:

   `/update\(java\.lang\.String,java\.lang\.String\)\[[1-4]?[0-9],.*\]/: admin`

   Note that, if the value is an ordered map, the iteration order is guaranteed, and the first matching regexp key is selected;

3. An exact match for the operation invocation, using the operation signature, without the invocation arguments, e.g.:

   `delete(java.lang.String): admin`

4. An exact match for the operation invocation, using the operation name, e.g.:

   `dumpStatsAsXml: admin, viewer`

If the key matches the operation invocation, it is used and the process will not look for any other keys. So the most specific key always takes precedence.
Its value is used to match the role that impersonates the request, against the roles that are allowed to invoke the operation.
If the current key does not match, the less specific key is looked up and matched following the steps 1 to 4 above, up until the `default` key.
Otherwise, the operation invocation is denied.
