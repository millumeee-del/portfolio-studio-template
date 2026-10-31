// 只检查实际标签；首屏语言脚本里也会出现编辑器选择器名称。
export function containsLocalEditorMarkup(html){
  const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
  return /<[a-z][^>]*\sdata-(?:project-manager|visual-(?:work-)?editor|gallery-editor|home-layout-editor|about-portrait-editor|translation-dialog|showreel-editor|showreel-layout-editor)(?=[\s=>])/i.test(markup);
}
