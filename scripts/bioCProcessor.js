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

function asCases(bioCCollection) {

  const byXref = annotation => {
    const { infons: { type, identifier }} = annotation;
    return `${type}_${identifier}`;
  }
  const getPassage = (document, section) => {
    const { passages } = document;
    return lodash.find( passages, o => o.infons.type === section );
  };

  const isValidType = annotation => {
    const validAnnotationTypes = new Set(['Gene', 'Species']);
    const { infons: { type }} = annotation;
    return validAnnotationTypes.has( type )
  };

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

  const { documents } = bioCCollection;
  const cases = [];
  for (const document of documents ){
    const { infons: { doi } } = document;
    let hints = [];
    const sections = ['title' , 'abstract'];
    for( const section of sections ){
      const passage = getPassage(document, section);
      let { annotations } = passage;
      annotations = lodash.uniqBy( annotations, byXref );
      annotations = lodash.filter( annotations, isValidType );
      annotations.forEach( a => {
        const hint = toHint( a );
        lodash.set(hint, 'section', section);
        hints.push( hint );
      });
    }
    cases.push({
      id: `https://dx.doi.org/${doi}`,
      entities: [],
      hints
    });
  }
  return cases;
}

async function getCases(fpath) {
  const bioCCollection = await load(fpath);
  const cases = asCases(bioCCollection);
  return cases;
}

async function main(){
  // Constants
  const JSON_DIRECTORY = 'json'
  const INPUT_DIRECTORY = 'pubtator'
  const OUTPUT_DIRECTORY = 'cases'
  const jsonFile = 'all.json';
  const inpath = path.join(JSON_DIRECTORY, INPUT_DIRECTORY, jsonFile);
  const outpath = path.join(JSON_DIRECTORY, OUTPUT_DIRECTORY, jsonFile);
  const cases = await getCases(inpath);
  await save(outpath, cases);
}

await main()