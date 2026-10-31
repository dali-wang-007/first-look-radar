import { DEMO } from './demo.js';
import { element, renderReport, exportCard, SCENES } from './report.js';

const $=id=>document.getElementById(id);
const demoOnly=Boolean(document.querySelector('meta[name="demo-only"]'));
const liveURL=document.querySelector('meta[name="live-url"]')?.content;
const state={user:null,photo:null,photoVersion:0,current:null,demo:false,authMode:'login',afterLogin:null,analyzing:false,accountVersion:0};
const privateRequests=new Set();
function changeSession(user){state.accountVersion++;for(const controller of privateRequests)controller.abort();privateRequests.clear();state.user=user;state.current=null;state.demo=false;state.analyzing=false;$('analyzeButton').disabled=false;$('progress').hidden=true;$('historyList').replaceChildren();$('reportContent').replaceChildren();}
let toastTimer;
function toast(message){$('toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',6500);}
async function api(path,options={}){
 const controller=new AbortController();const version=state.accountVersion;const privateRequest=!['/auth/login','/auth/register','/health'].includes(path);if(privateRequest)privateRequests.add(controller);const timeout=setTimeout(()=>controller.abort(),80000);
 try{const response=await fetch('./api'+path,{...options,credentials:'same-origin',signal:controller.signal,headers:{'content-type':'application/json',...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});let data;try{data=await response.json();}catch{throw new Error('服务返回了意外内容，请稍后重试。');}if(privateRequest&&version!==state.accountVersion)throw new Error('stale');if(!response.ok){const e=new Error(data.error||'操作未完成，请稍后重试。');e.status=response.status;throw e;}return data;}catch(e){if(privateRequest&&version!==state.accountVersion){const stale=new Error('账号会话已改变。');stale.stale=true;throw stale;}if(e.name==='AbortError')throw new Error('分析等待时间较长，暂未取得结果。请先查看“我的记录”，避免重复提交。');throw e;}finally{clearTimeout(timeout);privateRequests.delete(controller);}
}
function go(route){if(location.hash==='#'+route)renderRoute();else location.hash=route;}
function syncUser(){
 $('authNav').hidden=Boolean(state.user)||demoOnly;$('accountNav').hidden=!state.user||demoOnly;
 $('historyNav').hidden=demoOnly;
 $('accountName').textContent=state.user?'当前账号：'+state.user.username:'';
 if(demoOnly){$('demoNotice').hidden=false;$('analysisForm').hidden=true;if(liveURL){$('liveLink').href=liveURL;}else{$('liveLink').hidden=true;}}
}
async function refreshUser(){if(demoOnly)return;try{const data=await api('/me');if(state.user?.id!==data.user.id)changeSession(data.user);else state.user=data.user;$('quotaText').textContent=`今日剩余 ${data.remaining} / ${data.dailyLimit} 次 · 首版免费 · 每天 UTC 0点重置`;}catch(e){if(e.stale)return;if(e.status!==401)toast(e.message);if(state.user)changeSession(null);}syncUser();}
function openAuth(afterLogin=null){if(demoOnly){if(liveURL)location.href=liveURL;return;}state.afterLogin=afterLogin;state.authMode='login';syncAuth();if(!$('authDialog').open)$('authDialog').showModal();}
function syncAuth(){const register=state.authMode==='register';$('authTitle').textContent=register?'初见，很高兴遇见你。':'欢迎回来。';$('authIntro').textContent=register?'创建账号，留住属于你的文字报告。':'登录后，收藏每一次初见。';$('authSubmit').textContent=register?'创建账号':'登录';$('toggleAuth').textContent=register?'已有账号，去登录':'注册新账号';$('password').autocomplete=register?'new-password':'current-password';$('registerNote').hidden=!register;$('authError').hidden=true;}
function showView(name){for(const view of document.querySelectorAll('.view'))view.hidden=view.id!==name+'View';}
async function renderRoute(){
 const route=location.hash.slice(1)||'home';
 if(!['home','test','report','history','privacy','account'].includes(route)){go('home');return;}
 if((route==='history'||route==='account')&&!state.user){go('home');if(!demoOnly)openAuth(()=>go(route));return;}
 if(route==='report'&&!state.current){if(state.user){go('history');}else{go('home');}return;}
 showView(route);window.scrollTo(0,0);
 if(route==='report')renderReport($('reportContent'),state.current,{demo:state.demo,onRestart:()=>go('test'),onExport:()=>exportCard(state.current,state.demo).catch(e=>toast(e.message))});
 if(route==='history')await loadHistory();
}
function sample(){state.current=DEMO;state.demo=true;go('report');}
$('sampleButton').onclick=sample;
$('authNav').onclick=()=>openAuth();
$('historyNav').onclick=()=>state.user?go('history'):openAuth(()=>go('history'));
$('accountNav').onclick=()=>go('account');
$('closeAuth').onclick=()=>$('authDialog').close();
$('toggleAuth').onclick=()=>{state.authMode=state.authMode==='login'?'register':'login';syncAuth();};
$('authForm').onsubmit=async event=>{
 event.preventDefault();$('authSubmit').disabled=true;$('authError').hidden=true;
 try{const data=await api('/auth/'+state.authMode,{method:'POST',body:{username:$('username').value,password:$('password').value}});changeSession(data.user);$('password').value='';$('authDialog').close();syncUser();await refreshUser();const after=state.afterLogin;state.afterLogin=null;if(after)after();toast('已登录，欢迎来到初见雷达。');}catch(e){$('authError').textContent=e.message;$('authError').hidden=false;}finally{$('authSubmit').disabled=false;}
};
function resetPhoto(){state.photoVersion++;state.photo=null;$('photo').value='';$('photoPreview').removeAttribute('src');$('photoPreview').hidden=true;$('uploadPlaceholder').hidden=false;$('changePhoto').hidden=true;$('removePhoto').hidden=true;}
async function choosePhoto(file){
 const version=++state.photoVersion;if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('请上传 JPEG、PNG 或 WebP 照片。');return;}
 if(file.size>10*1024*1024){toast('照片不能超过10 MB，请选择小一些的文件。');return;}
 let bitmap;
 try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40_000_000)throw new Error('照片像素过大，请先缩小后上传。');const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);let image=canvas.toDataURL('image/jpeg',.85);if(image.length>1_900_000)image=canvas.toDataURL('image/jpeg',.6);if(image.length>1_900_000)throw new Error('压缩后的照片仍然过大，请换一张。');if(version!==state.photoVersion)return;state.photo=image;$('photoPreview').src=image;$('photoPreview').hidden=false;$('uploadPlaceholder').hidden=true;$('changePhoto').hidden=false;$('removePhoto').hidden=false;$('analysisError').hidden=true;}catch(e){toast(e.message?.includes('照片')?e.message:'无法读取这张照片，请选择有效的JPEG、PNG或WebP文件。');}finally{bitmap?.close();}
}
$('photo').onchange=e=>choosePhoto(e.target.files[0]);
$('removePhoto').onclick=resetPhoto;
for(const eventName of ['dragenter','dragover'])$('dropZone').addEventListener(eventName,e=>{e.preventDefault();$('dropZone').classList.add('dragover');});
for(const eventName of ['dragleave','drop'])$('dropZone').addEventListener(eventName,e=>{e.preventDefault();$('dropZone').classList.remove('dragover');if(eventName==='drop')choosePhoto(e.dataTransfer.files[0]);});
$('analysisForm').onsubmit=async event=>{
 event.preventDefault();if(state.analyzing)return;if(!state.photo){toast('先选一张照片，再开始发现。');return;}if(!$('consent').checked){toast('请先勾选照片使用与AI处理说明。');return;}if(!state.user){openAuth(()=>toast('已登录，点击“生成我的初见报告”即可开始。'));return;}
 const data=new FormData(event.currentTarget);const version=state.accountVersion;state.analyzing=true;$('analyzeButton').disabled=true;$('progress').hidden=false;$('analysisError').hidden=true;
 const titles=['正在观察照片里的细节','正在整理视觉风格与依据','正在为你的使用场景准备建议'];let step=0;const ticker=setInterval(()=>$('progressTitle').textContent=titles[Math.min(++step,2)],8000);
 try{const record=await api('/analyze',{method:'POST',body:{image:state.photo,scene:data.get('scene'),goal:data.get('goal'),consent:true}});if(version!==state.accountVersion)return;state.current=record;state.demo=false;go('report');await refreshUser();}catch(e){if(e.stale)return;$('analysisError').textContent=e.message;$('analysisError').hidden=false;if(e.status===401){changeSession(null);syncUser();openAuth();}}finally{clearInterval(ticker);if(version===state.accountVersion){state.analyzing=false;$('analyzeButton').disabled=false;$('progress').hidden=true;$('progressTitle').textContent=titles[0];}}
};
async function loadHistory(){
 const list=$('historyList');const version=state.accountVersion;list.replaceChildren(element('p','muted','正在取回你的文字报告…'));
 try{const {reports}=await api('/reports');if(version!==state.accountVersion||location.hash!=='#history')return;list.replaceChildren();if(!reports.length){const empty=element('div','empty-state');empty.append(element('span','','✧'),element('h2','','还没有测评记录'),element('p','','从一张照片开始，发现属于它的视觉风格。'));const button=element('a','button primary','开始第一次测评 ↗');button.href='#test';empty.append(button);list.append(empty);return;}
 for(const record of reports){const card=element('article','history-card');const info=element('div','history-info');info.append(element('h2','',record.report.title),element('p','',SCENES[record.scene]+' · '+new Date(record.created_at).toLocaleString('zh-CN')));const actions=element('div','history-actions');const view=element('button','button secondary','查看报告');view.onclick=()=>{state.current=record;state.demo=false;go('report');};const remove=element('button','link-button','删除');remove.onclick=async()=>{if(remove.dataset.confirm!=='yes'){remove.dataset.confirm='yes';remove.textContent='确认删除？';return;}remove.disabled=true;try{await api('/reports/'+record.id,{method:'DELETE'});if(state.current?.id===record.id)state.current=null;card.remove();toast('报告已删除。');if(!list.children.length)await loadHistory();}catch(e){toast(e.message);remove.disabled=false;}};actions.append(view,remove);card.append(element('span','history-icon','✧'),info,actions);list.append(card);}
 }catch(e){if(e.stale)return;list.replaceChildren(element('p','error',e.message));if(e.status===401){changeSession(null);syncUser();openAuth(()=>go('history'));}}
}
$('logoutButton').onclick=async()=>{try{await api('/auth/logout',{method:'POST'});changeSession(null);resetPhoto();syncUser();go('home');toast('已退出登录。');}catch(e){if(!e.stale)toast(e.message);}};
$('passwordForm').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const data=Object.fromEntries(new FormData(e.currentTarget));await api('/auth/password',{method:'POST',body:data});e.target.reset();toast('密码已更新，其他登录会话已退出。');}catch(error){toast(error.message);}finally{button.disabled=false;}};
$('deleteAccountForm').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const data=Object.fromEntries(new FormData(e.currentTarget));await api('/account',{method:'DELETE',body:data});changeSession(null);resetPhoto();e.target.reset();syncUser();go('home');toast('账号和全部文字报告已删除。');}catch(error){if(!error.stale)toast(error.message);}finally{button.disabled=false;}};
window.addEventListener('hashchange',renderRoute);
await refreshUser();syncUser();await renderRoute();
