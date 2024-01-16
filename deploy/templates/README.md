# Hawtio-Online Templates

## Custom Hawtio custom-hawtio-online-rbac.yml

A template for adding a ConfigMap for custom RBAC rules. To apply, users should execute the following command, setting the *APP_NAME* to an appropriate value for their configuration:
```
kubectl process -f custom-hawtio-online-rbac.yml -p APP_NAME=custom-hawtio | kubectl create -f -
```

Once applied, the ConfigMap can be edited using the command:
```
kubectl edit configmap <APP_NAME>-rbac  # change the APP_NAME to match the previous command
```

### Using the ConfigMap

1. If using the [operator](https://github/hawtio/hawtio-operator), specify the ConfigMap name in the Hawtio CR:
```yaml
apiVersion: v1
items:
- apiVersion: hawt.io/v1
  kind: Hawtio
  metadata:
    name: hawtio-online
    namespace: hawtio-dev
  spec:
    rbac:
      configMap: custom-hawtio-rbac
...
```
1. If installing via the command line, using the `deploy` directory, edit the [base/deployment.yml](https://github.com/hawtio/hawtio-online/blob/main/deploy/base/deployment.yml) file and change the following:
```yaml
...
volumes:
  - name: hawtio-rbac
    configMap:
      name: <APP_NAME>-rbac
...
```
