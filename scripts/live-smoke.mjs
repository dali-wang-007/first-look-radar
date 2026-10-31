// Optional real-provider smoke test. Uses a public-domain NASA test portrait,
// creates a temporary account, and deletes it in finally. Never print secrets.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const artifact=name=>fileURLToPath(new URL('../artifacts/'+name,import.meta.url));
const origin=process.env.LIVE_URL||'https://first-look-radar.dali-wang-007.workers.dev';
const username='qa_'+Date.now().toString(36);const password=randomBytes(24).toString('hex');
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
try{
 await page.goto(origin,{waitUntil:'networkidle'});await page.screenshot({path:artifact('home-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'登录 / 注册'}).click();await page.getByRole('button',{name:'注册新账号'}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'创建账号'}).click();await page.locator('#authDialog').waitFor({state:'hidden'});
 await page.goto(origin+'/#test');await page.locator('#photo').setInputFiles('/tmp/first-look-radar-astronaut.png');await page.locator('#photoPreview').waitFor({state:'visible'});await page.locator('#consent').check();
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/analyze'),{timeout:85000});await page.getByRole('button',{name:'生成我的初见报告'}).click();const response=await responsePromise;console.log('Live analysis HTTP:',response.status());
 if(response.status()!==201){console.log('Service error:',(await response.json()).error);throw new Error('Live analysis did not succeed');}
 const record=await response.json();if(!record.id||record.id==='example')throw new Error('Missing real report');await page.locator('#reportView').waitFor({state:'visible'});console.log('Actual report:',record.report.title,'axes:',record.report.dimensions.length);
 await page.screenshot({path:artifact('live-report.png'),fullPage:true});
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'保存分享图'}).click();const download=await downloading;await download.saveAs(artifact('share-card.png'));
 await page.getByRole('button',{name:'我的记录'}).click();await page.getByRole('button',{name:'查看报告'}).waitFor();
 await page.getByRole('button',{name:'账号设置'}).click();await page.getByRole('button',{name:'退出登录'}).click();await page.getByRole('button',{name:'登录 / 注册'}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.locator('#authDialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'我的记录'}).click();await page.getByRole('button',{name:'查看报告'}).waitFor();console.log('Re-login preserved the private report.');
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.screenshot({path:artifact('home-mobile.png'),fullPage:true});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Mobile overflow');
 console.log('Live smoke passed: register, visual model, persisted report, export, logout/login, mobile.');
}finally{
 const deletion=await page.evaluate(async password=>{try{const r=await fetch('/api/account',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({password})});return r.status;}catch{return 'network failed';}},password).catch(()=>null);console.log('Temporary account cleanup:',deletion||'network failed');await browser.close();
}
