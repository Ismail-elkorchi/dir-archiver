/* global Deno */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runtimeSupport, supportMatrix } from '@ismail-elkorchi/bytefold/support';
import { extract, list, write } from '../dist/index.js';

const run = async () => {
  const tmpRoot = await Deno.makeTempDir({ prefix: 'dir-archiver-deno-' });

  try {
    const source = join(tmpRoot, 'source');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'hello.txt'), 'hello');
    const archive = join(tmpRoot, 'archive.zip');
    const extractTarget = join(tmpRoot, 'extracted');

    await write(source, archive, { format: 'zip' });
    if (!existsSync(archive)) {
      throw new Error('Deno smoke: archive was not created.');
    }

    const listed = await list(archive, {});
    if (listed.entries.length === 0) {
      throw new Error('Deno smoke: list returned no entries.');
    }

    await extract(archive, extractTarget, { profile: 'strict' });
    const extractedFile = join(extractTarget, 'hello.txt');
    if (readFileSync(extractedFile, 'utf8') !== 'hello') {
      throw new Error('Deno smoke: extracted file content mismatch.');
    }

    const denoSupport = runtimeSupport('deno');
    const unsupportedWriteFormat = supportMatrix.formats.find((format) => denoSupport[format].write.state !== 'supported');
    if (!unsupportedWriteFormat) {
      throw new Error('Deno smoke: expected at least one unsupported write format.');
    }

    let unsupportedFailed = false;
    try {
      await write(source, join(tmpRoot, `unsupported.${unsupportedWriteFormat.replace('/', '.')}`), {
        format: unsupportedWriteFormat
      });
    } catch {
      unsupportedFailed = true;
    }
    if (!unsupportedFailed) {
      throw new Error(`Deno smoke: unsupported write format "${unsupportedWriteFormat}" unexpectedly succeeded.`);
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  Deno.exit(1);
});
