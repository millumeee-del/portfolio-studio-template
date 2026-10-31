import {renderWorksGallery, galleryLayoutHelpers} from './works-gallery-layout.js';

// 只序列化项目自身的函数；用户数据放在 HTML 属性中，不拼接进脚本。
// 普通同步脚本紧跟画廊执行，在模块下载之前完成首帧布局。
export function galleryBootstrapSource() {
  const helpers = Object.entries(galleryLayoutHelpers).map(([key, fn]) => `${JSON.stringify(key)}:${fn.toString()}`).join(',');
  return `;(${renderWorksGallery.toString()})(document.currentScript.previousElementSibling,{${helpers}});`;
}
