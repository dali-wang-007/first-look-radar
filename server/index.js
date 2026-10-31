import { AppError, randomToken, digest, validateCredentials, hashPassword, verifyPassword, sessionCookie, readBody } from './security.js';
import { validateInput, readModelResult, modelInput } from './analysis.js';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const now=()=>Math.floor(Date.now()/1000);
const limit=(value,fallback)=>{const n=Number(value);return Number.isInteger(n)&&n>0&&n<=1000?n:fallback;};
async function counter(env,key,max,ttl){
 const result=await env.DB.prepare('INSERT INTO counters(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ?').bind(key,ttl,max).run();return result.meta.changes===1;
}
async function rate(env,request,type,max,seconds){
 const period=Math.floor(now()/seconds);const ip=request.headers.get('cf-connecting-ip')||'local';const key=`rate:${type}:${period}:${await digest(ip+':'+period)}`;
 if(!await counter(env,key,max,(period+1)*seconds))throw new AppError(429,'操作频繁，请稍后再试。');
}
async function userFor(request,env){
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-radar_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)throw new AppError(401,'请先登录，再查看或生成你的报告。');
 const user=await env.DB.prepare('SELECT u.id,u.username,u.password_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),now()).first();
 if(!user)throw new AppError(401,'登录已失效，请重新登录。');return user;
}
async function createSession(env,user){
 const token=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,now()+604800).run();
 return sessionCookie(token);
}
function publicUser(user){return {id:user.id,username:user.username};}
async function cleanExpired(env){await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now()),env.DB.prepare('DELETE FROM counters WHERE expires_at<?').bind(now()-86400)]);}
async function api(request,env){
 const path=new URL(request.url).pathname.slice(4);const method=request.method;
 if(method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'请求来源无效，请从本站重新操作。');
 if(path==='/health'&&method==='GET')return json({status:env.DB&&env.AI?'ready':'unconfigured',analysisProvider:'Cloudflare Workers AI',model:'llama-4-scout-17b-16e-instruct'});
 if(!env.DB)throw new AppError(503,'账号服务尚未配置，请稍后再试。');
 if((path==='/auth/register'||path==='/auth/login')&&method==='POST'){
   await rate(env,request,path, path.endsWith('register')?5:15,900);
   const credentials=validateCredentials(await readBody(request));
   let user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(credentials.username).first();
   if(path.endsWith('register')){
     if(user)throw new AppError(409,'这个用户名已被使用，请换一个。');
     user={id:crypto.randomUUID(),username:credentials.username};
     try{await env.DB.prepare('INSERT INTO users(id,username,password_hash,created_at) VALUES(?,?,?,?)').bind(user.id,user.username,await hashPassword(credentials.password),new Date().toISOString()).run();}catch(e){if(String(e).includes('UNIQUE'))throw new AppError(409,'这个用户名已被使用，请换一个。');throw e;}
   }else{
     // Do the same expensive operation for absent users to avoid a timing shortcut.
     const stored=user?.password_hash??('0'.repeat(64)+':'+'0'.repeat(64));
     if(!await verifyPassword(credentials.password,stored)||!user)throw new AppError(401,'用户名或密码不正确。');
   }
   await cleanExpired(env);
   return json({user:publicUser(user)},path.endsWith('register')?201:200,{'set-cookie':await createSession(env,user)});
 }
 const user=await userFor(request,env);
 if(path==='/me'&&method==='GET'){
   const key=`user:${user.id}:${new Date().toISOString().slice(0,10)}`;
   const count=await env.DB.prepare('SELECT count FROM counters WHERE key=?').bind(key).first();
   return json({user:publicUser(user),remaining:Math.max(0,limit(env.DAILY_USER_LIMIT,3)-(count?.count||0)),dailyLimit:limit(env.DAILY_USER_LIMIT,3)});
 }
 if(path==='/auth/logout'&&method==='POST'){
   const token=request.headers.get('cookie').match(/__Host-radar_session=([a-f0-9]{64})/)[1];await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'set-cookie':sessionCookie('',true)});
 }
 if(path==='/auth/password'&&method==='POST'){
   await rate(env,request,'password',8,900);const body=await readBody(request);
   validateCredentials({username:user.username,password:body.password});
   if(!await verifyPassword(body.currentPassword,user.password_hash))throw new AppError(401,'当前密码不正确。');
   await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(body.password),user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
   return json({ok:true},200,{'set-cookie':await createSession(env,user)});
 }
 if(path==='/account'&&method==='DELETE'){
   await rate(env,request,'delete',8,900);const body=await readBody(request);if(!await verifyPassword(body.password,user.password_hash))throw new AppError(401,'密码不正确。');
   await env.DB.batch([env.DB.prepare('DELETE FROM reports WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM counters WHERE key LIKE ?').bind(`user:${user.id}:%`),env.DB.prepare('DELETE FROM users WHERE id=?').bind(user.id)]);
   return json({ok:true},200,{'set-cookie':sessionCookie('',true)});
 }
 if(path==='/reports'&&method==='GET'){
   const {results}=await env.DB.prepare('SELECT id,scene,goal,report_json,created_at FROM reports WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();return json({reports:results.map(({report_json,...row})=>({...row,report:JSON.parse(report_json)}))});
 }
 if(/^\/reports\/[a-f0-9-]{36}$/.test(path)&&method==='DELETE'){
   const result=await env.DB.prepare('DELETE FROM reports WHERE id=? AND user_id=?').bind(path.slice(9),user.id).run();if(!result.meta.changes)throw new AppError(404,'记录不存在或已被删除。');return json({ok:true});
 }
 if(path==='/analyze'&&method==='POST'){
   if(!env.AI)throw new AppError(503,'视觉分析服务尚未配置。');
   await rate(env,request,'analyze',12,900);const input=validateInput(await readBody(request));
   const day=new Date().toISOString().slice(0,10);const expires=now()+172800;
   const userKey=`user:${user.id}:${day}`;
   if(!await counter(env,userKey,limit(env.DAILY_USER_LIMIT,3),expires))throw new AppError(429,'今天的测评额度已用完，明天再来发现新的呈现方式。');
   let saved=false;
   try{
     if(!await counter(env,`site:${day}`,limit(env.DAILY_SITE_LIMIT,30),expires))throw new AppError(429,'本站今日体验额度已用完，请明天再来。');
     let output;let timer;
     try{output=await Promise.race([env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',modelInput(input)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),65000);})]);}finally{clearTimeout(timer);}
     const report=readModelResult(output);const id=crypto.randomUUID();const created_at=new Date().toISOString();
     await env.DB.prepare('INSERT INTO reports(id,user_id,scene,goal,report_json,created_at) VALUES(?,?,?,?,?,?)').bind(id,user.id,input.scene,input.goal,JSON.stringify(report),created_at).run();saved=true;
     return json({id,scene:input.scene,goal:input.goal,report,created_at},201);
   }catch(e){if(e instanceof AppError)throw e;throw new AppError(502,'这次视觉分析未能完成，未扣除你的测评额度。请稍后重试或换一张更清晰的照片。');}
   finally{if(!saved)await env.DB.prepare('UPDATE counters SET count=MAX(0,count-1) WHERE key=?').bind(userKey).run();}
 }
 throw new AppError(404,'页面或接口不存在。');
}
export default {async fetch(request,env){
 try{
   if(new URL(request.url).pathname.startsWith('/api/'))return await api(request,env);
   return env.ASSETS?await env.ASSETS.fetch(request):new Response('Not found',{status:404});
 }catch(e){return json({error:e instanceof AppError?e.message:'服务暂时不可用，请稍后重试。'},e instanceof AppError?e.status:500);}
}};
