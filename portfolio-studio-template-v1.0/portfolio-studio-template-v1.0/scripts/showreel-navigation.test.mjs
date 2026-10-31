import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialShowreelIndex,reelOffset,showreelArcLayout,showreelWatchTransition} from '../src/lib/showreel-navigation.js';
test('ALL 加入后四段循环、历史年份深链接仍然正确',()=>{
  const years=['all',2026,2024,2022];
  assert.equal(initialShowreelIndex(years,''),0);
  assert.equal(initialShowreelIndex(years,'?year=all'),0);
  assert.equal(initialShowreelIndex(years,'?year=2026'),1);
  for(const direction of [-1,1]){
    let current=0;
    for(let i=0;i<16;i++){
      const step=showreelWatchTransition(current,current+direction,4);
      assert.equal(step.to-step.from,direction);assert.equal(step.order[step.from],current);assert.equal(step.order[step.to],step.index);current=step.index;
    }
    assert.equal(current,0);
  }
});

test('年份深链接选中对应视频，未知年份安全回到最新年份',()=>{
  const years=[2026,2024,2022];
  assert.equal(initialShowreelIndex(years,'?year=2024'),1);
  assert.equal(initialShowreelIndex(years,'?year=2022'),2);
  assert.equal(initialShowreelIndex(years,'?year=unknown'),0);
  assert.equal(initialShowreelIndex(years,''),0);
});

test('播放器可连续首尾循环，跨边界仅移动相邻一屏',()=>{
  for(const direction of [-1,1]){
    let current=0;
    for(let i=0;i<12;i++){
      const transition=showreelWatchTransition(current,current+direction,3);
      assert.equal(transition.to-transition.from,direction);
      assert.equal(transition.order[transition.to],transition.index);
      assert.equal(transition.order[transition.from],current);
      assert.deepEqual([...transition.order].sort(),[0,1,2]);
      current=transition.index;
    }
    assert.equal(current,0);
  }
  const direct=showreelWatchTransition(0,2,3);
  assert.deepEqual(direct.order,[0,1,2]);assert.equal(direct.index,2);
});
test('圆环无限往返后仍保持同样的卡片位置与顺序',()=>{
  for(const pos of [-100.2,-3,-.4,0,1,3,99.8])for(let i=0;i<3;i++)assert.ok(Math.abs(reelOffset(i,pos,3)-reelOffset(i,pos+300,3))<1e-10);
  const first=showreelArcLayout(3,0,960,500,120),next=showreelArcLayout(3,1,960,500,120);
  assert.equal(first.cards[0].y,250);assert.equal(next.cards[1].y,250);
  assert.ok(first.cards[1].y>first.cards[0].y);assert.ok(first.cards[2].y<first.cards[0].y);
  assert.ok(first.cards[1].rotation>3);assert.ok(first.cards[2].rotation<-3);assert.ok(first.radius>500);
});
test('常见手机和电脑视口初始三卡都可见，跨循环接缝时淡出',()=>{
  for(const [width,height,cardHeight] of [[320,390,70],[390,480,80],[960,500,120]]){
    const {cards}=showreelArcLayout(3,0,width,height,cardHeight);
    for(const box of cards){assert.ok(box.opacity>.7);assert.ok(box.y-cardHeight/2>0);assert.ok(box.y+cardHeight/2<height);}
    assert.ok(cards[0].x>cards[1].x);
  }
  assert.equal(showreelArcLayout(3,1.5,960,500,120).cards[0].opacity,0);
});

test('间距倍率只放大卡片间留白，且大倍率不会破坏圆弧坐标',()=>{
  const original=showreelArcLayout(3,0,960,650,160,28,1);
  const expanded=showreelArcLayout(3,0,960,650,160,28,5);
  assert.equal(expanded.step-160,(original.step-160)*5);
  assert.equal(expanded.cards[0].y,original.cards[0].y);
  for(const card of showreelArcLayout(3,.6,960,650,160,28,50).cards){
    for(const value of Object.values(card))assert.ok(Number.isFinite(value));
  }
});

test('中间卡片水平且缩放后仍居中，侧边倾角随所在圆环位置变化',()=>{
  const options={cardWidth:700,cardScale:1.2,ringHeight:1800,centerY:270};
  const original=showreelArcLayout(3,0,1200,800,200,28,5,options);
  const expanded=showreelArcLayout(3,0,1200,800,200,28,15,options);
  assert.equal(expanded.cards[0].rotation,0);
  assert.equal(expanded.cards[0].x+700/2,600);
  assert.equal(expanded.cards[0].y,270);
  assert.equal(expanded.radius,900);
  assert.ok(expanded.cards[1].rotation>original.cards[1].rotation);
  assert.equal(expanded.cards[2].rotation,-expanded.cards[1].rotation);
});

test('静止与拖动时卡片横轴均严格沿标记点的圆环外法线',()=>{
  const cardWidth=700;
  for(const position of [0,.3,1,1.5,-.8]){
    const layout=showreelArcLayout(3,position,1200,800,200,28,15,{cardWidth,cardScale:1.2,ringHeight:1800,centerY:270});
    const centerX=layout.crest-layout.radius;
    for(const card of layout.cards){
      const nx=(card.dotX-centerX)/layout.radius,ny=(card.dotY-layout.centerY)/layout.radius;
      const radians=card.rotation*Math.PI/180;
      assert.ok(Math.abs(Math.cos(radians)-nx)<1e-10);
      assert.ok(Math.abs(Math.sin(radians)-ny)<1e-10);
      const dx=card.x+cardWidth/2-card.dotX,dy=card.y-card.dotY;
      assert.ok(Math.abs(dx*ny-dy*nx)<1e-8);
      assert.ok(dx*nx+dy*ny>0);
    }
  }
});

test('整体左右移动时，圆环、标记与卡片同步平移且法线角度不变',()=>{
  for(const position of [0,.4,1]){
    const base=showreelArcLayout(3,position,1200,800,200,28,15);
    const moved=showreelArcLayout(3,position,1200,800,200,28,15,{anchorX:480});
    assert.equal(moved.crest,base.crest-120);
    for(let i=0;i<3;i++){
      assert.ok(Math.abs(moved.cards[i].x-base.cards[i].x+120)<1e-9);
      assert.ok(Math.abs(moved.cards[i].dotX-base.cards[i].dotX+120)<1e-9);
      for(const key of ['y','dotY','rotation','scale'])assert.equal(moved.cards[i][key],base.cards[i][key]);
    }
  }
});
