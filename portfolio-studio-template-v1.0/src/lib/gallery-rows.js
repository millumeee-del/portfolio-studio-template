// 保持数据顺序与固定行高，以原图比例作为宽度分配权重。
// 全局选择每行数量，避免 18 件作品被分为 5+5+5+3，优先分为 4/5 的完整行。
export function calculateGalleryRows(ratios, width, height, gap, minItems, maxItems) {
  const scores = Array(ratios.length + 1).fill(Infinity);
  const counts = Array(ratios.length).fill(1);
  scores[ratios.length] = 0;
  for (let start = ratios.length - 1; start >= 0; start--) {
    let sum = 0;
    for (let count = 1; count <= maxItems && start + count <= ratios.length; count++) {
      sum += ratios[start + count - 1];
      const end = start + count;
      if (count < minItems && end !== ratios.length) continue;
      const available = width - gap * (count - 1);
      if (available <= 0) break;
      const cropCost = Math.log(available / (sum * height)) ** 2;
      const incompleteCost = count < minItems ? 100 * (minItems - count) ** 2 : 0;
      const score = cropCost + incompleteCost + scores[end];
      if (score < scores[start]) { scores[start] = score; counts[start] = count; }
    }
  }
  const rows = [];
  for (let start = 0; start < ratios.length;) {
    const end = start + counts[start];
    rows.push({ start, end, height });
    start = end;
  }
  return rows;
}

// 分区优先均衡每行数量，例如 7 件排为 3+2+2，避免出现 3+3+1。
export function calculateCategoryRows(count, height, maxItems) {
  const rowCount = Math.ceil(count / maxItems);
  const baseCount = Math.floor(count / rowCount);
  const extra = count % rowCount;
  const rows = [];
  let start = 0;
  for (let row = 0; row < rowCount; row++) {
    const end = start + baseCount + (row < extra ? 1 : 0);
    rows.push({ start, end, height });
    start = end;
  }
  return rows;
}
