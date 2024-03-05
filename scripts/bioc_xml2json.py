from bioc import biocxml
from bioc import biocjson
from bioc import BioCCollection
from os import walk, path
from pathlib import Path

#### Constants
PUBTATOR_DIRECTORY = 'datasources/pubtator'
BIOC_XML_PATH = path.join(PUBTATOR_DIRECTORY, 'xml')
BIOC_JSON_PATH = path.join(PUBTATOR_DIRECTORY, 'json')

f = []
for (dirpath, dirnames, filenames) in walk(BIOC_XML_PATH):
    f.extend(filenames)
    break

# all = BioCCollection()
### Deserialize ``fp`` to a BioC collection object.
for filename in f:
  with open(path.join(BIOC_XML_PATH, filename), 'r') as fp:
    collection = biocxml.load(fp)

  # [ all.add_document(d) for d in collection.documents ]

  ### Serialize ``collection`` to a BioC Json formatted ``str``.
  # jsonFile = 'all.json'
  jsonFile = Path(filename).stem + '.json'
  with open(path.join(BIOC_JSON_PATH, jsonFile), 'w') as fp:
    biocjson.dump(collection, fp, indent=2)