const gulp            = require('gulp'),
      sequence        = require('run-sequence'),
      eventStream     = require('event-stream'),
      gulpLoadPlugins = require('gulp-load-plugins'),
      del             = require('del'),
      fs              = require('fs'),
      path            = require('path'),
      s               = require('underscore.string'),
      argv            = require('yargs').argv,
      urljoin         = require('url-join'),
      uri             = require('urijs'),
      logger          = require('js-logger'),
      stringifyObject = require('stringify-object'),
      hawtio          = require('@hawtio/node-backend');

const plugins  = gulpLoadPlugins({});

const config = {
  mode      : argv.mode || 'namespace',
  namespace : argv.namespace || 'hawtio',
  main      : '.',
  ts        : ['plugins/**/*.ts'],
  templates : ['plugins/**/*.html'],
  less      : ['plugins/**/*.less'],
  dist      : argv.out || './dist/',
  js        : 'hawtio-online.js',
  dts       : 'hawtio-online.d.ts',
  css       : 'hawtio-online.css',
  tsProject : plugins.typescript.createProject('tsconfig.json'),
};

gulp.task('clean-defs', () => del(config.dist + '*.d.ts'));

gulp.task('tsc', ['clean-defs'], function () {
  const tsResult = gulp.src(config.ts)
    .pipe(config.tsProject())
    .on('error', plugins.notify.onError({
      onLast : true,
      message: '<%= error.message %>',
      title  : 'Typescript compilation error'
    }));

  return eventStream.merge(
    tsResult.js
      .pipe(plugins.ngAnnotate())
      .pipe(gulp.dest('.')),
    tsResult.dts
     .pipe(plugins.rename(config.dts))
     .pipe(gulp.dest(config.dist)));
});

gulp.task('template', ['tsc'], () => gulp.src(config.templates)
  .pipe(plugins.angularTemplatecache({
    filename      : 'templates.js',
    root          : 'plugins/',
    standalone    : true,
    module        : 'hawtio-online-templates',
    templateFooter: '}]); hawtioPluginLoader.addModule("hawtio-online-templates");',
  }))
  .pipe(gulp.dest('.')));

gulp.task('concat', ['template'], () =>
  gulp.src(['compiled.js', 'templates.js'])
    .pipe(plugins.concat(config.js))
    .pipe(gulp.dest(config.dist)));

gulp.task('clean', () => del(['templates.js', 'compiled.js', './site/']));

gulp.task('less', () => gulp.src(config.less)
  .pipe(plugins.less({
    paths: [path.join(__dirname, 'node_modules')]
  }))
  .on('error', plugins.notify.onError({
    onLast : true,
    message: '<%= error.message %>',
    title  : 'less file compilation error'
  }))
  .pipe(plugins.concat(config.css))
  .pipe(gulp.dest(config.dist)));

gulp.task('watch-less', function () {
  plugins.watch(config.less, () => ['less']);
});

gulp.task('watch', ['build', 'watch-less'], function() {
  gulp.watch(
    [
      'node_modules/@hawtio/**/dist/*.js',
      'node_modules/@hawtio/**/dist/*.css',
      'index.html',
      urljoin(config.dist, '*')
    ],
    ['reload']
  );
  gulp.watch([config.ts, config.templates], ['tsc', 'template', 'concat', 'clean']);
});

function osconsole(_, res, _) {
  const master = process.env.OPENSHIFT_MASTER;
  if (!master) {
    console.error('The OPENSHIFT_MASTER environment variable must be set!');
    process.exit(1);
  }
  console.log('Using OpenShift URL:', master);
  let client;
  if (config.mode === 'namespace') {
    client = {
      hawtio : {
        mode      : config.mode,
        namespace : config.namespace,
      },
      openshift : {
        oauth_authorize_uri : urljoin(master, '/oauth/authorize'),
        oauth_client_id     : `system:serviceaccount:${config.namespace}:hawtio-online-dev`,
        scope               : `user:info user:check-access role:edit:${config.namespace}`,
      },
    };
  } else if (config.mode === 'cluster') {
    client = {
      hawtio : {
        mode : config.mode,
      },
      openshift : {
        oauth_authorize_uri : urljoin(master, '/oauth/authorize'),
        oauth_client_id     : 'hawtio-online-dev',
        scope               : 'user:info user:check-access user:list-projects role:edit:*',
      },
    };
  } else {
    console.error('Invalid value for the Hawtio Online mode, must be one of [cluster, namespace]');
    process.exit(1);
  }
  const answer = 'window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = ' + stringifyObject(client);
  res.set('Content-Type', 'application/javascript');
  res.send(answer);
}

