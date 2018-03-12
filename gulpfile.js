const online = require('./packages/online/gulpfile');

const gulp     = require('gulp'),
      sequence = require('run-sequence'),
      fs       = require('fs'),
      path     = require('path'),
      argv     = require('yargs').argv,
      urljoin  = require('url-join'),
      uri      = require('urijs'),
      logger   = require('js-logger'),
      hawtio   = require('@hawtio/node-backend');

const config = {
  master    : argv.master,
  mode      : argv.mode || 'namespace',
  namespace : argv.namespace || 'hawtio',
};

function getMaster() {
  const master = config.master || process.env.OPENSHIFT_MASTER;
  if (!master) {
    console.error('The --master option or the OPENSHIFT_MASTER environment variable must be set!');
    process.exit(1);
  }
  return master;
}

function osconsole(_, res, _) {
  const master = getMaster();
  let answer;
  if (config.mode === 'namespace') {
    answer =
    `window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {
      master_uri : new URI().query('').path('/master').toString(),
      hawtio : {
        mode      : '${config.mode}',
        namespace : '${config.namespace}',
      },
      openshift : {
        master_uri          : '${master}',
        oauth_authorize_uri : new URI('${master}').path('/oauth/authorize').toString(),
        oauth_client_id     : 'system:serviceaccount:${config.namespace}:hawtio-online-dev',
        scope               : 'user:info user:check-access role:edit:${config.namespace}',
      },
    }`;
  } else if (config.mode === 'cluster') {
    answer =
    `window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {
      master_uri : new URI().query('').path('/master').toString(),
      hawtio : {
        mode : '${config.mode}',
      },
      openshift : {
        master_uri          : '${master}',
        oauth_authorize_uri : new URI('${master}').path('/oauth/authorize').toString(),
        oauth_client_id     : 'hawtio-online-dev',
        scope               : 'user:info user:check-access user:list-projects role:edit:*',
      },
    }`;
  } else {
    console.error('Invalid value for the Hawtio Online mode, must be one of [cluster, namespace]');
    process.exit(1);
  }
  res.set('Content-Type', 'application/javascript');
  res.send(answer);
}

function backend(root, liveReload) {
  // Lets disable unauthorised TLS for self-signed development certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const master = getMaster();
  console.log('Using OpenShift URL:', master);
  const master_api = uri.parse(master);

  hawtio.setConfig({
    logLevel : logger.INFO,
    port     : 2772,
    staticAssets : [{
      path : '/online',
      dir  : root,
    }],
    staticProxies: [
      {
        port       : 8080,
        path       : '/integration',
        targetPath : '/integration',
      },
      {
        port       : master_api.port,
        proto      : master_api.protocol,
        path       : '/master',
        hostname   : master_api.hostname,
        targetPath : '/',
      }
    ],
    fallback   : urljoin(root, 'index.html'),
    liveReload : {
      enabled : liveReload,
    }
  });

  hawtio.use('/online/osconsole/config.js', osconsole);

  hawtio.use('/', function (req, res, next) {
    const path = req.originalUrl;
    if (path === '/') {
      res.redirect('/online');
    } else {
      next();
    }
  });
}

gulp.tasks['online.build'] = online.tasks['build'];

gulp.task('online.chdir', callback => {
  process.chdir('packages/online');
  callback();
});

gulp.task('build', callback => sequence(['online.chdir', 'online.build'], callback));

gulp.task('serve-site', function () {
  backend('docker/site/', false);
  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
});

gulp.task('connect', ['watch'], function () {
  backend('./packages/online', true);
  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
});

gulp.task('reload', () => gulp.src('.').pipe(hawtio.reload()));
