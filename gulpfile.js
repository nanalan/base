const gulp = require('gulp')
const util = require('gulp-util')
const fs = require('fs')

gulp.task('build:css', resolve => {
  const stylus = require('stylus') // gulp-stylus doesn't work w/ gulp 4
  const postcss = require('postcss')

  function reject(err) {
    throw new util.PluginError({
      plugin: 'build:css',
      message: err.message
    })
  }

  fs.readFile('src/style.styl', 'utf8', (err, style) => {
    if(err) {
      throw new util.PluginError({
        plugin: 'build:css',
        message: err.message
      })
    } else {
      stylus(style)
        .use(require('jeet'))
        .set('filename', 'src/style.styl')
        .set('sourcemap', { inline: true })
        .set('paths', [__dirname + '/src'])
        .render((err, css) => {
          if(err) {
            reject(err)
          } else {
            postcss([
              require('postcss-import')({ plugins: [
                require('cssnano')({ safe: true })
              ] }),
              require('rucksack-css')({ fallbacks: true, autoprefixer: true }),
              require('cssnano')({ safe: true }),
            ])
              .process(css, {
                from: 'src/style.styl',
                to: 'dist/style.css',
                map: {
                  inline: false,
                },
              })
              .catch(reject)
              .then(res => {
                fs.writeFile('dist/style.css', res.css, 'utf8', err => {
                  if(err) reject(err)
                  else {
                    fs.writeFile('dist/style.css.map', res.map, 'utf8', err => {
                      if(err) reject(err)
                      else resolve()
                    })
                  }
                })
              })
          }
        })
    }
  })
})

gulp.task('watch:css', () => gulp.watch('src/**/*.styl', gulp.series('build:css')))

function buildJs(resolve, watch=false) {
  const browserify = require('browserify')
  const watchify = require('uber-watchify')

  const sourcemaps = require('gulp-sourcemaps')

  const transform = require('vinyl-transform')
  const source = require('vinyl-source-stream')
  const buffer = require('vinyl-buffer')

  function reject(err) {
    throw new util.PluginError({
      plugin: 'build:js',
      message: err.message
    })
  }

  let opts = Object.assign({}, watchify.args, {
    entries: ['src/script.js'],
    debug: true,
    watch,
  })

  if(watch) var b = watchify(browserify(opts))
  else      var b = browserify(opts)

  b.transform(require('babelify').configure({
    presets: 'latest',
    plugins: 'transform-runtime',
  }))

  b.on('update', () => {
    util.log(`Starting '${util.colors.cyan(`build:js`)}'...`)
    build()
  })

  b.on('log', what => util.log(`Finished '${util.colors.cyan(`build:js`)}': ` + what))

  function build() {
    return b.bundle()
      .on('error', reject)
      .on('end', resolve)
      .pipe(source('script.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(require('gulp-uglify')())
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('dist'))
  }

  return build
}

gulp.task('build:js', resolve => {
  return buildJs(resolve, false)()
})

gulp.task('watch:js', () => {
  buildJs(() => {}, true)()
})

gulp.task('build', gulp.parallel('build:js', 'build:css'))
gulp.task('watch', gulp.parallel('watch:js', 'watch:css'))
