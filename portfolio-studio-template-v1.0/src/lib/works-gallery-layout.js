import { calculateGalleryRows, calculateCategoryRows } from './gallery-rows.js';
import { calculateManualGallery } from './gallery-layout.js';
import { orderGalleryKeys } from './gallery-order.js';


export const galleryLayoutHelpers = {calculateGalleryRows, calculateCategoryRows, calculateManualGallery, orderGalleryKeys};

export function renderWorksGallery(grid, {calculateGalleryRows, calculateCategoryRows, calculateManualGallery, orderGalleryKeys}) {
    if (!grid) return;
    let cards = [...grid.querySelectorAll('[data-work-card]')];
    if (!cards.length) return;
    const width = grid.clientWidth;
    if (!width) return;
    const style = getComputedStyle(grid);
    const height = Math.max(1, parseFloat(style.getPropertyValue('--gallery-row-height')) || 260);
    const gap = Math.max(0, parseFloat(style.columnGap) || 0);
    const maxItems = Math.max(1, Math.floor(parseFloat(style.getPropertyValue('--gallery-max-items'))) || 5);
    const minItems = Math.max(1, Math.min(maxItems, Math.floor(parseFloat(style.getPropertyValue('--gallery-min-items'))) || 4));
    const mobileColumns = Math.max(0, Math.floor(parseFloat(style.getPropertyValue('--gallery-mobile-columns'))) || 0);
    const isCategory = grid.dataset.galleryVariant === 'category';
    const cardKey=card=>card.dataset.galleryKey||card.dataset.workSlug;
    let custom = null;
    try { custom = JSON.parse(grid.dataset.galleryLayout || 'null'); } catch { /* 无效文件回退为自动布局。 */ }
    const useCustom = custom?.cards && parseFloat(style.getPropertyValue(isCategory?'--category-gallery-use-custom':'--overview-gallery-use-custom')) !== 0;
    const originalOrder=cards.map(cardKey);
    grid._galleryOriginalOrder ??= originalOrder;
    const bySlug=new Map(cards.map(card=>[cardKey(card),card]));
    cards=orderGalleryKeys([...grid._galleryOriginalOrder.filter(slug=>bySlug.has(slug)),...originalOrder],custom).map(slug=>bySlug.get(slug));
    if(cards.some((card,i)=>cardKey(card)!==originalOrder[i]))for(const card of cards)grid.insertBefore(card,grid.querySelector('.gallery-editor-layer'));
    const categoryLimit = Math.max(1, Math.floor(parseFloat(style.getPropertyValue(cards.length <= 4 ? '--category-gallery-small-items' : cards.length >= 10 ? '--category-gallery-dense-items' : '--category-gallery-items'))) || 3);
    const sparseCardMaxWidth = Math.max(1, parseFloat(style.getPropertyValue('--category-gallery-sparse-max-width')) || 720);
    const ratios = cards.map(card => {
      const fallback = Number(card.dataset.fallbackRatio);
      // 真实尺寸在生成 HTML 时已确定；图片解码完成不再触发重新分行。
      const ratio = fallback > 0 && Number.isFinite(fallback) ? fallback : 4 / 3;
      // 极端长图也保留足够宽度给相邻卡片，内容通过 cover 居中裁切。
      return Math.max(.5, Math.min(2.4, ratio));
    });
    const rows = mobileColumns
      ? Array.from({length:Math.ceil(cards.length/mobileColumns)},(_,index)=>({start:index*mobileColumns,end:Math.min(cards.length,(index+1)*mobileColumns),height}))
      : isCategory
      ? calculateCategoryRows(cards.length, height, categoryLimit)
      : calculateGalleryRows(ratios, width, height, gap, minItems, maxItems);
    let y = 0, fullRowScale = null;
    grid.classList.add('is-row-gallery');
    rows.forEach(row => {
      let x = 0;
      const ratioSum = ratios.slice(row.start, row.end).reduce((sum, ratio) => sum + ratio, 0);
      const imageSpace = width - gap * (row.end - row.start - 1);
      let widthPerRatio = imageSpace / ratioSum;
      // 零散末行沿用上一完整行的尺寸尺度；整组作品都不足一行时用行高推算自然宽度。
      if (isCategory) {
        const maxRatio = Math.max(...ratios.slice(row.start, row.end));
        if (cards.length <= 2) widthPerRatio = Math.min(widthPerRatio, sparseCardMaxWidth / maxRatio);
        else if (row.end - row.start === 1 && categoryLimit > 1) widthPerRatio = Math.min(widthPerRatio, fullRowScale ?? height, sparseCardMaxWidth / maxRatio);
        else fullRowScale = widthPerRatio;
      } else {
        if (row.end - row.start < minItems) widthPerRatio = Math.min(widthPerRatio, fullRowScale ?? height);
        else fullRowScale = widthPerRatio;
      }
      for (let index = row.start; index < row.end; index++) {
        const cardWidth = mobileColumns ? (width-gap*(mobileColumns-1))/mobileColumns : ratios[index] * widthPerRatio;
        Object.assign(cards[index].style, {
          width: `${cardWidth}px`, height: `${row.height}px`,
          transform: `translate3d(${x}px, ${y}px, 0)`
        });
        x += cardWidth + gap;
      }
      y += row.height + gap;
    });
    grid.style.height = `${Math.max(0, y - gap)}px`;
    if (useCustom) {
      const sizes = cards.map(card => {
        const stored = custom.cards[cardKey(card)];
        return stored && Number.isFinite(stored.span) && stored.span > 0 && stored.span <= 1 && Number.isFinite(stored.height) && stored.height > 0
          ? stored
          : { span: (card.getBoundingClientRect().width + gap) / (width + gap), height };
      });
      const rowSpecs=Array.isArray(custom.rows)?custom.rows.map(row=>({count:row.slugs.filter(slug=>bySlug.has(slug)).length,span:row.span})).filter(row=>row.count):[];
      const manual = calculateManualGallery(sizes, width, gap, rowSpecs);
      manual.cards.forEach((box, index) => Object.assign(cards[index].style, {
        width: `${box.width}px`, height: `${box.height}px`, transform: `translate3d(${box.x}px, ${box.y}px, 0)`
      }));
      grid.style.height = `${manual.height}px`;
    }
    grid.dispatchEvent(new Event('gallery:render'));
  }
