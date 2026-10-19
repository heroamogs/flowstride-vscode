import * as fs from 'node:fs';
import * as path from 'node:path';
export function locateRunner(file: string, workspace: string) {
  const inside=(base:string,value:string)=>{const rel=path.relative(base,value);return rel!=='..'&&!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel);};
  file=path.resolve(file);workspace=path.resolve(workspace);
  if (!file.endsWith('.flow') || !inside(workspace,file) || !inside(fs.realpathSync(workspace),fs.realpathSync(file))) throw new Error('Choose a .flow file inside its workspace.');
  const ancestors:string[]=[];
  for(let current=path.dirname(file);inside(workspace,current);current=path.dirname(current)) {ancestors.push(current);if(current===workspace)break;}
  const project=ancestors.find(dir=>fs.existsSync(path.join(dir,'flowstride.config.json'))) || ancestors.find(dir=>fs.existsSync(path.join(dir,'package.json'))) || workspace;
  for (const directory of ancestors) {
    for (const name of ['flowstride','@flowstride/pro']) {
      const folder=path.join(directory,'node_modules',name),metadata=path.join(folder,'package.json');
      if (!fs.existsSync(metadata)) continue;
      const data=JSON.parse(fs.readFileSync(metadata,'utf8'));
      if (data.name!==name) throw new Error('Installed Flowstride package identity is invalid.');
      const relative=typeof data.bin==='string'?data.bin:data.bin?.flowstride;
      if(typeof relative!=='string')throw new Error('Installed Flowstride CLI is missing.');
      const cli=path.resolve(folder,relative);
      if (!inside(fs.realpathSync(folder),fs.realpathSync(cli))) throw new Error('Flowstride CLI must remain inside its package.');
      return {cwd:project,cli,args:[cli,'run',file]};
    }
  }
  throw new Error('Install Flowstride in this project before running tests. The extension does not download packages automatically.');
}
