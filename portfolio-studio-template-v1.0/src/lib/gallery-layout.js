export function validateGalleryLayout(layout, allowedSlugs) {
  if (layout === null) return null;
  if (!layout || typeof layout !== 'object' || !layout.cards || typeof layout.cards !== 'object' || Array.isArray(layout.cards)) throw new Error('排版数据格式不正确');
  const cards = {};
  const entries = Object.entries(layout.cards);
  if (entries.length > allowedSlugs.length) throw new Error('排版中的作品数量不正确');
  for (const [slug, size] of entries) {
    if (!allowedSlugs.includes(slug)) throw new Error('排版中包含不属于当前画廊或已删除的作品');
    if (!size || !Number.isFinite(size.span) || size.span < .04 || size.span > 1 || !Number.isFinite(size.height) || size.height < 80 || size.height > 1600) throw new Error('卡片宽度或高度超出允许范围');
    cards[slug] = { span: Math.round(size.span * 1000000) / 1000000, height: Math.round(size.height) };
  }
  if(!entries.length)return null;
  if(layout.rows!==undefined){
    if(!Array.isArray(layout.rows)||layout.rows.length>entries.length)throw new Error('分行数据格式不正确');
    const seen=new Set();
    const rows=layout.rows.map(row=>{
      if(!row||!Array.isArray(row.slugs)||!row.slugs.length||!Number.isFinite(row.span)||row.span<.04||row.span>1)throw new Error('分行数据格式不正确');
      if(row.span+.000001<row.slugs.length*.04)throw new Error('同行卡片过多，请增加这一行的宽度');
      for(const slug of row.slugs){if(typeof slug!=='string'||!Object.hasOwn(cards,slug)||seen.has(slug))throw new Error('分行中包含重复或无效作品');seen.add(slug);}
      return {slugs:[...row.slugs],span:Math.round(row.span*1000000)/1000000};
    });
    if(seen.size!==entries.length)throw new Error('分行中缺少作品');
    return {cards,rows};
  }
  return { cards };
}

// 宽度按“卡片 + 间距”占画廊的比例保存，换窗口时保持同一行的组合。
export function calculateManualGallery(sizes, width, gap, rows = []) {
  let x = 0, y = 0, rowHeight = 0;
  const cards=[];let offset=0;
  // 已编辑的排版保存每行成员与占用宽度；缩放窗口也不会把同行卡片挤到下一行。
  for(const row of rows){
    const group=sizes.slice(offset,offset+row.count);if(!group.length)continue;
    const available=Math.max(1,row.span*(width+gap)-gap*group.length);
    const weights=group.map(size=>Math.max(1,size.span*(width+gap)-gap)),total=weights.reduce((a,b)=>a+b,0);
    x=0;rowHeight=0;
    group.forEach((size,i)=>{const cardWidth=available*weights[i]/total;cards.push({x,y,width:cardWidth,height:size.height});x+=cardWidth+gap;rowHeight=Math.max(rowHeight,size.height);});
    y+=rowHeight+gap;offset+=group.length;
  }
  x=0;rowHeight=0;
  for(const size of sizes.slice(offset)){
    const cardWidth = Math.max(1, Math.min(width, size.span * (width + gap) - gap));
    if (x > 0 && x + cardWidth > width + .5) { y += rowHeight + gap; x = 0; rowHeight = 0; }
    const box = { x, y, width: cardWidth, height: size.height };
    x += cardWidth + gap;
    rowHeight = Math.max(rowHeight, size.height);
    cards.push(box);
  }
  return { cards, height: cards.length ? (offset===sizes.length?y-gap:y+rowHeight) : 0 };
}

// 旧版只保存宽高，按原来的 span 换行方式补出行信息。
export function legacyGalleryRows(layout){
  const rows=[];let row=null;
  for(const [slug,size] of Object.entries(layout.cards)){
    if(!row||row.span+size.span>1.00001){row={slugs:[],span:0};rows.push(row);}
    row.slugs.push(slug);row.span=Math.min(1,row.span+size.span);
  }
  return rows;
}

