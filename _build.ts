import _ from 'lodash';
import CoffeeScript from 'coffeescript';
import fs from 'fs';
import { createIndentedFilter } from 'indented-filter';
import moment from 'moment';
import mustache from 'mustache';
import path from 'path';
import rimraf from 'rimraf';
import showdown, { Converter } from 'showdown';
import stylus from 'stylus';
import Turndown from 'turndown';
import yaml from 'js-yaml';

interface Context {
  [key: string]: any
};

interface Tag {
  date: string,
  title: string
  url: string
};

interface Tags {
  [key: string]: Tag[]
};

const postsLimit = 5;

const tags: Tags = {'': []};
const today = moment();

function mkAttrs(obj: {[key: string]: any}): string {
  let res = '';
  for (const [key, value] of _.toPairs(obj))
    res += ` ${key}=${JSON.stringify(value)}`
  return res.trim();
}

showdown.setFlavor('github');
showdown.extension('ClassExtension', {
  type: 'output',
  filter: text =>
    text
      .replace(/([/]?>) *{\s*((:\w+=".*?")(\s*:\w+=".*?")*)\s*}/g, ' $2 $1')
      .replace(/:(\w+=".*?")/g, '$1'),
});
showdown.extension('ExternalLinksExtension', {
  type: 'output',
  regex: /<a href="[^"]*" *>/,
  filter: str =>
    str.replace(/<a href="[^"]*" *>/g, substr => {
      const match = /<a href="(?<href>[^"]*)" *>/.exec(substr);
      const href = match?.groups?.href || '.';
      if (href.startsWith('http') && (href.indexOf('cacilhas.info') === -1))
        return `<a href="${href}" target="_blank">`;
      return substr;
    }),
});
showdown.extension('AbbrExtension', {
  type: 'lang',
  filter: createIndentedFilter('^^abbr', (str, attrs) => `<abbr ${mkAttrs(attrs)}>${str.trim()}</abbr>`),
});
showdown.extension('IExtension', {
  type: 'lang',
  filter: createIndentedFilter('^^i', str => `<i>${str.trim()}</i>`),
});
showdown.extension('YoutubeExtension', {
  type: 'lang',
  filter: createIndentedFilter('^^youtube', str => {
    const params = str.split(/\s+/);
    const code = params[0];
    const htmlParams = params.slice(1).join(' ');
    return `<div class="text-center">
      <iframe src="https://www.youtube.com/embed/${code}"
              frameborder="0" ${htmlParams}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
      </iframe>
    </div>`.replace(/\n\s+/g, ' ');
  }),
});
showdown.extension('BrExtension', {
  type: 'output',
  regex: /<br\s*>/g,
  replace: '<br/>',
});
showdown.extension('ImgExtension', {
  type: 'output',
  regex: /<img([^>]+[^/])>/g,
  replace: '<img $1 />',
});
showdown.extension('PreExtension', {
  type: 'output',
  regex: /<pre>/g,
  replace: '<pre class="prettyprint">',
});
showdown.extension('TableExtension', {
  type: 'output',
  regex: /<table>/g,
  replace: '<table class="table">',
});

function buildMdConverter(): Converter {
  const converter = new Converter({extensions: [
    'AbbrExtension',
    'BrExtension',
    'ClassExtension',
    'ExternalLinksExtension',
    'IExtension',
    'ImgExtension',
    'PreExtension',
    'TableExtension',
    'YoutubeExtension',
  ]});

  converter.setOption('completeHTMLDocument', false);
  converter.setOption('literalMidWordUnderscores', true);
  converter.setOption('metadata', true);
  converter.setOption('parseImgDimensions', true);
  converter.setOption('requireSpaceBeforeHeadingText', true);
  converter.setOption('simplifiedAutoLink', true);
  converter.setOption('simpleLineBreaks', false);
  converter.setOption('strikethrough', true);
  converter.setOption('tables', true);
  converter.setOption('tasklists', true);
  converter.setOption('underline', true);

  return converter;
}

