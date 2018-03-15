const gulp            = require('gulp'),
      gulpLoadPlugins = require('gulp-load-plugins'),
      del             = require('del'),
      fs              = require('fs'),
      merge           = require('merge2'),
      path            = require('path'),
      argv            = require('yargs').argv,
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

const tsProject = plugins.typescript.createProject(path.join(__dirname, 'tsconfig.json'));

// Gulp tasks namespace
const ns = name => 'online::' + name;

gulp.task(ns('tsc'), function () {
  const tsResult = tsProject.src()
    .pipe(tsProject())
    .on('error', plugins.notify.onError({
      onLast : true,
      message: '<%= error.message %>',
      title  : 'Typescript compilation error'
    }));

  return merge(
    tsResult.js
      .pipe(plugins.ngAnnotate())
      .pipe(gulp.dest('.', { cwd: __dirname })),
    tsResult.dts
     .pipe(plugins.rename(config.dts))
     .pipe(gulp.dest(config.dist, { cwd: __dirname })));
});

gulp.task(ns('template'), gulp.series(ns('tsc'), () => gulp.src(config.templates.map(glob => path.join(__dirname, glob)))
  .pipe(plugins.angularTemplatecache({
    filename      : 'templates.js',
    root          : 'src/',
    standalone    : true,
    module        : 'hawtio-online-templates',
    templateFooter: '}]); hawtioPluginLoader.addModule("hawtio-online-templates");',
  }))
  .pipe(gulp.dest('.', { cwd: __dirname }))));

gulp.task(ns('concat'), gulp.series(ns('template'), () =>
  gulp.src(
    [
      path.join(__dirname, 'compiled.js'),
      path.join(__dirname, 'templates.js'),
    ])
    .pipe(plugins.concat(config.js))
    .pipe(gulp.dest(config.dist, { cwd: __dirname }))));

gulp.task(ns('clean'), () => del(
  [
    path.join(__dirname, 'templates.js'),
    path.join(__dirname, 'compiled.js'),
    path.join(__dirname, './site/'),
  ]));

gulp.task(ns('less'), () => gulp.src(config.less.map(glob => path.join(__dirname, glob)))
  .pipe(plugins.less({
    paths: [path.join(__dirname, 'node_modules')]
  }))
  .on('error', plugins.notify.onError({
    onLast : true,
    message: '<%= error.message %>',
    title  : 'less file compilation error'
  }))
  .pipe(plugins.concat(config.css))
  .pipe(gulp.dest(config.dist, { cwd: __dirname })));

gulp.task(ns('copy-images'), function () {
  return gulp.src('./img/**/*')
    .pipe(gulp.dest(path.join(config.dist, 'img')));
});

gulp.task(ns('site-fonts'), () =>
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

gulp.task(ns('site-files'), () => gulp.src(['images/**', 'img/**'], { base: '.' })
  .pipe(plugins.chmod(0o644))
  .pipe(plugins.dedupe({ same: false }))
  .pipe(plugins.debug({ title: 'site files' }))
  .pipe(gulp.dest('site')));

gulp.task(ns('site-config'), () => gulp.src('hawtconfig.json')
  .pipe(gulp.dest('site')));

gulp.task(ns('site-usemin'), () => gulp.src('index.html')
  .pipe(plugins.usemin({
    css: [plugins.minifyCss({ keepBreaks: true }), 'concat'],
    js : [plugins.uglify(), plugins.rev()],
  }))
  .pipe(plugins.debug({ title: 'site usemin' }))
  .pipe(gulp.dest('site')));

gulp.task(ns('site-tweak-urls'), gulp.series(ns('site-usemin'), ns('site-config'), () => merge(
  gulp.src('site/style.css')
    .pipe(plugins.replace(/url\(\.\.\//g, 'url('))
    // tweak fonts URL coming from PatternFly that does not repackage then in dist
    .pipe(plugins.replace(/url\(\.\.\/components\/font-awesome\//g, 'url('))
    .pipe(plugins.replace(/url\(\.\.\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(node_modules\/bootstrap\/dist\//g, 'url('))
    .pipe(plugins.replace(/url\(node_modules\/patternfly\/components\/bootstrap\/dist\//g, 'url('))
    .pipe(gulp.dest('site')),
  gulp.src('site/hawtconfig.json')
    .pipe(plugins.replace(/node_modules\/@hawtio\/core\/dist\//g, ''))
    .pipe(gulp.dest('site')))
  .pipe(plugins.debug({ title: 'site tweak urls' }))));

gulp.task(ns('site-images'), function () {
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

gulp.task(ns('build'), gulp.series(gulp.parallel(['concat', 'less', 'copy-images'].map(ns)), ns('clean')));

gulp.task(ns('site'), gulp.series(ns('clean'), gulp.parallel(['site-fonts', 'site-files', 'site-usemin', 'site-tweak-urls', 'site-images', 'site-config'].map(ns))));

gulp.task(ns('reload'), done => { done() });

gulp.task(ns('watch-less'), () => gulp.watch(
  config.less,
  { cwd: __dirname },
  gulp.series(ns('less'))));

gulp.task(ns('watch-ts'), () => {
  const tsconfig = require(path.join(__dirname, 'tsconfig.json'));
  return gulp.watch(
    [...tsconfig.include, ...(tsconfig.exclude || []).map(e => `!${e}`), ...config.templates],
    { cwd: __dirname },
    gulp.series(ns('concat'), ns('clean')))});

gulp.task(ns('watch-files'), () => gulp.watch(
  ['index.html', path.join(config.dist, '*')],
  { cwd: __dirname },
  gulp.series(ns('reload'))));

gulp.task(ns('watch'), gulp.parallel(['watch-ts', 'watch-less', 'watch-files'].map(ns)));
