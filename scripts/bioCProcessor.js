import fs from 'node:fs/promises';
import path from 'node:path';
import lodash from 'lodash';
import Path from 'path'

// https://academic.oup.com/bioinformatics/article/38/18/4449/6651836
const ANNOTATION_TYPES = {
  GENE: 'Gene',
  SPECIES: 'Species',
  CHEMICAL: 'Chemical',
  DISEASE: 'Disease',
  CELL_LINE: 'CellLine',
  // DNA_MUTATION: 'DNAMutation',
  // PROTEIN_MUTATION: 'ProteinMutation',
  // SNP: 'SNP',
  // DNA_ALLELE: 'DNAAllele',
  // PROTEIN_ALLELE: 'ProteinAllele',
  // ACID_CHANGE: 'AcidChange',
  // OTHER_MUTATION: 'OtherMutation'
};

const annotationTypeSet = new Set( Object.values(ANNOTATION_TYPES));

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

  const isValid = annotation => {
    const isValidType = annotation => {
      const { infons: { type }} = annotation;
      return annotationTypeSet.has( type );
    };
    const hasXref = annotation => {
      const { infons } = annotation;
      return lodash.has( infons, 'identifier' );
    }
    return isValidType( annotation ) && hasXref( annotation );
  };

  const toHint = annotation => {
    const entityTypes = new Map([
      [ANNOTATION_TYPES.GENE, 'ggp'],
      [ANNOTATION_TYPES.CHEMICAL, 'chemical'],
      [ANNOTATION_TYPES.DISEASE, 'disease'],
      [ANNOTATION_TYPES.CELL_LINE, 'cellLine'],
      [ANNOTATION_TYPES.SPECIES, 'organism']
    ]);
    const dbPrefixes = new Map([
      [ANNOTATION_TYPES.GENE, 'NCBIGene'],
      [ANNOTATION_TYPES.CHEMICAL, 'CHEBI'],
      [ANNOTATION_TYPES.DISEASE, 'mesh'],
      [ANNOTATION_TYPES.CELL_LINE, 'cellosaurus'],
      [ANNOTATION_TYPES.SPECIES, 'NCBITaxon'],
    ]);
    const dbNames = new Map([
      [ANNOTATION_TYPES.GENE, 'NCBI Gene'],
      [ANNOTATION_TYPES.CHEMICAL, 'ChEBI'],
      [ANNOTATION_TYPES.DISEASE, 'MeSH'],
      [ANNOTATION_TYPES.CELL_LINE, 'Cellosaurus'],
      [ANNOTATION_TYPES.SPECIES, 'NCBI Taxonomy'],
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
    const { infons: { doi, comment, pmid } } = document;
    let hints = [];
    const sections = ['title' , 'abstract'];
    for( const section of sections ){
      const passage = getPassage(document, section);
      let { annotations } = passage;
      annotations = lodash.uniqBy( annotations, byXref );
      annotations = lodash.filter( annotations, isValid );
      annotations.forEach( a => {
        const hint = toHint( a );
        lodash.set(hint, 'section', section);
        hints.push( hint );
      });
    }
    cases.push({
      id: `https://dx.doi.org/${doi}`,
      entities: [],
      comment,
      pmid,
      hints
    });
  }
  return cases;
}

async function getTestCases(fpath) {
  const bioCCollection = await load(fpath);
  const cases = asCases(bioCCollection);
  return cases;
}

async function main(){
  // Constants
  const JSON_DIRECTORY = 'json'
  const INPUT_DIRECTORY = 'pubtator'
  const OUTPUT_DIRECTORY = 'tests/raw'
  const SRC_DIR = path.join(JSON_DIRECTORY, INPUT_DIRECTORY);

  try {
    const files = await fs.readdir(SRC_DIR);
    for (const file of files){
      const inpath = path.join(SRC_DIR, file);
      const out_filename = `test_${Path.basename(file)}`;
      const cases = await getTestCases(inpath);

      const outpath = path.join(JSON_DIRECTORY, OUTPUT_DIRECTORY, out_filename);
      await save(outpath, cases);
    }
  } catch (err) {
    console.error(err);
  }

}

await main()