// 未满行可增减占用宽度；最后一张缩小时释放右侧留白，保留最小宽度。
function resizeWithinRow(layout,slug,width,height,canvasWidth,gap){
  const next=structuredClone(layout),row=next.rows.find(row=>row.slugs.includes(slug));if(!row)return next;
  const unit=canvasWidth+gap,others=row.slugs.filter(item=>item!==slug);
  const minimum=Math.max(96,.04*unit-gap);
  if(!others.length){width=Math.max(Math.min(minimum,canvasWidth),Math.min(canvasWidth,width));row.span=(width+gap)/unit;}
  else{
    if(row.span<1||(row===next.rows.at(-1)&&row.slugs.at(-1)===slug)){
      const occupied=row.span*unit-gap*row.slugs.length;
      const weight=item=>Math.max(1,layout.cards[item].span*unit-gap);
      const currentWidth=occupied*weight(slug)/row.slugs.reduce((sum,item)=>sum+weight(item),0);
      row.span=Math.min(1,Math.max(row.slugs.length*.04,row.span+(Math.max(minimum,width)-currentWidth)/unit));
    }
    const available=row.span*unit-gap*row.slugs.length,min=Math.min(minimum,available/row.slugs.length);
    width=Math.max(min,Math.min(available-others.length*min,width));
    let remaining=available-width,pending=[...others];
    while(pending.length){
      const total=pending.reduce((sum,item)=>sum+Math.max(1,layout.cards[item].span*unit-gap),0);
      const narrow=pending.filter(item=>remaining*Math.max(1,layout.cards[item].span*unit-gap)/total<min);
      if(!narrow.length){for(const item of pending)next.cards[item].span=(remaining*Math.max(1,layout.cards[item].span*unit-gap)/total+gap)/unit;break;}
      for(const item of narrow){next.cards[item].span=(min+gap)/unit;remaining-=min;}pending=pending.filter(item=>!narrow.includes(item));
    }
  }
  next.cards[slug]={span:(width+gap)/unit,height:Math.round(Math.max(120,Math.min(1200,height)))};
  return next;
}

function allocateRow(layout,row,canvasWidth,gap,minRatio=0){
  const unit=canvasWidth+gap;row.span=Math.min(1,Math.max(row.span,row.slugs.length*.04));
  let remaining=Math.max(1,row.span*unit-gap*row.slugs.length),pending=[...row.slugs];
  const minima=new Map(pending.map(slug=>[slug,Math.max(1,.04*unit-gap,layout.cards[slug].height*minRatio)])),weights=new Map(pending.map(slug=>[slug,Math.max(1,layout.cards[slug].span*unit-gap)]));
  while(pending.length){
    const total=pending.reduce((sum,slug)=>sum+weights.get(slug),0),small=pending.filter(slug=>remaining*weights.get(slug)/total<minima.get(slug));
    if(!small.length){for(const slug of pending)layout.cards[slug].span=(remaining*weights.get(slug)/total+gap)/unit;break;}
    for(const slug of small){const minimum=minima.get(slug);layout.cards[slug].span=(minimum+gap)/unit;remaining-=minimum;}pending=pending.filter(slug=>!small.includes(slug));
  }
}
function moveToNextRow(layout,index,slug,canvasWidth,gap,minRatio,source){
  const row=layout.rows[index],unit=canvasWidth+gap;
  row.slugs=row.slugs.filter(item=>item!==slug);
  const card=layout.cards[slug],naturalWidth=Math.min(canvasWidth,Math.max(96,minRatio*card.height,(source.cards[slug]?.span||card.span)*unit-gap));
  card.span=(naturalWidth+gap)/unit;
  if(!layout.rows[index+1])layout.rows.push({slugs:[],span:0});
  const next=layout.rows[index+1];next.slugs.unshift(slug);next.span=Math.min(1,next.span+card.span);
}
// 只在编辑时重排并保存行成员；普通页面缩放继续使用已保存的分行。
function flowRows(input,canvasWidth,gap,{minRatio=.5,start=0,fixedSlug=null,fixedWidth=0,freeTailSlug=null,source=input}={}){
  let next=structuredClone(input);const unit=canvasWidth+gap;
  for(let index=start;index<next.rows.length;index++){
    let row=next.rows[index];
    while(row.slugs.length){
      if(row.slugs.length>25){const slug=row.slugs.at(-1);moveToNextRow(next,index,slug,canvasWidth,gap,minRatio,source);if(slug===fixedSlug)fixedSlug=null;continue;}
      if(row.slugs.includes(fixedSlug))next=resizeWithinRow(next,fixedSlug,fixedWidth,next.cards[fixedSlug].height,canvasWidth,gap);
      else allocateRow(next,row,canvasWidth,gap);
      row=next.rows[index];
      const freeTail=index===next.rows.length-1&&row.slugs.at(-1)===freeTailSlug;
      if(row.slugs.length===1){const card=next.cards[row.slugs[0]];card.span=Math.min(1,Math.max(card.span,(Math.min(canvasWidth,card.height*(freeTail?0:minRatio))+gap)/unit));row.span=card.span;break;}
      const narrow=row.slugs.map((slug,i)=>({slug,i,ratio:(next.cards[slug].span*unit-gap)/next.cards[slug].height})).filter(item=>item.ratio<minRatio-1e-6&&!(freeTail&&item.slug===freeTailSlug)).sort((a,b)=>a.ratio-b.ratio||b.i-a.i)[0];
      if(!narrow)break;
      moveToNextRow(next,index,narrow.slug,canvasWidth,gap,minRatio,source);
      if(narrow.slug===fixedSlug)fixedSlug=null;
    }
  }
  next.rows=next.rows.filter(row=>row.slugs.length);return next;
}
export function resizeGalleryRow(layout,slug,width,height,canvasWidth,gap,{minRatio=.5}={}){
  const next=structuredClone(layout),index=next.rows.findIndex(row=>row.slugs.includes(slug));if(index<0)return next;
  next.cards[slug].height=Math.round(Math.max(120,Math.min(1200,height)));
  const tailRow=layout.rows.at(-1),tailSlug=tailRow.slugs.at(-1),unit=canvasWidth+gap;
  const weight=item=>Math.max(1,layout.cards[item].span*unit-gap);
  const tailWidth=(tailRow.span*unit-gap*tailRow.slugs.length)*weight(tailSlug)/tailRow.slugs.reduce((sum,item)=>sum+weight(item),0);
  // A deliberately narrow final card must also survive later edits to other cards.
  const freeTailSlug=tailSlug===slug||tailWidth/layout.cards[tailSlug].height<minRatio-1e-6?tailSlug:null;
  return flowRows(next,canvasWidth,gap,{minRatio,start:index,fixedSlug:slug,fixedWidth:width,freeTailSlug,source:layout});
}
export function moveGalleryToNextRow(layout,slug,canvasWidth,gap,{minRatio=.5}={}){
  const next=structuredClone(layout),index=next.rows.findIndex(row=>row.slugs.includes(slug));if(index<0||next.rows[index].slugs.length<2)return next;
  moveToNextRow(next,index,slug,canvasWidth,gap,minRatio,layout);
  return flowRows(next,canvasWidth,gap,{minRatio,start:index,source:layout});
}

