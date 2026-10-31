import {renderWorksGallery, galleryLayoutHelpers} from '../lib/works-gallery-layout.js';

export function mountWorksGallery(grid) {
  const cards = [...grid.querySelectorAll('[data-work-card]')];
  if (!cards.length) return () => {};
  let frame = 0, disposed = false, lastWidth = -1;
  function layout() {
    frame = 0;
    if (disposed) return;
    renderWorksGallery(grid, galleryLayoutHelpers);
    lastWidth = grid.clientWidth;
  }
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(layout); }
  // 只响应容器宽度变化，避免设置画廊高度后重复触发布局。
  const observer = new ResizeObserver(() => { if (grid.clientWidth !== lastWidth) schedule(); });
  observer.observe(grid);
  grid.addEventListener('gallery:change', schedule);
  window.addEventListener('resize', schedule);
  layout();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    grid.removeEventListener('gallery:change', schedule);
    window.removeEventListener('resize', schedule);
    grid.classList.remove('is-row-gallery');
    grid.style.removeProperty('height');
    cards.forEach(card => ['transform', 'width', 'height'].forEach(property => card.style.removeProperty(property)));
  };
}
