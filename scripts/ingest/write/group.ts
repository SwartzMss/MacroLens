import fs from 'node:fs/promises';
import path from 'node:path';

type ExistingOutput = { exists: boolean; content: string };
type FileSystem = Pick<typeof fs, 'readFile' | 'mkdir' | 'mkdtemp' | 'writeFile' | 'rename' | 'copyFile' | 'rm'>;

async function readOutput(filePath: string, fileSystem: FileSystem): Promise<ExistingOutput> {
  try {
    return { exists: true, content: await fileSystem.readFile(filePath, 'utf8') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { exists: false, content: '' };
  }
}

export async function writeIndicatorDatasetGroup(
  outputs: Map<string, string>,
  fileSystem: FileSystem = fs,
): Promise<{ changed: boolean }> {
  if (outputs.size === 0) throw new Error('Cannot write an empty indicator group');
  const targets = [...outputs.keys()];
  const parent = path.dirname(targets[0]);
  if (targets.some((target) => path.dirname(target) !== parent)) {
    throw new Error('Indicator group targets must share one directory');
  }

  const current = new Map<string, ExistingOutput>();
  for (const target of targets) current.set(target, await readOutput(target, fileSystem));
  const changed = targets.some((target) => current.get(target)?.content !== outputs.get(target));
  if (!changed) return { changed: false };

  await fileSystem.mkdir(parent, { recursive: true });
  const staging = await fileSystem.mkdtemp(path.join(parent, '.macrolens-price-stage-'));
  const backups = path.join(staging, 'backups');
  try {
    await fileSystem.mkdir(backups);
    for (const target of targets) {
      await fileSystem.writeFile(path.join(staging, path.basename(target)), outputs.get(target)!, 'utf8');
    }
    for (const target of targets) {
      const staged = path.join(staging, path.basename(target));
      if (await fileSystem.readFile(staged, 'utf8') !== outputs.get(target)) {
        throw new Error(`Staged indicator output verification failed: ${target}`);
      }
    }

    for (const target of targets) {
      if (current.get(target)?.exists) {
        await fileSystem.copyFile(target, path.join(backups, path.basename(target)));
      }
      await fileSystem.rename(path.join(staging, path.basename(target)), target);
    }
    return { changed: true };
  } catch (error) {
    for (const target of targets) {
      const backup = path.join(backups, path.basename(target));
      if (current.get(target)?.exists) {
        const saved = await readOutput(backup, fileSystem);
        if (saved.exists) await fileSystem.copyFile(backup, target);
      } else {
        await fileSystem.rm(target, { force: true });
      }
    }
    throw error;
  } finally {
    await fileSystem.rm(staging, { recursive: true, force: true });
  }
}
