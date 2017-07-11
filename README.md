# hawtio-online

This plugin provides deployment and discovery of hawtio apps on OpenShift.

## Installation

```
yarn add @hawtio/online
```

## Set up development environment

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
yarn install:dev
```

### Run the web application

```
gulp
```

### Change the default proxy port

To proxy to a local JVM running on a different port than `8282` specify the `--port` CLI arguement to gulp:
```
gulp --port=8181
```
