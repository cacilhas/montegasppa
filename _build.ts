import _ from 'lodash'
import CoffeeScript from 'coffeescript'
import fs from 'fs'
import moment from 'moment'
import mustache from 'mustache'
import path from 'path'
import rimraf from 'rimraf'
import showdown from 'showdown'
import stylus from 'stylus'
import yaml from 'js-yaml'

interface Context {
  [key: string]: any
}

interface Tag {
  title: string
  url: string
}

interface Tags {
  [key: string]: Tag[]
}

const tags: Tags = {}
const today = moment()

showdown.setFlavor('github')

function buildMdConverter(): showdown.Converter {
  const converter = new showdown.Converter
  converter.setOption('completeHTMLDocument', false)
  converter.setOption('metadata', true)
  converter.setOption('parseImgDimensions', true)
  converter.setOption('simplifiedAutoLink', true)
  converter.setOption('strikethrough', true)
  converter.setOption('tables', true)
  converter.setOption('tasklists', true)
  return converter
}

async function walk(directory: string, context: Context, layout: string): Promise<void> {
  console.log(`walking through ${directory}`)
  const layoutCandidate = `${directory}/_layout.html`
  const currentLayout = fs.existsSync(layoutCandidate) ? layoutCandidate : layout
  const currentContext: Context = loadContext(directory, context)
  const promises: Promise<void>[] = []

  const files = fs.readdirSync(directory).filter(e => !(e.startsWith('.') || e.startsWith('_')))
  for (let cname of files) {
    const file = path.join(directory, cname)
    const stats = fs.statSync(file)
    let target: string = file.replace(/^.+?\/(.*)$/, './docs/$1')

    if (stats.isDirectory()) {
      if (!fs.existsSync(target)) createDirSync(target)
      promises.push(walk(file, currentContext, currentLayout))
    } else {
      let output: string|null = null
      if (cname.endsWith('.coffee')) {
        target = target.replace(/\.coffee$/, '.js')
        output = CoffeeScript.compile(fs.readFileSync(file, 'utf8'))

      } else if (cname.endsWith('.styl')) {
        target = target.replace(/\.styl$/, '.css')
        output = await new Promise<string>((resolve, reject) =>
          stylus(fs.readFileSync(file, 'utf8'))
            .set('filename', target)
            .set('paths', [ directory ])
            .render((err: Error, css: string) => {
              if (err) reject(err)
              else resolve(css)
            })
        )

      } else if (cname.endsWith('.md')) {
        const converter = buildMdConverter()
        target = target.replace(/\.md$/, '.html')
        const block =
          converter.makeHtml(fs.readFileSync(file, 'utf8'))
          .replace(/<pre>/g, '<pre class="prettyprint prettyprinted">')
        const metadata = _.assign({}, currentContext, converter.getMetadata())
        if (metadata.date)
          metadata.isoDate = moment(metadata.date).format('MMM. DD, YYYY')
        else {
          metadata.date = today.format('YYYY-MM-DD')
          metadata.isoDate = today.format('MMM. DD, YYYY')
        }
        if (metadata.permalink) {
          metadata.url = `${metadata.site}${metadata.permalink}`
          target = `./docs${metadata.permalink}`
          const dirname = path.dirname(target)
          if (!fs.existsSync(dirname)) createDirSync(dirname)
        } else
          metadata.url = `${metadata.site}/${target.replace(/^\.\/docs/, '')}`
        output = mustache.render(
          fs.readFileSync(currentLayout, 'utf8').replace(/\{%\s*yield\s*%\}/, block),
          metadata,
        )

        if (metadata.tags) {
          const current: Tag = {
            title: metadata.title,
            url: metadata.url,
          }
          for (let tag of metadata.tags.split(/\s+/).filter(e => !!e))
            if (tags[tag]) tags[tag].push(current)
            else tags[tag] = [current]
        }

      } else
        promises.push(copyFile(file, target))

      if (output !== null)
        promises.push(writeFile(target, output))
    }
  }

  await Promise.all(promises)
}

function createDirSync(dirname: string): void {
  const parentDir = path.dirname(dirname)
  if (!fs.existsSync(parentDir)) createDirSync(parentDir)
  fs.mkdirSync(dirname)
}

function copyFile(source: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(target, {autoClose: true})
    const input = fs.createReadStream(source, {autoClose: true})
    input
      .on('ready', () => input.pipe(output))
      .on('error', err => reject(err))
      .on('close', () => resolve())
  })
}

function writeFile(file: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, content, {encoding: 'utf8'}, err => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function loadYaml(file: string): Context {
  return yaml.safeLoad(fs.readFileSync(file, 'utf8'))
}

function loadContext(directory: string, context: Context): Context {
  let res: Context = _.cloneDeep(context)
  const files = fs.readdirSync(directory).filter(e => e.startsWith('_') && e.endsWith('.yaml'))
  for (let cname of files) {
    const file = path.join(directory, cname)
    res = _.assign(res, loadYaml(file))
  }
  return res
}

;(async () => {
  console.log('loading context')
  const context: Context = loadYaml('./_config.yaml')

  console.log('clean up previous compilation')
  rimraf.sync('./docs')
  fs.mkdirSync('./docs')

  await Promise.all([walk('./_legacy', context, ''), walk('./_source', context, '')])

})()
  .then(() => console.log("built"))
  .catch(console.error)
