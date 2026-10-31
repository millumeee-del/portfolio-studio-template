import metrics from '../data/arial-ink-metrics.json';

// 首屏生成静态样式；不在页面绘制后测量字体或修改文字坐标。
// em 单位随字号缩放；桌面与手机各自使用对应的 Arial 字形数据。
export function textEdgeStyle(text, role='nav') {
  const first=Array.from(String(text || '').trimStart())[0];
  const profile=metrics[role] || metrics.nav;
  const desktop=(profile.desktop[first] || 0)/profile.desktopSize;
  const mobile=(profile.mobile[first] || 0)/profile.mobileSize;
  return `--ink-shift: ${desktop}em; --ink-shift-mobile: ${mobile}em`;
}
