import fs from 'node:fs/promises';
import path from 'node:path';

type ExistingOutput = { exists: boolean; content: string };

async function readOutput(filePath: string): Promise<ExistingOutput> {
  try {
    return { exists: true, content: await fs.readFile(filePath, 'utf8') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { exists: false, content: '' };
  }
}

export async function writeIndicatorDatasetGroup(
  outputs: Map<string, string>,
): Promise<{ changed: boolean }> {
  if (outputs.size === 0) throw new Error('Cannot write an empty indicator group');
  const targets = [...outputs.keys()];
  const parent = path.dirname(targets[0]);
  if (targets.some((target) => path.dirname(target) !== parent)) {
    throw new Error('Indicator group targets must share one directory');
  }

  const current = new Map<string, ExistingOutput>();
  for (const target of targets) current.set(target, await readOutput(target));
  const changed = targets.some((target) => current.get(target)?.content !== outputs.get(target));
  if (!changed) return { changed: false };

  await fs.mkdir(parent, { recursive: true });
  const staging = await fs.mkdtemp(path.join(parent, '.macrolens-price-stage-'));
  const backups = path.join(staging, 'backups');
  try {
    await fs.mkdir(backups);
    for (const target of targets) {
      await fs.writeFile(path.join(staging, path.basename(target)), outputs.get(target)!, 'utf8');
    }
    for (const target of targets) {
      const staged = path.join(staging, path.basename(target));
      if (await fs.readFile(staged, 'utf8') !== outputs.get(target)) {
        throw new Error(`Staged indicator output verification failed: ${target}`);
      }
    }

    for (const target of targets) {
      if (current.get(target)?.exists) {
        await fs.copyFile(target, path.join(backups, path.basename(target)));
      }
      await fs.rename(path.join(staging, path.basename(target)), target);
    }
    return { changed: true };
  } catch (error) {
    for (const target of targets) {
      const backup = path.join(backups, path.basename(target));
      if (current.get(target)?.exists) {
        await fs.copyFile(backup, target);
      } else {
        await fs.rm(target, { force: true });
      }
    }
    throw error;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
