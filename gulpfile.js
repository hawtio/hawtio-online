const gulp            = require('gulp'),
      sequence        = require('run-sequence'),
      wiredep         = require('wiredep').stream,
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
      hawtio          = require('hawtio-node-backend');

const plugins  = gulpLoadPlugins({});
const pkg      = require('./package.json');
const bower    = require('./bower.json');
bower.packages = {};

const config = {
  proxyPort     : argv.port || 8282,
  main          : '.',
  ts            : ['plugins/**/*.ts'],
  templates     : ['plugins/**/*.html'],
  less          : ['plugins/**/*.less'],
  templateModule: pkg.name + '-templates',
  dist          : argv.out || './dist/',
  js            : pkg.name + '.js',
  css           : pkg.name + '.css',
  tsProject     : plugins.typescript.createProject({
    target          : 'ES5',
    module          : 'commonjs',
    declarationFiles: true,
    noResolve       : false
  })
};

gulp.task('bower', function () {
  return gulp.src('index.html')
    .pipe(wiredep({}))
    .pipe(gulp.dest('.'));
});

/** Adjust the reference path of any typescript-built plugin this project depends on */
gulp.task('path-adjust', function () {
  return gulp.src('libs/**/includes.d.ts')
    .pipe(plugins.replace(/"\.\.\/libs/gm, '"../../../libs'))
    .pipe(gulp.dest('libs'));
});

gulp.task('clean-defs', function () {
  return del('defs.d.ts');
});

gulp.task('tsc', ['clean-defs'], function () {
  const cwd      = process.cwd();
  const tsResult = gulp.src(config.ts)
    .pipe(plugins.typescript(config.tsProject))
    .on('error', plugins.notify.onError({
      onLast : true,
      message: '<%= error.message %>',
      title  : 'Typescript compilation error'
    }));

  return eventStream.merge(
    tsResult.js
      .pipe(plugins.concat('compiled.js'))
      .pipe(gulp.dest('.')),
    tsResult.dts
      .pipe(gulp.dest('d.ts')))
    .pipe(plugins.filter('**/*.d.ts'))
    .pipe(plugins.concatFilenames('defs.d.ts', {
      root   : cwd,
      prepend: '/// <reference path="',
      append : '"/>'
    }))
    .pipe(gulp.dest('.'));
});

gulp.task('template', ['tsc'], function () {
  return gulp.src(config.templates)
    .pipe(plugins.angularTemplatecache({
      filename      : 'templates.js',
      root          : 'plugins/',
      standalone    : true,
      module        : config.templateModule,
      templateFooter: '}]); hawtioPluginLoader.addModule("' + config.templateModule + '");'
    }))
    .pipe(gulp.dest('.'));
});

gulp.task('concat', ['template'], function () {
  return gulp.src(['compiled.js', 'templates.js'])
    .pipe(plugins.concat(config.js))
    .pipe(gulp.dest(config.dist));
});

gulp.task('clean', function () {
  return del(['templates.js', 'compiled.js', './site/']);
});

gulp.task('less', function () {
  return gulp.src(config.less)
    .pipe(plugins.less({
      paths: [path.join(__dirname, 'libs')]
    }))
    .on('error', plugins.notify.onError({
      onLast : true,
      message: '<%= error.message %>',
      title  : 'less file compilation error'
    }))
    .pipe(plugins.concat(config.css))
    .pipe(gulp.dest(config.dist));
});

gulp.task('watch-less', function () {
  plugins.watch(config.less, function () {
    gulp.start('less');
  });
});

gulp.task('watch', ['build', 'watch-less'], function () {
  plugins.watch(['libs/**/*.js', 'libs/**/*.css', 'index.html', urljoin(config.dist, '*')], function () {
    gulp.start('reload');
  });
  plugins.watch(['libs/**/*.d.ts', config.ts, config.templates], function () {
    gulp.start(['tsc', 'template', 'concat', 'clean']);
  });
});

gulp.task('connect', ['watch'], function () {
  // lets disable unauthorised TLS issues with kube REST API
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const kubeBase = process.env.KUBERNETES_MASTER || 'https://open.paas.redhat.com/';
  console.log("==== using KUBERNETES URL: " + kubeBase);
  const kube     = uri(urljoin(kubeBase, 'api'));
  const kubeapis = uri(urljoin(kubeBase, 'apis'));
  const oapi     = uri(urljoin(kubeBase, 'oapi'));
  console.log("Connecting to Kubernetes on: " + kube);

  hawtio.setConfig({
    logLevel     : logger.INFO,
    port         : 2772,
    staticProxies: [{
      port      : 8181,
      path      : '/jolokia',
      targetPath: '/jolokia'
    }],
    staticAssets : [{
      path: '/',
      dir : '.'

    }],
    fallback     : 'index.html',
    liveReload   : {
      enabled: true
    }
  });

  const debugLoggingOfProxy = process.env.DEBUG_PROXY === "true";
  const useAuthentication   = process.env.DISABLE_OAUTH !== "true";

  const googleClientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  hawtio.use('/osconsole/config.js', function (req, res, next) {
    const config = {
      api: {
        openshift: {
          proto   : oapi.protocol(),
          hostPort: oapi.host(),
          prefix  : oapi.path()
        },
        k8s      : {
          proto   : kube.protocol(),
          hostPort: kube.host(),
          prefix  : kube.path()
        }
      }
    };
    if (googleClientId && googleClientSecret) {
      config.master_uri = kubeBase;
      config.google     = {
        clientId         : googleClientId,
        clientSecret     : googleClientSecret,
        authenticationURI: "https://accounts.google.com/o/oauth2/auth",
        authorizationURI : "https://accounts.google.com/o/oauth2/auth",
        scope            : "profile",
        redirectURI      : "http://localhost:9000"
      };

    } else if (useAuthentication) {
      config.master_uri = kubeBase;
      config.openshift  = {
        oauth_authorize_uri: urljoin(kubeBase, '/oauth/authorize'),
        oauth_client_id    : 'system:serviceaccount:hawtio:hawtio-oauth-client',
        scope              : 'user:info user:check-access role:edit:hawtio'
      };
    }
    const answer = "window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = " + stringifyObject(config);
    res.set('Content-Type', 'application/javascript');
    res.send(answer);
  });

  hawtio.use('/', function (req, res, next) {
    const path = req.originalUrl;
    // avoid returning these files, they should get pulled from js
    if (s.startsWith(path, '/plugins/') && s.endsWith(path, 'html')) {
      console.log("returning 404 for: ", path);
      res.statusCode = 404;
      res.end();
    } else {
      //console.log("allowing: ", path);
      next();
    }
  });

  hawtio.use('/img', (req, res) => {
    // We may want to serve from other dependencies
    const file = path.join(__dirname, 'libs', 'hawtio-integration', req.originalUrl);
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

  hawtio.listen(function (server) {
    const host = server.address().address;
    const port = server.address().port;
    console.log("started from gulp file at ", host, ":", port);
  });
});

gulp.task('reload', function () {
  gulp.src('.')
    .pipe(hawtio.reload());
});

gulp.task('site-fonts', function () {
  return gulp.src(['libs/**/*.woff', 'libs/**/*.woff2', 'libs/**/*.ttf', 'libs/**/fonts/*.eot', 'libs/**/fonts/*.svg'], {base: '.'})
    .pipe(plugins.flatten())
    .pipe(plugins.chmod(0o644))
    .pipe(plugins.dedupe({same: false}))
    .pipe(plugins.debug({title: 'site font files'}))
    .pipe(gulp.dest('site/fonts/', {overwrite: false}));
});

gulp.task('root-files', function () {
  return gulp.src(['favicon.ico'], {base: '.'})
    .pipe(plugins.flatten())
    .pipe(plugins.debug({title: 'root files'}))
    .pipe(plugins.chmod(0o644))
    .pipe(gulp.dest('site'));
});

gulp.task('site-files', function () {
  return gulp.src(['images/**', 'img/**', 'osconsole/config.js'], {base: '.'})
    .pipe(plugins.chmod(0o644))
    .pipe(plugins.dedupe({same: false}))
    .pipe(plugins.debug({title: 'site files'}))
    .pipe(gulp.dest('site'));
});

gulp.task('usemin', function () {
  return gulp.src('index.html')
    .pipe(plugins.usemin({
      css: [plugins.minifyCss({
        keepBreaks: true
      }), 'concat'],
      js : [
        plugins.uglify(),
        plugins.rev()
      ],
      js1: [
        plugins.uglify(),
        plugins.rev()
      ]
    }))
    .pipe(plugins.debug({title: 'usemin'}))
    .pipe(gulp.dest('site'));
});

gulp.task('tweak-urls', ['usemin'], function () {
  return gulp.src('site/style.css')
    .pipe(plugins.replace(/url\(\.\.\//g, 'url('))
    // tweak fonts URL coming from PatternFly that does not repackage then in dist
    .pipe(plugins.replace(/url\(\.\.\/components\/font-awesome\//g, 'url('))
    .pipe(plugins.replace(/url\(\.\.\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(libs\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(libs\/patternfly\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.debug({title: 'tweak-urls'}))
    .pipe(gulp.dest('site'));
});

gulp.task('404', ['usemin'], function () {
  return gulp.src('site/index.html')
    .pipe(plugins.rename('404.html'))
    .pipe(gulp.dest('site'));
});

gulp.task('copy-images', function () {
  const dirs     = fs.readdirSync('./libs');
  const patterns = [];
  dirs.forEach(function (dir) {
    const path = './libs/' + dir + "/img";
    try {
      if (fs.statSync(path).isDirectory()) {
        console.log("found image dir: " + path);
        const pattern = 'libs/' + dir + "/img/**";
        patterns.push(pattern);
      }
    } catch (e) {
      // ignore, file does not exist
    }
  });
  // Add PatternFly images package in dist
  patterns.push('libs/patternfly/dist/img/**');
  return gulp.src(patterns)
    .pipe(plugins.debug({title: 'img-copy'}))
    .pipe(plugins.chmod(0o644))
    .pipe(gulp.dest('site/img'));
});

gulp.task('collect-dep-versions', function () {
  return gulp.src('./libs/**/.bower.json')
    .pipe(plugins.foreach(function (stream, file) {
      const pkg                = JSON.parse(file.contents.toString('utf8'));
      bower.packages[pkg.name] = {
        version: pkg.version
      };
      return stream;
    }));
});

gulp.task('get-commit-id', function (cb) {
  plugins.git.exec({args: 'rev-parse HEAD'}, function (err, stdout) {
    bower.commitId = stdout.trim();
    cb();
  });
});

gulp.task('write-version-json', ['collect-dep-versions', 'get-commit-id'], function (cb) {
  fs.writeFile('site/version.json', getVersionString(), cb);
});

function getVersionString() {
  return JSON.stringify({
    name    : bower.name,
    version : bower.version,
    commitId: bower.commitId,
    packages: bower.packages
  }, undefined, 2);
}

gulp.task('serve-site', function () {
  const staticAssets = configStaticAssets('site');
  hawtio.setConfig({
    port         : 2772,
    staticProxies: [
      {
        port      : 8080,
        path      : '/jolokia',
        targetPath: '/hawtio/jolokia'
      }
    ],
    staticAssets : staticAssets,
    fallback     : 'site/404.html',
    liveReload   : {
      enabled: false
    }
  });
  return hawtio.listen(function (server) {
    const host = server.address().address;
    const port = server.address().port;
    console.log("started from gulp file at ", host, ":", port);
  });
});

function configStaticAssets(prefix) {
  const staticAssets = [{
    path: '/',
    dir : prefix
  }];
  const targetDir    = urljoin(prefix, 'libs');
  try {
    if (fs.statSync(targetDir).isDirectory()) {
      const dirs = fs.readdirSync(targetDir);
      dirs.forEach(function (dir) {
        dir = urljoin(prefix, 'libs', dir);
        console.log("dir: ", dir);
        if (fs.statSync(dir).isDirectory()) {
          console.log("Adding directory to search path: ", dir);
          staticAssets.push({
            path: '/',
            dir : dir
          });
        }
      });
    }
  } catch (err) {
    console.log("Nothing in libs to worry about");
  }
  return staticAssets;
}

gulp.task('build', callback => sequence(['bower', 'path-adjust', 'tsc', 'less', 'template', 'concat'], 'clean', callback));

gulp.task('site', callback => sequence('clean', ['site-fonts', 'root-files', 'site-files', 'usemin', 'tweak-urls', '404', 'copy-images', 'write-version-json'], callback));

gulp.task('default', ['connect']);
