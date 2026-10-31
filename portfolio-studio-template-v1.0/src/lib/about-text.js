// 每个文本框的内容共用，电脑 / 手机各自保存位置、尺寸与字号。
export const ABOUT_TEXT_REFERENCE={desktop:1120,mobile:480};
// 保留手机端的排序和预留位置，换行变高时只把后续框向下推。
export function flowAboutText(boxes,portraitBottom,gap=24){
  let bottom=portraitBottom;
  return boxes.map((box,index)=>({...box,index})).sort((a,b)=>a.y-b.y||a.index-b.index).map(box=>{
    const y=Math.max(box.y,bottom+gap);bottom=y+box.height;return {...box,y};
  });
}
export function validateAboutTextBlocks(blocks){
  if(!Array.isArray(blocks)||blocks.length>40)throw new Error('最多添加 40 个文本框');
  const ids=new Set();let total=0;
  return blocks.map(block=>{
    if(!block||typeof block.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(block.id)||ids.has(block.id)||typeof block.text!=='string')throw new Error('文本框格式有误');
    ids.add(block.id);total+=block.text.length;if(total>16000)throw new Error('全部文本最多 16000 字');
    const next={id:block.id,text:block.text,fontWeight:block.fontWeight??400,lineHeight:block.lineHeight??1.6,href:block.href??''};
    if(![400,500,600,700].includes(next.fontWeight)||!Number.isFinite(next.lineHeight)||next.lineHeight<1||next.lineHeight>3)throw new Error('文本样式超出范围');
    if(typeof next.href!=='string'||next.href.length>2000||(next.href&&!/^(https?:\/\/|mailto:)/i.test(next.href)))throw new Error('链接需以 https://、http:// 或 mailto: 开头');
    for(const profile of ['desktop','mobile']){
      const box=block[profile];next[profile]={};
      for(const [key,min,max] of [['x',-3000,3000],['y',-3000,6000],['width',60,1600],['height',24,2400],['fontSize',10,120]]){
        if(!box||!Number.isFinite(box[key])||box[key]<min||box[key]>max)throw new Error('文本框位置、大小或字号超出范围');
        next[profile][key]=Math.round(box[key]*100)/100;
      }
    }
    return next;
  });
}
export function getAboutTextBlocks(layout,fallback){
  if(layout.textBlocks!==undefined)return validateAboutTextBlocks(layout.textBlocks);
  const content=layout.content??fallback,font=layout.fontSize??16,width=layout.copyWidth??480;
  const rows=[{id:'text-1',text:content.title,font:42,mobileFont:34,line:1.15,weight:700,gap:40},
    {id:'text-2',text:content.subtitle??'',font:22,line:1.4,weight:600,gap:20},
    {id:'text-3',text:content.paragraphs.join('\n\n'),font,line:1.8,weight:400,gap:54},
    {id:'text-4',text:'hello@example.com ↗',font:16,line:1.6,weight:600,gap:0,href:'mailto:hello@example.com'}];
  const positions=layout.positions;
  const estimate=(text,width,font,line)=>Math.min(2400,Math.max(24,text.split('\n').reduce((sum,row)=>sum+Math.max(1,Math.ceil(row.length/Math.max(6,width/(font*.65)))),0)*font*line));
  let desktopY=(positions?.desktop.copy.y??0)+55,mobileY=(layout.height??550)+34+(positions?.mobile.copy.y??0);
  return rows.filter(row=>row.text).map(row=>{
    const height=estimate(row.text,width,row.font,row.line);
    const desktop={x:(layout.width??480)+80+(positions?.desktop.copy.x??0),y:desktopY,width,height:Math.max(24,height),fontSize:row.font};
    const mobileHeight=estimate(row.text,440,row.mobileFont??row.font,row.line);
    const mobile={x:positions?.mobile.copy.x??0,y:mobileY,width:440,height:Math.max(32,mobileHeight),fontSize:row.mobileFont??row.font};
    desktopY+=desktop.height+row.gap;mobileY+=mobile.height+row.gap;
    return {id:row.id,text:row.text,fontWeight:row.weight,lineHeight:row.line,href:row.href??'',desktop,mobile};
  });
}
export function aboutTextStyle(block){
  const parts=[`--text-weight:${block.fontWeight}`,`--text-line:${block.lineHeight}`];
  for(const profile of ['desktop','mobile'])for(const [key,value] of Object.entries(block[profile]))parts.push(`--text-${profile}-${key}:${key==='fontSize'?value+'px':value/ABOUT_TEXT_REFERENCE[profile]*100+'cqw'}`);
  return parts.join(';');
}
export function aboutTextPageStyle(blocks){
  return ['desktop','mobile'].map(profile=>`--about-text-${profile}-bottom:${Math.max(0,...blocks.map(block=>block[profile].y+block[profile].height))/ABOUT_TEXT_REFERENCE[profile]*100}cqw`).join(';');
}
