export const SCENES={avatar:'工作头像',client:'客户见面',social:'日常社交'};
export function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
const svgEl=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const polar=(i,r,cx=210,cy=185)=>[cx+Math.sin(i*2*Math.PI/5)*r,cy-Math.cos(i*2*Math.PI/5)*r];
function polygon(levels,r){return levels.map((v,i)=>polar(i,r*v/5).join(',')).join(' ');}
export function radar(dimensions){
 const svg=svgEl('svg',{viewBox:'0 0 420 365',role:'img','aria-label':'五维视觉风格雷达图，刻度1至5，强弱不代表好坏'});svg.classList.add('radar-svg');
 for(let ring=1;ring<=5;ring++)svg.append(svgEl('polygon',{points:polygon(Array(5).fill(ring),112),fill:'none',stroke:'#d8c4bf','stroke-width':1}));
 for(let i=0;i<5;i++){const [x,y]=polar(i,112);svg.append(svgEl('line',{x1:210,y1:185,x2:x,y2:y,stroke:'#d8c4bf'}));const [tx,ty]=polar(i,151);const t=svgEl('text',{x:tx,y:ty,'text-anchor':'middle','dominant-baseline':'middle'});t.textContent=dimensions[i].name;svg.append(t);}
 svg.append(svgEl('polygon',{points:polygon(dimensions.map(d=>d.level),112),fill:'#a15c7030',stroke:'#834556','stroke-width':2}));
 dimensions.forEach((d,i)=>{const [cx,cy]=polar(i,112*d.level/5);svg.append(svgEl('circle',{cx,cy,r:3.5,fill:'#834556'}));});return svg;
}
export function renderReport(container,record,{demo=false,onExport,onRestart}={}){
 const r=record.report;container.replaceChildren();
 const toolbar=element('div','report-toolbar');toolbar.append(element('span','badge',demo?'示例报告 · 非真实测评':'你的照片视觉印象报告'));
 const actions=element('div');const back=element('button','button secondary','重新测评 ↗');back.onclick=onRestart;const save=element('button','button primary','保存分享图');save.onclick=onExport;actions.append(back,save);toolbar.append(actions);container.append(toolbar);
 const intro=element('div','report-intro');intro.append(element('p','eyebrow','A LITTLE DISCOVERY, ALL ABOUT THIS PHOTO'),element('h1','',r.title),element('p','',r.summary),element('p','report-meta',`${SCENES[record.scene]} · ${demo?'精心编写的产品示例':new Date(record.created_at).toLocaleDateString('zh-CN')} · AI视觉风格趣味解读`));container.append(intro);
 const main=element('div','report-main');const chart=element('div','radar-panel');chart.append(radar(r.dimensions),element('p','radar-disclaimer','1 不突出 → 5 突出 · 仅表示画面特征强弱'),element('p','radar-disclaimer','不计算颜值总分，没有优劣排名'));
 const evidence=element('div','axis-evidence');r.dimensions.forEach(d=>{const item=element('div','axis-item');const top=element('div','axis-top');top.append(element('strong','',d.name),element('span','axis-level','●'.repeat(d.level)+'○'.repeat(5-d.level)));item.append(top,element('p','',d.evidence));evidence.append(item);});main.append(chart,evidence);container.append(main);
 container.append(element('h2','report-block-title','三处细节，值得被看见。'));const highlights=element('div','highlight-grid');r.highlights.forEach((h,i)=>{const card=element('article','highlight-card');card.append(element('span','eyebrow',`0${i+1} / YOUR HIGHLIGHT`),element('h3','',h.title),element('p','',h.observation),element('p','',h.effect));highlights.append(card);});container.append(highlights);
 container.append(element('h2','report-block-title','试试这两件小事。'));const suggestions=element('div','suggestions');r.suggestions.forEach((s,i)=>{const card=element('article','suggestion-card');card.append(element('h3','',`0${i+1} · ${s.action}`),element('p','',s.reason));suggestions.append(card);});container.append(suggestions);
 container.append(element('p','report-bottom-note',`${demo?'这是一份预先编写的示例，没有分析你的照片。':''}报告仅解读这张照片的可见视觉呈现，可能有偏差，不代表真实性格、能力、心理状态或陌生人的真实反应。分享图在本地生成，不包含原照片。`));
}
function wrap(ctx,text,x,y,maxWidth,lineHeight,maxLines=8){let line='';let lines=0;for(const character of text){if(ctx.measureText(line+character).width>maxWidth&&line){ctx.fillText(line,x,y);y+=lineHeight;line='';lines++;if(lines>=maxLines)return y; }line+=character;}if(line){ctx.fillText(line,x,y);y+=lineHeight;}return y;}
export async function exportCard(record,demo=false){
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const ctx=canvas.getContext('2d');const r=record.report;
 ctx.fillStyle='#faf6ee';ctx.fillRect(0,0,1080,1440);ctx.strokeStyle='#dfcfc5';ctx.strokeRect(36,36,1008,1368);
 ctx.fillStyle='#783d49';ctx.font='28px sans-serif';ctx.fillText('初见雷达  /  FIRST LOOK RADAR',75,100);
 ctx.fillStyle='#93817a';ctx.font='20px sans-serif';ctx.fillText(demo?'示例报告 · 非真实测评':'这张照片的视觉风格',75,160);
 ctx.fillStyle='#783d49';ctx.font='52px "Songti SC",serif';let y=wrap(ctx,r.title,75,245,920,70,2);
 ctx.fillStyle='#70615d';ctx.font='25px sans-serif';wrap(ctx,r.shareText,75,y+25,920,43,3);
 const cx=540,cy=665,rad=205;
 function path(values){ctx.beginPath();values.forEach((v,i)=>{const a=i*2*Math.PI/5;const x=cx+Math.sin(a)*rad*v/5,yy=cy-Math.cos(a)*rad*v/5;i?ctx.lineTo(x,yy):ctx.moveTo(x,yy);});ctx.closePath();}
 for(let i=1;i<=5;i++){path(Array(5).fill(i));ctx.strokeStyle='#dac6bd';ctx.lineWidth=1.5;ctx.stroke();}
 r.dimensions.forEach((d,i)=>{const a=i*2*Math.PI/5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(a)*rad,cy-Math.cos(a)*rad);ctx.stroke();ctx.fillStyle='#69534f';ctx.font='25px sans-serif';ctx.textAlign='center';ctx.fillText(d.name,cx+Math.sin(a)*(rad+63),cy-Math.cos(a)*(rad+63)+10);});
 path(r.dimensions.map(d=>d.level));ctx.fillStyle='#a15c7033';ctx.fill();ctx.strokeStyle='#834556';ctx.lineWidth=4;ctx.stroke();ctx.textAlign='left';
 ctx.fillStyle='#897570';ctx.font='21px sans-serif';ctx.textAlign='center';ctx.fillText('1 不突出 → 5 突出  ·  画面风格强弱，无优劣排名',540,970);ctx.textAlign='left';
 ctx.fillStyle='#783d49';ctx.font='25px sans-serif';ctx.fillText('值得被看见的细节',75,1040);
 ctx.fillStyle='#635651';ctx.font='24px sans-serif';y=1095;for(const h of r.highlights){y=wrap(ctx,'✧ '+h.title+'：'+h.observation,75,y,920,37,2)+12;}
 ctx.strokeStyle='#dfcfc5';ctx.beginPath();ctx.moveTo(75,1290);ctx.lineTo(1005,1290);ctx.stroke();ctx.fillStyle='#918079';ctx.font='18px sans-serif';ctx.fillText('照片视觉印象的趣味解读，不测量真实人格或他人反应。',75,1330);ctx.fillText(demo?'产品示例 · 试试从一个新角度看自己':'让你的好，被看见。',75,1365);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('分享图生成失败，请重试。');const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download=`初见雷达${demo?'-示例':''}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
