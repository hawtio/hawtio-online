const gulp    = require('gulp'),
      Hub     = require('gulp-hub'),
      del     = require('del'),
      fs      = require('fs'),
      path    = require('path'),
      argv    = require('yargs').argv,
      urljoin = require('url-join'),
      uri     = require('urijs'),
      logger  = require('js-logger'),
      hawtio  = require('@hawtio/node-backend');

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
    staticAssets : [
      {
        path : '/online',
        dir  : path.join(root, 'online'),
      },
      {
        path : '/integration',
        dir  : path.join(root, 'integration'),
      }
    ],
    staticProxies: [
      {
        port       : master_api.port,
        proto      : master_api.protocol,
        path       : '/master',
        hostname   : master_api.hostname,
        targetPath : '/',
      }
    ],
    fallback   : {
      '^/online.*'      : 'packages/online/index.html',
      '^/integration.*' : 'packages/integration/index.html',
    },
    liveReload : {
      enabled : liveReload,
    }
  });

  hawtio.use('/online/osconsole/config.js', osconsole);
}

const hub = new Hub(['./packages/online/gulpfile.js', './packages/integration/gulpfile.js']);
gulp.registry(hub);

// Workspace tasks
gulp.task('online.chdir', done => {
  process.chdir(path.join(__dirname, 'packages/online'));
  done();
});

gulp.task('integration.chdir', done => {
  process.chdir(path.join(__dirname, 'packages/integration'));
  done();
});

gulp.task('chdir', done => {
  process.chdir(__dirname);
  done();
});

gulp.task('build', gulp.parallel('online::build', 'integration::build'));

gulp.task('copy-online-site', () => gulp.src('packages/online/site/**/*')
  .pipe(gulp.dest('docker/site/online'))
);

gulp.task('copy-integration-site', () => gulp.src('packages/integration/site/**/*')
  .pipe(gulp.dest('docker/site/integration'))
);

gulp.task('site-clean', () => del('docker/site/'));

// TODO: parallel site build
gulp.task('site', gulp.series(
  'site-clean',
  'online.chdir', 'online::site', 'chdir', 'copy-online-site',
  'integration.chdir', 'integration::site', 'chdir', 'copy-integration-site'
));

gulp.task('serve-site', () => {
  backend('docker/site', false);
  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
});

gulp.task('watch', gulp.series('online::watch'));

// Override the reload tasks
hub._registry[path.join(__dirname, 'packages/online/gulpfile.js')]
  .set('online::reload', () => gulp.src('packages/online').pipe(hawtio.reload()));

gulp.task('connect', gulp.parallel('watch', function () {
  backend('packages', true);

  // Serve images from @hawtio/integration
  hawtio.use('/integration/img', (req, res) => {
    const file = path.join(__dirname, 'packages/integration/node_modules/@hawtio/integration/dist/img', req.url);
    if (fs.existsSync(file)) {
      res.writeHead(200, {
        'Content-Type'       : 'application/octet-stream',
        'Content-Disposition': `attachment; filename=${file}`,
      });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`File ${file} does not exist in dependencies`);
    }
  });

  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
}));

gulp.task('default', gulp.series('connect'));