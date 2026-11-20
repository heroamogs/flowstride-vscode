import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectPath } from './projectPath';

export function resolveHelperPath(root: string, flowFile: string, specifier: string, helpersDir = 'helpers'): string {
  if (path.win32.isAbsolute(specifier) || /[\\:\x00-\x1f]/.test(specifier) || !/\.(js|ts)$/.test(specifier)) {
    throw new Error('Import a project-local .js or .ts helper using a relative file path.');
  }
  const relativeToFlow = specifier.startsWith('./') || specifier.startsWith('../');
  const candidate = relativeToFlow
    ? path.resolve(path.dirname(projectPath(root, flowFile)), specifier)
    : projectPath(projectPath(root, helpersDir), specifier);
  const checked = projectPath(root, candidate);
  const file = fs.realpathSync(checked);
  if (!/\.(js|ts)$/.test(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Helper "${specifier}" must resolve to a .js or .ts file.`);
  }
  return file;
}
