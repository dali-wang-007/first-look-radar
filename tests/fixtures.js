export const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
export function report() {
  return {
    title: '清爽利落，自然有光', summary: '简洁的领口和干净背景，让画面重点集中在面部。自然光带来柔和的明暗，整体呈现清爽、轻盈的视觉风格。',
    dimensions: ['明快感','柔和感','利落感','正式感','松弛感'].map((name,i)=>({name,level:[4,3,4,3,4][i],evidence:['画面明亮，背景干净。','面部光线柔和，明暗过渡自然。','领口线条简洁，构图集中。','素色衣领与整洁背景形成简约效果。','姿态自然，画面留白充足。'][i]})),
    highlights: [{title:'干净的画面',observation:'背景颜色简单。',effect:'面部更容易成为视觉重点。'},{title:'柔和的光线',observation:'面部亮度均匀。',effect:'整体画面显得轻盈自然。'},{title:'简洁的造型',observation:'领口线条清晰。',effect:'画面的利落感更突出。'}],
    suggestions:[{action:'尝试正对窗边的自然光拍摄。',reason:'让面部亮度更均匀，保留画面的清爽感。'},{action:'裁切到肩部以上，减少背景面积。',reason:'作为工作头像时，让头像在小尺寸下更清晰。'}],
    shareText:'这张照片的初见风格：清爽利落，自然有光。'
  };
}
