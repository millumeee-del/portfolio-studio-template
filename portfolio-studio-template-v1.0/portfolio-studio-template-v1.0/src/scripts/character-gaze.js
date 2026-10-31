// 在这里修改鼠标互动；保存后本地网页会自动更新。
export const GAZE_SETTINGS=Object.freeze({
  maxYaw:15,            // 左右看向鼠标的最大角度（度）；0 = 关闭左右反馈
  maxPitch:15,          // 抬头、低头的最大角度（度）；0 = 关闭上下反馈
  decayStrength:.25,   // 距离衰减力度：0 = 不衰减；越大，远处反馈越弱
  decayRadius:1.0,     // 衰减范围 = 页面可视短边的这个比例；越大，范围越广
  minStrength:.20,     // 远处至少保留的强度：0～1；.60 = 最大角度的 60%
  responseSeconds:.30, // 跟随平滑时间（秒）；越小，反应越快
  eyeLineHeight:.327,  // 平视参考线的脸部高度：0 = 底部，1 = 顶部；调小会下移

  // 一般不用改以下参数。
  centerFaceWidths:.08,     // 脸中心附近的安静范围，按脸宽比例计算
  centerSoftFaceWidths:.25, // 从中心平滑过渡到完整方向反馈的范围
  headCorrectionLimit:60,   // 头颈相对原姿势的总转动上限，含身体自转补偿
  neckShare:.35             // 颈部承担的反馈比例；头部仍达到完整目标朝向
});

function direction(delta,width,settings) {
  const inner=Math.max(3,width*settings.centerFaceWidths);
  const outer=Math.max(inner+4,width*settings.centerSoftFaceWidths);
  const blend=Math.max(0,Math.min(1,(Math.abs(delta)-inner)/(outer-inner)));
  return Math.sign(delta)*blend*blend*(3-2*blend);
}

export function pointerGaze(dx,dy,faceWidth,viewport,settings=GAZE_SETTINGS) {
  const width=Math.max(faceWidth,36);
  const distance=Math.hypot(dx,dy);
  // Decay spans the page, not a few face widths. Horizontal displacement must
  // never suppress vertical recognition (and vice versa), including diagonals.
  const shortSide=Math.max(1,Math.min(viewport.width,viewport.height));
  const radius=Math.max(1,shortSide*Math.max(0,settings.decayRadius));
  const proximity=Math.exp(-Math.max(0,settings.decayStrength)*(distance/radius)**2);
  const minimum=Math.max(0,Math.min(1,settings.minStrength));
  const strength=minimum+(1-minimum)*proximity;
  return {
    yaw:direction(dx,width,settings)*Math.max(0,settings.maxYaw)*strength,
    pitch:direction(dy,width,settings)*Math.max(0,settings.maxPitch)*strength,
    distance,proximity,strength,radius
  };
}