async function walk(directory: string, context: Context, layout: string): Promise<void> {
  console.log(`walking through ${directory}`);
  const layoutCandidate = `${directory}/_layout.html`;
  const currentLayout = fs.existsSync(layoutCandidate) ? layoutCandidate : layout;
  const currentContext = loadContext(directory, context);
  const promises: Promise<void>[] = [];

  const files = fs.readdirSync(directory).filter(e => !(e.startsWith('.') || e.startsWith('_')));
  for (let cname of files) {
    const file = path.join(directory, cname);
    const stats = fs.statSync(file);
    let target = file.replace(/^.+?\/(.*)$/, './docs/$1');

    if (stats.isDirectory()) {
      if (!fs.existsSync(target)) createDirSync(target);
      promises.push(walk(file, currentContext, currentLayout));
    } else {
      let output: string|null = null;
      if (cname.endsWith('.coffee')) {
        target = target.replace(/\.coffee$/, '.js');
        output = CoffeeScript.compile(fs.readFileSync(file, 'utf8'));

      } else if (cname.endsWith('.styl')) {
        target = target.replace(/\.styl$/, '.css');
        output = await new Promise<string>((resolve, reject) =>
          stylus(fs.readFileSync(file, 'utf8'))
            .set('filename', target)
            .set('paths', [ directory ])
            .render((err: Error, css: string) => err ? reject(err) : resolve(css))
        );

      } else if (cname.endsWith('.md')) {
        const converter = buildMdConverter();
        target = target.replace(/\.md$/, '.html');
        const block = converter.makeHtml(fs.readFileSync(file, 'utf8'));
        const metadata: Context = _.assign({}, currentContext, converter.getMetadata());
        metadata.source = file;
        metadata.identifier = metadata.identifier
          ? metadata.identifier
          : file.replace(/\.[^.]+$/, '').replace(/\//g, '.');
        metadata.type = metadata.type ? metadata.type : 'post';
        metadata.post = metadata.type === 'post';
        if (metadata.date)
          metadata.isoDate = moment(metadata.date).format('MMM. DD, YYYY');
        else {
          metadata.date = today.format('YYYY-MM-DD');
          metadata.isoDate = today.format('MMM. DD, YYYY');
        }
        if (metadata.permalink) {
          metadata.url = `${metadata.site}${metadata.permalink}`;
          target = `./docs${metadata.permalink}`;
          const dirname = path.dirname(target);
          if (!fs.existsSync(dirname)) createDirSync(dirname);
        } else
          metadata.url = `${metadata.site}/${target.replace(/^\.\/docs/, '')}`;
        output = mustache.render(
          fs.readFileSync(currentLayout, 'utf8').replace(/\{%\s*yield\s*%\}/, block),
          metadata,
        );

        if (metadata.post) {
          const current: Tag = {
            date: metadata.date,
            title: metadata.title,
            url: metadata.url,
          };
          tags[''].push(current);
          if (metadata.tags)
            for (let tag of <string[]>metadata.tags.split(/\s+/).filter((e: string) => !!e))
              if (tags[tag]) tags[tag].push(current);
              else tags[tag] = [current];

          buildAlternative(block, metadata, target.replace(/\.html$/, '.md'));
        }

      } else
        promises.push(copyFile(file, target));

      if (output !== null)
        promises.push(writeFile(target, output));
    }
  }

  await Promise.all(promises);
}

function buildAlternative(block: string, metadata: Context, target: string): void {
  const converter = new Turndown;
  fs.writeFileSync(
    target,
    converter.turndown(mustache.render(block, metadata)),
    {encoding: 'utf8'},
  );
}

function createDirSync(dirname: string): void {
  const parentDir = path.dirname(dirname);
  if (!fs.existsSync(parentDir)) createDirSync(parentDir);
  fs.mkdirSync(dirname);
}

function copyFile(source: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(target, {autoClose: true});
    const input = fs.createReadStream(source, {autoClose: true});
    input
      .on('ready', () => input.pipe(output))
      .on('error', err => reject(err))
      .on('close', () => resolve());
  });
}

function writeFile(file: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, content, {encoding: 'utf8'}, err =>
      err ? reject(err) : resolve()
    );
  });
}

function loadYaml(file: string): Context {
  return yaml.load(fs.readFileSync(file, 'utf8')) as Context;
}

function loadContext(directory: string, context: Context): Context {
  let res: Context = _.cloneDeep(context);
  const files = fs.readdirSync(directory).filter(e => e.startsWith('_') && e.endsWith('.yaml'));
  for (let cname of files) {
    const file = path.join(directory, cname);
    res = _.assign(res, loadYaml(file));
  }
  return res;
}

async function ordenateTags(output: string): Promise<void> {
  await Promise.all(_.map(tags, (value: Tag[]) => Promise.resolve(value.sort((a, b) => a.date > b.date ? -1 : 1))));
  const postsFile = path.join(output, 'posts.json');
  console.log(`writing ${postsFile}`);
  fs.writeFileSync(postsFile, JSON.stringify(tags[''].slice(0, postsLimit)), {encoding: 'utf8'});

  const tagDir = path.join(output, 'tags');
  fs.mkdirSync(tagDir);

  await Promise.all(_.toPairs(tags).filter(([key, _v]) => !!key).map(([key, value]) =>
    new Promise((resolve, reject) => {
      console.log(`writing ${key} tag`);
      fs.writeFile(`${path.join(tagDir, key)}.json`, JSON.stringify(value), err => err ? reject(err) : resolve(null));
    })
  ));

  const tagsFile = path.join(output, 'tags.json');
  console.log(`writing ${tagsFile}`);
  fs.writeFileSync(tagsFile, JSON.stringify(_.keys(tags).filter(e => !!e).sort()), {encoding: 'utf8'});
}

async function main(): Promise<void> {
  console.log('loading context');
  const context: Context = loadYaml('./_config.yaml');

  console.log('clean up previous compilation');
  rimraf.sync('./docs');
  fs.mkdirSync('./docs');
  fs.writeFileSync('./docs/.nojekyll', '');

  await Promise.all([walk('./_legacy', context, ''), walk('./_source', context, '')]);
  await ordenateTags('./docs');
}

main()
  .then(() => console.log("built"))
  .catch(console.error);
