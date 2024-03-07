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

function asHint(bioCDocument) {

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
      [ANNOTATION_TYPES.SPECIES, 'taxonomy'],
    ]);
    const dbProviderCode = new Map([
      [ANNOTATION_TYPES.SPECIES, 'ncbi'],
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

  const { infons: { doi, comment, pmid } } = bioCDocument;
  let hints = [];
  const sections = ['title' , 'abstract'];
  for( const section of sections ){
    const passage = getPassage(bioCDocument, section);
    let { annotations } = passage;
    annotations = lodash.uniqBy( annotations, byXref );
    annotations = lodash.filter( annotations, isValid );
    annotations.forEach( a => {
      const hint = toHint( a );
      lodash.set(hint, 'section', section);
      hints.push( hint );
    });
  }
  return {
    id: `https://dx.doi.org/${doi}`,
    entities: [],
    comment,
    pmid,
    hints
  };
}

async function toHints(fpath) {
  const bioCDocument = await load(fpath);
  const cases = asHint(bioCDocument);
  return cases;
}

async function main(){
  // Constants
  const SOURCE_DIR = 'sources';
  const OUTPUT_DIRECTORY = 'hints';
  try {
    // const dirs = await fs.readdir(SOURCE_DIR);
    const dirs = ['pubtator'];
    for (const dir of dirs){
      const files = await fs.readdir(path.join(SOURCE_DIR, dir));
      for (const file of files){
        const inpath = path.join(SOURCE_DIR, dir, file);
        const hint = await toHints(inpath);

        const hints_filename = `hints_${Path.basename(file)}`;
        const outpath = path.join(OUTPUT_DIRECTORY, hints_filename);
        // await save(outpath, hint);
      }
    }

  } catch (err) {
    console.error(err);
  }

}

await main()