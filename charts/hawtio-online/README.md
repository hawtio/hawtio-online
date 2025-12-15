# Hawtio Online

[![Test](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml/badge.svg)](https://github.com/hawtio/hawtio-online/actions/workflows/test.yml)

An Hawtio console that eases the discovery and management of [_hawtio-enabled_ applications](#hawtio-enabled-application-examples) deployed on OpenShift and Kubernetes.

## Hawtio-enabled application examples

A _hawtio-enabled_ application is an application that is composed of containers with a configured port named `jolokia` and that exposes the [Jolokia](https://jolokia.org) API.

Look at the separate examples project for understanding how you can set up a _hawtio-enabled_ application for Hawtio Online:

- [Hawtio-Enabled Application Examples for Hawtio Online](https://github.com/hawtio/hawtio-online-examples)

Installation requires the following:

* specifying the type of cluster targeted for the installation (either OpenShift or Kubernetes), thereby ensuring the correct certificates are generated for secure (SSL) access;
* the namespace targeted for the installation
* the 'mode' of the installation, ie. whether hawtio-online should be able to discover jolokia application cluster-wide (cluster) or only in the installed namespace (namespace);

### Verification of Install

The Hawtio-Online deployment, pod and service should be installed into the cluster:
```
$ oc get deploy
NAME                                   READY   UP-TO-DATE   AVAILABLE   AGE
hawtio-online                          1/1     1            1           26m

$ oc get pods
NAME                                   READY   STATUS      RESTARTS        AGE
hawtio-online-65dcfdd49c-jfzvj         2/2     Running     0              26m

$ oc get services
NAME                                   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)         AGE
hawtio-online                          NodePort    10.217.4.162   <none>        443:31914/TCP   27m
```

Please see further documentation on the [website](https://hawt.io) and the [project](https://github.com/hawtio/hawtio-online)
