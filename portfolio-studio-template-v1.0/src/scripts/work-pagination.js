// 仅作品详情页挂载；使用页面现有的 prev/next 链接，顺序始终一致。
export function mountWorkPagination() {
  const pagination = document.querySelector('.work-pagination');
  if (!pagination) return () => {};
  let navigating = false;
  const interactive = 'input,textarea,select,button,a,video,audio,iframe,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="listbox"],[role="menu"],[role="tablist"]';
  function onKeydown(event) {
    if (navigating || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const direction = event.key === 'ArrowLeft' ? 'prev' : event.key === 'ArrowRight' ? 'next' : null;
    if (!direction || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])')) return;
    // composedPath 同时照顾播放器、编辑区和带 Shadow DOM 的控件。
    if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || node.matches(interactive)))) return;
    const link = pagination.querySelector(`a[rel="${direction}"]`);
    if (!link) return; // 第一件 / 最后一件不循环跳转。
    event.preventDefault();
    navigating = true;
    window.location.assign(link.href);
  }
  function reset() { navigating = false; }
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('pageshow', reset);
  return () => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('pageshow', reset);
  };
}
