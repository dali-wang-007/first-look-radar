import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
await import('./build-pages.mjs');
const repository='https://github.com/dali-wang-007/first-look-radar.git';
const dir=await mkdtemp(join(tmpdir(),'first-look-pages-'));
function git(args,allowFailure=false){const result=spawnSync('git',args,{cwd:dir,encoding:'utf8'});if(result.status&&!allowFailure)throw new Error(result.stderr||'Git command failed');return result;}
try{
 git(['init','-b','gh-pages']);git(['remote','add','origin',repository]);
 const exists=git(['ls-remote','--exit-code','origin','refs/heads/gh-pages'],true);
 if(exists.status===0){git(['fetch','--depth','1','origin','gh-pages']);git(['reset','--hard','FETCH_HEAD']);}else if(exists.status!==2){throw new Error(exists.stderr||'Cannot inspect deployment branch');}
 await cp(fileURLToPath(new URL('../dist/',import.meta.url)),dir,{recursive:true});
 git(['add','.']);
 const diff=git(['diff','--cached','--quiet'],true);
 if(diff.status===1){git(['commit','-m','Deploy initial-look radar public demo']);git(['push','origin','gh-pages']);}
 else if(diff.status!==0)throw new Error('Cannot inspect static deployment changes');
 console.log('Pushed public demo to gh-pages (no workflow authorization needed).');
}finally{await rm(dir,{recursive:true,force:true});}