gulp.task('connect', ['watch'], function () {
  // Lets disable unauthorised TLS for self-signed development certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const master = process.env.OPENSHIFT_MASTER;
  if (!master) {
    console.error('The OPENSHIFT_MASTER environment variable must be set!');
    process.exit(1);
  }
  console.log('Using OpenShift URL:', master);
  const kube = uri(urljoin(master, 'api'));
  const kubeapis = uri(urljoin(master, 'apis'));
  const oapi = uri(urljoin(master, 'oapi'));

  hawtio.setConfig({
    logLevel : logger.INFO,
    port     : 2772,
    staticAssets : [{
      path : '/',
      dir  : '.',
    }],
    fallback   : 'index.html',
    liveReload : {
      enabled : true,
    }
  });

  hawtio.use('/osconsole/config.js', osconsole);

  hawtio.use('/', function (req, res, next) {
    const path = req.originalUrl;
    // avoid returning these files, they should get pulled from js
    if (s.startsWith(path, '/plugins/') && s.endsWith(path, 'html')) {
      console.log('returning 404 for: ', path);
      res.statusCode = 404;
      res.end();
    } else {
      next();
    }
  });

  hawtio.use('/img', (req, res) => {
    // We may want to serve from other dependencies
    const file = path.join(__dirname, 'node_modules', '@hawtio', 'integration', 'dist', req.originalUrl);
    if (fs.existsSync(file)) {
      res.writeHead(200, {
        'Content-Type'       : 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=' + file
      });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(`File ${file} does not exist in dependencies`);
    }
  });

  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
});

gulp.task('reload', () => gulp.src('.').pipe(hawtio.reload()));

gulp.task('site-fonts', () =>
  gulp
    .src(
      [
        'node_modules/**/*.woff',
        'node_modules/**/*.woff2',
        'node_modules/**/*.ttf',
        'node_modules/**/fonts/*.eot',
        'node_modules/**/fonts/*.svg'
      ],
      { base: '.' }
    )
    .pipe(plugins.flatten())
    .pipe(plugins.chmod(0o644))
    .pipe(plugins.dedupe({ same: false }))
    .pipe(plugins.debug({ title: 'site font files' }))
    .pipe(gulp.dest('site/fonts/', { overwrite: false }))
);

gulp.task('site-files', () => gulp.src(['images/**', 'img/**'], {base: '.'})
  .pipe(plugins.chmod(0o644))
  .pipe(plugins.dedupe({same: false}))
  .pipe(plugins.debug({title: 'site files'}))
  .pipe(gulp.dest('site')));

gulp.task('usemin', () => gulp.src('index.html')
  .pipe(plugins.usemin({
    css: [plugins.minifyCss({keepBreaks: true}), 'concat'],
    js : [plugins.uglify(), plugins.rev()],
    js1: [plugins.uglify(), plugins.rev()]
  }))
  .pipe(plugins.debug({title: 'usemin'}))
  .pipe(gulp.dest('site')));

gulp.task('tweak-urls', ['usemin'], () => gulp.src('site/style.css')
  .pipe(plugins.replace(/url\(\.\.\//g, 'url('))
  // tweak fonts URL coming from PatternFly that does not repackage then in dist
  .pipe(plugins.replace(/url\(\.\.\/components\/font-awesome\//g, 'url('))
  .pipe(plugins.replace(/url\(\.\.\/components\/bootstrap\/dist\//g, 'url('))
  .pipe(plugins.replace(/url\(node_modules\/bootstrap\/dist\//g, 'url('))
  .pipe(plugins.replace(/url\(node_modules\/patternfly\/components\/bootstrap\/dist\//g, 'url('))
  .pipe(plugins.debug({title: 'tweak-urls'}))
  .pipe(gulp.dest('site')));

gulp.task('404', ['usemin'], () => gulp.src('site/index.html')
  .pipe(plugins.rename('404.html'))
  .pipe(gulp.dest('site')));

gulp.task('copy-images', function () {
  const dirs = fs.readdirSync('./node_modules/@hawtio');
  const patterns = [];
  dirs.forEach(function (dir) {
    const path = './node_modules/@hawtio/' + dir + '/dist/img';
    try {
      if (fs.statSync(path).isDirectory()) {
        console.log('found image dir: ', path);
        const pattern = 'node_modules/@hawtio/' + dir + '/dist/img/**';
        patterns.push(pattern);
      }
    } catch (e) {
      // ignore, file does not exist
    }
  });
  // Add PatternFly images package in dist
  patterns.push('node_modules/patternfly/dist/img/**');
  return gulp.src(patterns)
    .pipe(plugins.debug({title: 'img-copy'}))
    .pipe(plugins.chmod(0o644))
    .pipe(gulp.dest('site/img'));
});

gulp.task('serve-site', function () {
  hawtio.setConfig({
    port: 2772,
    staticAssets: [{
      path : '/',
      dir  : 'site',
    }],
    fallback   : 'site/404.html',
    liveReload : {
      enabled : false,
    },
  });

  hawtio.use('/osconsole/config.js', osconsole);

  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`));
});

gulp.task('build', callback => sequence(['tsc', 'less', 'template', 'concat'], 'clean', callback));

gulp.task('site', callback => sequence('clean', ['site-fonts', 'site-files', 'usemin', 'tweak-urls', '404', 'copy-images'], callback));

gulp.task('default', callback => sequence('connect', callback));
