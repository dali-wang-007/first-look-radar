import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const directory=new URL('../dist/',import.meta.url);await mkdir(directory,{recursive:true});
const live='https://first-look-radar.dali-wang-007.workers.dev';
let html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
html=html.replace('<title>','<meta name="demo-only" content="true"><meta name="live-url" content="'+live+'"><title>');
await writeFile(new URL('index.html',directory),html);
for(const file of ['style.css','app.js','report.js','demo.js','mark.svg'])await copyFile(new URL('../public/'+file,import.meta.url),new URL(file,directory));
await writeFile(new URL('.nojekyll',directory),'');
console.log('Built GitHub Pages public demo; real analysis and accounts use '+live);
