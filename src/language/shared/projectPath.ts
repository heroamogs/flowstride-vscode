import * as fs from 'node:fs';
import * as path from 'node:path';

export function projectPath(root: string, target: string): string {
  root = path.resolve(root); target = path.resolve(root, target);
  const inside = (base: string, value: string) => {
    const relative = path.relative(base, value);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!inside(root, target)) throw new Error(`Path must remain inside the project: ${target}`);
  const realRoot = fs.realpathSync(root);
  let parent = target; const suffix: string[] = [];
  while (true) {
    try { fs.lstatSync(parent); break; }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; suffix.unshift(path.basename(parent)); const next = path.dirname(parent); if (next === parent) throw error; parent = next; }
  }
  const real = path.join(fs.realpathSync(parent), ...suffix);
  if (!inside(realRoot, real)) throw new Error(`Symlink escapes the project: ${target}`);
  return target;
}
