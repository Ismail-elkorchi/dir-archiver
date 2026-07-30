import dirArchiver, {
  type DetectResult,
  type DirArchiverErrorJson,
  type DirArchiverInput,
  type DirArchiverNamespace,
  type ExtractOptions,
  type ExtractResult,
  type ListResult,
  type NormalizeOptions,
  type NormalizeResult,
  type OpenOptions,
  type WriteOptions,
  type WriteResult,
  detect,
  extract,
  list,
  normalize,
  write
} from '../src/index.js';

const namespace: DirArchiverNamespace = dirArchiver;

const exercisePublicTypes = async (
  input: DirArchiverInput,
  source: string,
  destination: string,
  openOptions: OpenOptions,
  normalizeOptions: NormalizeOptions,
  extractOptions: ExtractOptions,
  writeOptions: WriteOptions
): Promise<void> => {
  const detection: DetectResult = await detect(input, openOptions);
  const listing: ListResult = await list(input, openOptions);
  const normalized: NormalizeResult = await normalize(input, destination, normalizeOptions);
  const extracted: ExtractResult = await extract(input, destination, extractOptions);
  const written: WriteResult = await write(source, destination, writeOptions);

  void detection;
  void listing;
  void normalized;
  void extracted;
  void written;
};

const errorJson: DirArchiverErrorJson = {
  schemaVersion: '1',
  name: 'DirArchiverError',
  code: 'DIRARCHIVER_USAGE',
  message: 'Invalid command.'
};

void errorJson;
void namespace;
void exercisePublicTypes;
