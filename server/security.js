export class AppError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export function validateCredentials(body){
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  if(!/^[a-z0-9_]{3,24}$/.test(username))throw new AppError(400,'用户名需为3～24位字母、数字或下划线。');
  if(typeof body.password!=='string'||body.password.length<10||body.password.length>128)throw new AppError(400,'密码需为10～128位，请使用不与其他网站重复的密码。');
  return {username,password:body.password};
}
async function derive(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function hashPassword(password){const salt=randomToken();return salt+':'+await derive(password,salt);}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>128||!stored)return false;
 const [salt,expected]=stored.split(':');const actual=await derive(password,salt);
 if(!expected||actual.length!==expected.length)return false;
 let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return difference===0;
}
export function sessionCookie(token,clear=false){return `__Host-radar_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear?0:604800}`;}
export async function readBody(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AppError(415,'请使用JSON格式提交。');
 if(Number(request.headers.get('content-length'))>2_000_000)throw new AppError(413,'图片过大，请重新选择或压缩。');
 const reader=request.body?.getReader();if(!reader)throw new AppError(400,'提交内容为空。');
 let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();throw new AppError(413,'图片过大，请重新选择或压缩。');}chunks.push(value);}
 const combined=new Uint8Array(size);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}
 try {const parsed=JSON.parse(new TextDecoder().decode(combined));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw 0;return parsed;}catch{throw new AppError(400,'提交内容无效，请刷新重试。');}
}
