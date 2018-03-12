const gulp            = require('gulp'),
      sequence        = require('run-sequence'),
      eventStream     = require('event-stream'),
      gulpLoadPlugins = require('gulp-load-plugins'),
      del             = require('del'),
      fs              = require('fs'),
      path            = require('path'),
      argv            = require('yargs').argv,
      urljoin         = require('url-join'),
      logger          = require('js-logger');

const plugins = gulpLoadPlugins({});

const config = {
  templates : ['src/**/*.html'],
  less      : ['src/**/*.less'],
  dist      : argv.out || './dist/',
  js        : 'hawtio-online.js',
  dts       : 'hawtio-online.d.ts',
  css       : 'hawtio-online.css',
};

const tsProject = plugins.typescript.createProject(path.join(path.dirname(__filename), 'tsconfig.json'));

gulp.task('clean-defs', () => del(config.dist + '*.d.ts'));

gulp.task('tsc', ['clean-defs'], function () {
  const tsResult = tsProject.src()
    .pipe(tsProject())
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
    root          : 'src/',
    standalone    : true,
    module        : 'hawtio-online-templates',
    templateFooter: '}]); hawtioPluginLoader.addModule("hawtio-online-templates");',
  }))
  .pipe(gulp.dest('.')));

gulp.task('concat', ['template'], () =>
  gulp.src(['compiled.js', 'templates.js'])
    .pipe(plugins.concat(config.js))
    .pipe(gulp.dest(config.dist)));

gulp.task('clean', () => del(['templates.js', 'compiled.js', './docker/site/']));

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

gulp.task('copy-images', function () {
  return gulp.src('./img/**/*')
    .pipe(gulp.dest(urljoin(config.dist, 'img')));
});

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
    .pipe(gulp.dest('docker/site/fonts/', { overwrite: false }))
);

gulp.task('site-files', () => gulp.src(['images/**', 'img/**'], { base: '.' })
  .pipe(plugins.chmod(0o644))
  .pipe(plugins.dedupe({ same: false }))
  .pipe(plugins.debug({ title: 'site files' }))
  .pipe(gulp.dest('docker/site')));

gulp.task('site-usemin', () => gulp.src('index.html')
  .pipe(plugins.usemin({
    css: [plugins.minifyCss({ keepBreaks: true }), 'concat'],
    js : [plugins.uglify(), plugins.rev()],
  }))
  .pipe(plugins.debug({ title: 'site usemin' }))
  .pipe(gulp.dest('docker/site')));

gulp.task('site-tweak-urls', ['site-usemin', 'site-config'], () => eventStream.merge(
  gulp.src('docker/site/style.css')
    .pipe(plugins.replace(/url\(\.\.\//g, 'url('))
    // tweak fonts URL coming from PatternFly that does not repackage then in dist
    .pipe(plugins.replace(/url\(\.\.\/components\/font-awesome\//g, 'url('))
    .pipe(plugins.replace(/url\(\.\.\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(node_modules\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(node_modules\/patternfly\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(gulp.dest('docker/site')),
  gulp.src('docker/site/hawtconfig.json')
    .pipe(plugins.replace(/node_modules\/@hawtio\/core\/dist\//g, ''))
    .pipe(gulp.dest('docker/site')))
  .pipe(plugins.debug({ title: 'site tweak urls' })));

gulp.task('site-images', function () {
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
    .pipe(gulp.dest('docker/site/img'));
});

gulp.task('site-config', () => gulp.src('hawtconfig.json')
  .pipe(gulp.dest('docker/site')));

gulp.task('build', callback => sequence(['tsc', 'less', 'template', 'concat', 'copy-images'], 'clean', callback));

gulp.task('site', callback => sequence('clean', ['site-fonts', 'site-files', 'site-usemin', 'site-tweak-urls', 'site-images', 'site-config'], callback));

gulp.task('watch', ['build'], function () {
  gulp.watch(['index.html', urljoin(config.dist, '*')], ['reload']);
  gulp.watch(config.less, ['less']);
  const tsconfig = require('./tsconfig.json');
  gulp.watch([...tsconfig.include, ...(tsconfig.exclude || []).map(e => `!${e}`), ...config.templates],
    ['tsc', 'template', 'concat', 'clean']);
});

gulp.task('default', callback => sequence('connect', callback));

module.exports = gulp;
