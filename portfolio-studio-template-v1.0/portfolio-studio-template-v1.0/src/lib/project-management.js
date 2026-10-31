import {validateWorkDraft} from './work-content.js';

export function createProject(input, works, categories) {
  if (!input || !categories.some(category => category.slug === input.category)) throw new Error('请选择有效分区');
  const draft = validateWorkDraft({
    title: input.title, titleEn: input.titleEn || '', studio: input.studio || '', year: input.year || '',
    blocks: [{id: 'cover', type: 'image', placeholder: 'grid', width: 100, align: 'center', gap: 32}]
  });
  const base = draft.title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/g, '') || 'project';
  let slug = base, suffix = 2;
  while (works.some(work => work.category === input.category && work.slug === slug)) slug = `${base}-${suffix++}`;
  return {category: input.category, slug, ...draft, placeholder: 'grid'};
}
