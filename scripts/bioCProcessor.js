import fs from 'node:fs/promises';
import path from 'node:path';
import lodash from 'lodash';

async function load(fpath){
  try {
    const str = await fs.readFile(fpath);
    const data = JSON.parse(str);
    return data;
  } catch (e) {
    console.error(e);
  }
}

async function save(fpath, data){
  try {
    const str = JSON.stringify(data, null, 2);
    await fs.writeFile(fpath, str);
  } catch (e) {
    console.error(e);
  }
}

function asHints(bioCCollection) {
  const getPassage = (document, section) => {
    const { passages } = document;
    return lodash.find( passages, o => o.infons.type === section );
  }
  const validAnnotationTypes = new Set(['Gene', 'Species']);
  const toHint = annotation => {
    const entityTypes = new Map([
      ['Gene', 'ggp'],
      ['Species', 'organism']
    ]);
    const dbPrefixes = new Map([
      ['Gene', 'ncbigene'],
      ['Species', 'ncbitaxon'],
    ]);
    const dbNames = new Map([
      ['Gene', 'NCBI Gene'],
      ['Species', 'NCBI Taxonomy'],
    ]);
    const { text, infons: { identifier: id, type } } = annotation;

    return {
      text,
      type: entityTypes.get(type),
      xref: {
        dbName: dbNames.get(type),
        dbPrefix: dbPrefixes.get(type),
        id
      }
    }
  }
  let hints = [];
  const { documents } = bioCCollection;
  const document = lodash.first(documents);

  if(document){
    const sections = ['title' , 'abstract'];
    for( const section of sections ){
      const passage = getPassage(document, section);
      const { annotations } = passage;
      const uniqAnnotations = lodash.uniqBy(annotations, 'text');
      const validAnnotations = lodash.filter(uniqAnnotations, o => validAnnotationTypes.has( o.infons.type ) );
      validAnnotations.forEach( a => {
        const hint = toHint( a );
        lodash.set(hint, 'section', section);
        hints.push( hint );
      });
    }
  }

  return hints;
}

async function getHints(fpath) {
  const bioCCollection = await load(fpath);
  const hints = asHints(bioCCollection);
  return hints;
}

async function main(){
  // Constants
  const JSON_DIRECTORY = 'json'
  const PUBTATOR_DIRECTORY = 'pubtator'
  const HINTS_DIRECTORY = 'hints'
  // BIOC_JSON_PATH = path.join(JSON_DIRECTORY, PUBTATOR_DIRECTORY)
  // HINTS_PATH = path.join(JSON_DIRECTORY, HINTS_DIRECTORY)

  const jsonFile = '10.1038_s41556-021-00642-9.json';
  const inpath = path.join(JSON_DIRECTORY, PUBTATOR_DIRECTORY, jsonFile);
  const outpath = path.join(JSON_DIRECTORY, HINTS_DIRECTORY, jsonFile);
  const hints = await getHints(inpath);
  await save(outpath, hints);
}

await main()