// 插入行内指定位置，真正改变两行的成员数量；空出的行会移除。
export function insertGalleryIntoRow(layout,slug,targetIndex,beforeSlug,canvasWidth,gap,{minRatio=.5}={}){
  const next=structuredClone(layout),sourceIndex=next.rows.findIndex(row=>row.slugs.includes(slug)),target=next.rows[targetIndex];
  if(sourceIndex<0||!target||beforeSlug===slug)return next;
  const source=next.rows[sourceIndex],oldOrder=[...source.slugs];source.slugs=source.slugs.filter(item=>item!==slug);
  const at=beforeSlug?target.slugs.indexOf(beforeSlug):-1;target.slugs.splice(at<0?target.slugs.length:at,0,slug);
  if(sourceIndex===targetIndex&&oldOrder.every((item,i)=>item===target.slugs[i]))return structuredClone(layout);
  if(sourceIndex!==targetIndex)target.span=Math.min(1,target.span+next.cards[slug].span);
  const unit=canvasWidth+gap,minimumSpace=target.slugs.reduce((sum,item)=>sum+Math.max(1,.04*unit-gap,minRatio*next.cards[item].height)+gap,0);
  target.span=Math.min(1,Math.max(target.span,minimumSpace/unit));
  if(minimumSpace<=target.span*unit+.001)allocateRow(next,target,canvasWidth,gap,minRatio);
  return flowRows(next,canvasWidth,gap,{minRatio,start:Math.min(sourceIndex,targetIndex),source:layout});
}

// 拖动改变阅读顺序，保留每行的槽位数量与总宽度。
export function reorderGallery(layout,slug,index){
  const next=structuredClone(layout),order=layout.rows.flatMap(row=>row.slugs),from=order.indexOf(slug);if(from<0)return next;
  order.splice(from,1);order.splice(Math.max(0,Math.min(order.length,index)),0,slug);let start=0;
  for(const row of next.rows){
    row.slugs=order.slice(start,start+row.slugs.length);start+=row.slugs.length;
    let pending=[...row.slugs],remaining=row.span;
    while(pending.length){
      const total=pending.reduce((sum,item)=>sum+layout.cards[item].span,0),narrow=pending.filter(item=>remaining*layout.cards[item].span/total<.04);
      if(!narrow.length){for(const item of pending)next.cards[item].span=remaining*layout.cards[item].span/total;break;}
      for(const item of narrow){next.cards[item].span=.04;remaining-=.04;}pending=pending.filter(item=>!narrow.includes(item));
    }
  }
  return next;
}
