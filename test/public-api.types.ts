import {
  type ArchiveInput,
  type ArchiveWriterFormat,
  type DetectResult,
  type DirArchiverErrorCode,
  type DirArchiverErrorJson,
  type ExtractOptions,
  type ExtractResult,
  type ListResult,
  type NormalizeOptions,
  type NormalizeResult,
  type ReadOptions,
  type SafetyProfile,
  type WriteOptions,
  type WriteResult,
  detect,
  extract,
  list,
  normalize,
  write
} from '../src/index.js';

const exercisePublicTypes = async (
  input: ArchiveInput,
  source: string,
  destination: string,
  readOptions: ReadOptions,
  normalizeOptions: NormalizeOptions,
  extractOptions: ExtractOptions,
  writeOptions: WriteOptions
): Promise<void> => {
  const detection: DetectResult = await detect(input, readOptions);
  const listing: ListResult = await list(input, readOptions);
  const normalized: NormalizeResult = await normalize(input, destination, normalizeOptions);
  const extracted: ExtractResult = await extract(input, destination, extractOptions);
  const written: WriteResult = await write(source, destination, writeOptions);

  void detection;
  void listing;
  void normalized;
  void extracted;
  void written;
};

const safetyProfile: SafetyProfile = 'untrusted';
const writeFormat: ArchiveWriterFormat = 'tar.zst';

const errorJson: DirArchiverErrorJson = {
  schemaVersion: '1',
  name: 'DirArchiverError',
  code: 'DIRARCHIVER_RESOURCE_LIMIT',
  message: 'Configured byte limit exceeded.'
};

// @ts-expect-error CLI usage diagnostics are not package error codes
const removedUsageCode: DirArchiverErrorCode = 'DIRARCHIVER_USAGE';

const exactReadOptions = {
  safetyProfile: 'strict'
} satisfies ReadOptions;

// @ts-expect-error legacy profile names are intentionally unsupported
const oldProfile: SafetyProfile = 'agent';

// @ts-expect-error raw compression formats are not archive writer formats
const rawWriteFormat: ArchiveWriterFormat = 'gz';

// @ts-expect-error removed read option
const oldReadOptions: ReadOptions = { profile: 'strict' };

// @ts-expect-error write options do not accept ignored safety policy fields
const ignoredWriteOption: WriteOptions = { safetyProfile: 'strict' };

// @ts-expect-error renamed extraction limit
const ambiguousExtractLimit: ExtractOptions = { maxEntryBytes: 1 };

void safetyProfile;
void writeFormat;
void errorJson;
void removedUsageCode;
void exactReadOptions;
void oldProfile;
void rawWriteFormat;
void oldReadOptions;
void ignoredWriteOption;
void ambiguousExtractLimit;
void exercisePublicTypes;
