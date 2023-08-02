const gulp = require('gulp'),
  Hub = require('gulp-hub'),
  del = require('del'),
  fs = require('fs'),
  path = require('path'),
  argv = require('yargs').argv,
  uri = require('urijs'),
  logger = require('js-logger'),
  mime = require('mime-types'),
  stringifyObject = require('stringify-object'),
  hawtio = require('@hawtio/node-backend')

const config = {
  port: argv.port || 2772,
  master: argv.master,
  mode: argv.mode || 'namespace',
  namespace: argv.namespace || 'hawtio',
  form: argv.form || process.env.HAWTIO_AUTH_FORM,
}

function getMaster() {
  const master = config.master || process.env.OPENSHIFT_MASTER
  if (!master) {
    console.error('The --master option or the OPENSHIFT_MASTER environment variable must be set!')
    process.exit(1)
  }
  return master
}

function osconsole(_, res, _) {
  const oscConfig = {
    master_uri: `http://localhost:${config.port}/master`,
    hawtio: {
      mode: config.mode,
    },
  }
  switch (config.mode) {
    case 'namespace':
      oscConfig.hawtio.namespace = config.namespace
      if (!config.form) {
        oscConfig.openshift = {
          oauth_metadata_uri: `http://localhost:${config.port}/master/.well-known/oauth-authorization-server`,
          oauth_client_id: `system:serviceaccount:${config.namespace}:hawtio-online-dev`,
          scope: `user:info user:check-access role:edit:${config.namespace}`,
        }
      }
      break
    case 'cluster':
      if (!config.form) {
        oscConfig.openshift = {
          oauth_metadata_uri: `http://localhost:${config.port}/master/.well-known/oauth-authorization-server`,
          oauth_client_id: `hawtio-online-dev`,
          scope: `user:info user:check-access user:list-projects role:edit:*`,
        }
      }
      break
    default:
      console.error('Invalid value for the Hawtio Online mode, must be one of [cluster, namespace]')
      process.exit(1)
  }
  if (config.form) {
    oscConfig.form = {
      uri: config.form,
    }
  }
  const answer = `window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = ${stringifyObject(oscConfig)}`
  res.set('Content-Type', 'application/javascript')
  res.send(answer)
}

function backend(root, liveReload) {
  // Lets disable unauthorised TLS for self-signed development certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  const master = getMaster()
  console.log('Using OpenShift URL:', master)
  const master_api = uri.parse(master)

  hawtio.setConfig({
    logLevel: logger.INFO,
    port: config.port,
    staticAssets: [
      {
        path: '/online',
        dir: path.join(root, 'online'),
      },
      {
        path: '/integration',
        dir: path.join(root, 'integration'),
      },
    ],
    staticProxies: [
      {
        port: master_api.port,
        proto: master_api.protocol,
        path: '/master',
        hostname: master_api.hostname,
        targetPath: '/',
      },
    ],
    fallback: {
      '^/online.*': path.join(root, 'online/index.html'),
      '^/integration.*': path.join(root, 'integration/index.html'),
    },
    liveReload: {
      enabled: liveReload,
    },
  })

  hawtio.use('/online/osconsole/config.js', osconsole)
  hawtio.use('/integration/osconsole/config.js', osconsole)

  hawtio.use('/management', function (req, res, next) {
    const url = /\/management\/namespaces\/(.+)\/pods\/(http|https):([^/]+)\/(.+)/
    const match = req.originalUrl.match(url)
    const redirectPath = `/master/api/v1/namespaces/${match[1]}/pods/${match[2]}:${match[3]}/proxy/${match[4]}`
    console.log('redirect:', redirectPath)
    if (match) {
      // 307 - post redirect
      res.redirect(307, redirectPath)
    } else {
      next()
    }
  })

  hawtio.use('/', function (req, res, next) {
    if (req.originalUrl === '/') {
      res.redirect('/online')
    } else {
      next()
    }
  })
}

const hub = new Hub([
  './packages/common/gulpfile.js',
  './packages/online/gulpfile.js',
  './packages/integration/gulpfile.js',
])
gulp.registry(hub)

// Helpers
const task = (name, fn) => {
  fn.displayName = name
  return fn
}

const chdir = dir => done => {
  process.chdir(path.join(__dirname, dir))
  done()
}

// Workspace tasks
gulp.task('build', gulp.series('common::build', gulp.parallel('online::build', 'integration::build')))

// TODO: parallel site build
gulp.task(
  'site',
  gulp.series(
    task('clean site dir', () => del('docker/site/')),
    task('Set cwd to online dir', chdir('packages/online')),
    'online::site',
    task('Set cwd to root dir', chdir('.')),
    task('Copy online site', () => gulp.src('packages/online/site/**/*').pipe(gulp.dest('docker/site/online'))),
    task('Set cwd to integration dir', chdir('packages/integration')),
    'integration::site',
    task('Set cwd to root dir', chdir('.')),
    task('Copy integration site', () =>
      gulp.src('packages/integration/site/**/*').pipe(gulp.dest('docker/site/integration')),
    ),
  ),
)

gulp.task('serve-site', () => {
  backend('docker/site', false)
  return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`))
})

// Override the reload tasks
hub._registry[path.join(__dirname, 'packages/common/gulpfile.js')].set(
  'common::reload',
  task('Reload common package dependencies', () =>
    gulp.src(['packages/online', 'packages/integration']).pipe(hawtio.reload()),
  ),
)

hub._registry[path.join(__dirname, 'packages/online/gulpfile.js')].set(
  'online::reload',
  task('Reload online package', () => gulp.src('packages/online').pipe(hawtio.reload())),
)

hub._registry[path.join(__dirname, 'packages/integration/gulpfile.js')].set(
  'integration::reload',
  task('Reload integration package', () => gulp.src('packages/integration').pipe(hawtio.reload())),
)

gulp.task(
  'default',
  gulp.parallel(
    'common::watch',
    'online::watch',
    'integration::watch',
    task('Start Hawtio backend', function () {
      backend('packages', true)

      // Serve images from @hawtio/integration
      hawtio.use('/integration/img', (req, res) => {
        const file = path.join(__dirname, 'packages/integration/node_modules/@hawtio/integration/dist/img', req.url)
        if (fs.existsSync(file)) {
          res.writeHead(200, {
            'Content-Type': mime.contentType(path.extname(file)),
            'Content-Disposition': `attachment; filename=${file}`,
          })
          fs.createReadStream(file).pipe(res)
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end(`File ${file} does not exist in dependencies`)
        }
      })

      return hawtio.listen(server => console.log(`Hawtio console started at http://localhost:${server.address().port}`))
    }),
  ),
)
