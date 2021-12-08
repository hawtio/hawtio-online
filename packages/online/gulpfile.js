const gulp            = require('gulp'),
      gulpLoadPlugins = require('gulp-load-plugins'),
      del             = require('del'),
      fs              = require('fs'),
      merge           = require('merge2'),
      path            = require('path'),
      argv            = require('yargs').argv;

const package = require('./package.json');
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

// Helpers
const task = (name, fn) => {
  fn.displayName = `[online] ${name}`; return fn;
};

const ns = name => `online::${name}`;

// Workspace tasks
function cleanBuild() {
  return del(['compiled.js', 'templates.js'].map(f => path.join(__dirname, f)));
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

function compileTemplates() {
  return gulp.src(config.templates, { cwd: __dirname })
  .pipe(plugins.angularTemplatecache({
    filename      : 'templates.js',
    root          : 'src/',
    standalone    : true,
    module        : 'hawtio-online-templates',
    templateFooter: '}]); hawtioPluginLoader.addModule("hawtio-online-templates");',
  }))
  .pipe(gulp.dest('.', { cwd: __dirname }));
}

function concatBuildFiles() {
  return gulp.src(['compiled.js', 'templates.js'], { cwd: __dirname })
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

function distImages() {
  return gulp.src('./img/**/*').pipe(gulp.dest(path.join(config.dist, 'img')));
}

function updateProductInfo() {
  return gulp.src(path.join(config.dist, config.js), { cwd: __dirname })
    .pipe(plugins.replace('PACKAGE_VERSION_PLACEHOLDER', package.version))
    .pipe(gulp.dest(config.dist, { cwd: __dirname }));
}

gulp.task(ns('build'), gulp.series(
  gulp.parallel(
    gulp.series(
      task('Compile TS files', compileTsFiles),
      task('Compile templates', compileTemplates),
      task('Concat compiled files', concatBuildFiles),
      task('Update product info', updateProductInfo),
      task('Clean build', cleanBuild)),
    task('Compile LESS files', compileLess),
    task('Copy images', distImages)
  )));

function cleanSite() {
  return del([path.join(__dirname, './site/')]);
}

function copyFonts() {
  return gulp.src(['node_modules/**/*.woff', 'node_modules/**/*.woff2',
    'node_modules/**/*.ttf', 'node_modules/**/fonts/*.eot', 'node_modules/**/fonts/*.svg'],
    { base: '.' })
    .pipe(plugins.flatten())
    .pipe(plugins.chmod(0o644))
    .pipe(plugins.dedupe({ same: false }))
    .pipe(plugins.debug({ title: 'site fonts' }))
    .pipe(gulp.dest('site/fonts/', { overwrite: false }));
}

function copyImages() {
  return gulp.src(['images/**', 'img/**'], { base: '.' })
  .pipe(plugins.chmod(0o644))
  .pipe(plugins.dedupe({ same: false }))
  .pipe(plugins.debug({ title: 'site images' }))
  .pipe(gulp.dest('site'));
}

function siteBundle() {
  return gulp.src('@(index|login).html')
    .pipe(plugins.usemin({
      css: [() => plugins.cleanCss({ format: 'keep-breaks', inline: false })],
      js: [plugins.uglify, plugins.rev],
    }))
    .pipe(plugins.debug({ title: 'site bundle' }))
    .pipe(gulp.dest('site'));
}

function copyConfig() {
  return gulp.src('hawtconfig.json').pipe(gulp.dest('site'));
}

function tweakUrls() {
  return merge(
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
    .pipe(plugins.debug({ title: 'site tweak urls' }));
}

function copyDepsImages() {
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
}

gulp.task(ns('site'), gulp.series(
  task('Clean site', cleanSite),
  gulp.parallel(
    task('Copy fonts to site', copyFonts),
    gulp.series(
      task('Copy deps images to site', copyDepsImages),
      task('Copy images to site', copyImages)),
    gulp.series(
      task('Site bundle', siteBundle),
      task('Copy config to site', copyConfig),
      task('Tweak site URLs', tweakUrls)))));

function watchTsFiles() {
  const tsconfig = require(path.join(__dirname, 'tsconfig.json'));
  return gulp.watch(
    [...tsconfig.include, ...(tsconfig.exclude || []).map(e => `!${e}`), ...config.templates],
    { cwd: __dirname },
    gulp.series(compileTsFiles, compileTemplates, concatBuildFiles, cleanBuild));
}

function watchLessFiles() {
  return gulp.watch(config.less, { cwd: __dirname }, compileLess);
}

function watchResources() {
  return gulp.watch(['@(index|login).html', path.join(config.dist, '*')], { cwd: __dirname },
    gulp.series(ns('reload')));
}

gulp.task(ns('reload'), done => { done() });

gulp.task(ns('watch'), gulp.parallel(
  task('Watch TS files', watchTsFiles),
  task('Watch LESS files', watchLessFiles),
  task('Watch resources', watchResources)));
