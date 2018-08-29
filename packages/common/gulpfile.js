const gulp            = require('gulp'),
      gulpLoadPlugins = require('gulp-load-plugins'),
      del             = require('del'),
      merge           = require('merge2'),
      path            = require('path'),
      argv            = require('yargs').argv;

const plugins = gulpLoadPlugins({});

const config = {
  templates : ['src/**/*.html'],
  less      : ['src/**/*.less'],
  dist      : argv.out || './dist/',
  js        : 'hawtio-online-common.js',
  dts       : 'hawtio-online-common.d.ts',
  css       : 'hawtio-online-common.css',
};

const tsProject = plugins.typescript.createProject(path.join(__dirname, 'tsconfig.json'));

// Helpers
const task = (name, fn) => {
  fn.displayName = `[common] ${name}`; return fn;
};

const ns = name => `common::${name}`;

// Workspace tasks
function cleanBuild() {
  return del(['compiled.js'].map(f => path.join(__dirname, f)));
}

function compileTsFiles() {
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
}

function concatBuildFiles() {
  return gulp.src(['compiled.js'], { cwd: __dirname })
    .pipe(plugins.concat(config.js))
    .pipe(gulp.dest(config.dist, { cwd: __dirname }));
}

function compileLess() {
  return gulp.src(config.less, { cwd: __dirname })
  .pipe(plugins.less({
    paths: [path.join(__dirname, 'node_modules')]
  }))
  .on('error', plugins.notify.onError({
    onLast : true,
    message: '<%= error.message %>',
    title  : 'less file compilation error'
  }))
  .pipe(plugins.concat(config.css))
  .pipe(gulp.dest(config.dist, { cwd: __dirname }));
}

gulp.task(ns('build'), gulp.series(
  gulp.parallel(
    gulp.series(
      task('Compile TS files', compileTsFiles),
      task('Concat compiled files', concatBuildFiles),
      task('Clean build', cleanBuild)),
    task('Compile LESS files', compileLess)
  )));

function watchTsFiles() {
  const tsconfig = require(path.join(__dirname, 'tsconfig.json'));
  return gulp.watch(
    [...tsconfig.include, ...(tsconfig.exclude || []).map(e => `!${e}`), ...config.templates],
    { cwd: __dirname },
    gulp.series(compileTsFiles, concatBuildFiles, cleanBuild));
}

function watchLessFiles() {
  return gulp.watch(config.less, { cwd: __dirname }, compileLess);
}

gulp.task(ns('watch'), gulp.parallel(
  task('Watch TS files', watchTsFiles),
  task('Watch LESS files', watchLessFiles)));
