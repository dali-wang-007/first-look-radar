import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../server/index.js';
import { report, jpeg } from './fixtures.js';

function dbBinding(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));
  const prepare=(sql)=>{let values=[];return {bind(...args){values=args;return this;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};};
  return {prepare,async batch(items){db.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
function setup(){
 const env={DB:dbBinding(),AI:{run:async()=>({response:JSON.stringify({canAnalyze:true,report:report()})})},DAILY_USER_LIMIT:'3',DAILY_SITE_LIMIT:'30'};
 const request=async(path,{method='GET',body,cookie,origin='https://radar.test'}={})=>worker.fetch(new Request('https://radar.test/api'+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),'cf-connecting-ip':'127.0.0.1'},...(body?{body:JSON.stringify(body)}:{})}),env);
 const register=async(username)=>{const res=await request('/auth/register',{method:'POST',body:{username,password:'Strong-password-123'}});assert.equal(res.status,201);return res.headers.get('set-cookie').split(';')[0];};
 return {env,request,register};
}
const input={image:jpeg,scene:'avatar',goal:'clear',consent:true};
test('register/login sets secure session; private routes reject missing or foreign origin',async()=>{
 const {request,register}=setup();const cookie=await register('alice');
 assert.equal((await request('/me',{cookie})).status,200);
 assert.equal((await request('/reports')).status,401);
 assert.equal((await request('/auth/login',{method:'POST',origin:'https://evil.test',body:{}})).status,403);
 assert.equal((await request('/auth/login',{method:'POST',body:{username:'alice',password:'wrong-password'}})).status,401);
 const login=await request('/auth/login',{method:'POST',body:{username:'alice',password:'Strong-password-123'}});
 assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);
});
test('real reports are persisted, isolated, and removable; images never stored',async()=>{
 const {request,register}=setup();const alice=await register('alice');const bob=await register('bob');
 const analyzed=await request('/analyze',{method:'POST',cookie:alice,body:input});assert.equal(analyzed.status,201);
 const {id}=await analyzed.json();const list=await(await request('/reports',{cookie:alice})).json();assert.equal(list.reports.length,1);
 assert.equal(JSON.stringify(list).includes('/9j/'),false);
 assert.equal((await request('/reports/'+id,{method:'DELETE',cookie:bob})).status,404);
 assert.equal((await(await request('/reports',{cookie:bob})).json()).reports.length,0);
 assert.equal((await request('/reports/'+id,{method:'DELETE',cookie:alice})).status,200);
 assert.equal((await(await request('/reports',{cookie:alice})).json()).reports.length,0);
});
test('quota survives concurrent analysis and AI failure releases the slot',async()=>{
 const {env,request,register}=setup();const cookie=await register('alice');env.DAILY_USER_LIMIT='1';
 env.AI.run=async()=>{throw new Error('private-provider-detail');};
 const failed=await request('/analyze',{method:'POST',cookie,body:input});assert.equal(failed.status,502);assert.equal((await failed.text()).includes('private-provider-detail'),false);
 env.AI.run=async()=>({response:JSON.stringify({canAnalyze:true,report:report()})});
 const results=await Promise.all([request('/analyze',{method:'POST',cookie,body:input}),request('/analyze',{method:'POST',cookie,body:input})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,429]);
});
test('password changes invalidate old sessions and deleting account removes access',async()=>{
 const {request,register}=setup();const cookie=await register('alice');
 const changed=await request('/auth/password',{method:'POST',cookie,body:{currentPassword:'Strong-password-123',password:'New-strong-password-456'}});assert.equal(changed.status,200);
 assert.equal((await request('/me',{cookie})).status,401);
 const newCookie=changed.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/account',{method:'DELETE',cookie:newCookie,body:{password:'New-strong-password-456'}})).status,200);
 assert.equal((await request('/me',{cookie:newCookie})).status,401);
});
test('bad images are rejected before AI, and invalid model content is not persisted',async()=>{
 const {env,request,register}=setup();const cookie=await register('alice');
 assert.equal((await request('/analyze',{method:'POST',cookie,body:{...input,image:'javascript:alert(1)'}})).status,400);
 const bad=report();bad.summary='你很聪明，智商非常高。';env.AI.run=async()=>({response:JSON.stringify({canAnalyze:true,report:bad})});
 assert.equal((await request('/analyze',{method:'POST',cookie,body:input})).status,502);
 assert.equal((await(await request('/reports',{cookie})).json()).reports.length,0);
});
