import workData from './works.json';
import {categories} from './categories.js';
import galleryLayouts from './gallery-layouts.json';
import showreelSettings from './showreels.json';
import {orderGalleryKeys} from '../lib/gallery-order.js';
import {isVisibleInProjects} from '../lib/project-visibility.js';
export {categories};

export type CategorySlug = typeof categories[number]['slug'];
export interface WorkBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'spacer' | 'group';
  text?: string;
  heading?: string;
  src?: string;
  embedUrl?: string; // Vimeo / Behance / Instagram 原内容链接，与上传文件二选一
  embedMode?: 'embed' | 'link'; // 外链模式只显示封面，点击打开原项目
  embedPoster?: string; // 正文外链封面，独立于列表缩略图
  caption?: string;
  captionHeight?: number; // 说明的额外占用高度，由编辑器测量，不计入素材框尺寸
  captionAlign?: 'left' | 'center' | 'right';
  children?: WorkBlock[];
  columns?: number;
  columnGap?: number;
  rowGap?: number;
  mediaHeight?: number;
  layout?: { x:number; y:number; width:number; height:number };
  fit?: 'cover' | 'contain';
  fontSize?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  gap?: number;
  height?: number;
  placeholder?: Work['placeholder'];
}
export interface Work {
  slug: string;
  category: CategorySlug;
  title: string;
  titleEn?: string;
  studio: string; // 悬停时显示的第二行：工作室 / 客户 / 合作署名
  summary?: string;
  year?: string;
  cover?: string;
  aspectRatio?: string; // 占位图比例，例如 '4 / 3'；上传的缩略图使用真实宽高比
  placeholder?: 'orbit' | 'ribbon' | 'bloom' | 'wave' | 'type' | 'grid';
  isDemo?: boolean;
  hiddenFromProjects?: boolean; // 只隐藏总览卡片，分区和作品页保留
  contentWidth?: number | null;
  titleAlign?: 'left' | 'center' | 'right';
  layoutMode?: 'flow' | 'canvas';
  canvasWidth?: number;
  blocks?: WorkBlock[];
  media?: { type: 'image' | 'video'; src: string; caption?: string }[];
}

// 可视化编辑器保存到 works.json；也可以直接编辑该 JSON 文件。
export const works = workData as Work[];
export const projectWorks = works.filter(isVisibleInProjects);
export function getCategoryWorks(category: CategorySlug): Work[] {
  const siblings = works.filter(work => work.category === category);
  const bySlug = new Map(siblings.map(work => [work.slug, work]));
  const layout = (galleryLayouts as Record<string, unknown>)[category];
  return orderGalleryKeys(siblings.map(work => work.slug), layout).map(slug => bySlug.get(slug)!);
}
export const categoryUrl = (slug: CategorySlug) => `/projects/${slug}/`;
export const workUrl = (work: Work) => `${categoryUrl(work.category)}${work.slug}/`;

export const directoryShowreels = showreelSettings.cards.map(reel=>({...reel,src:`/showreel/${reel.year}.mp4`,poster:('thumbnail' in reel&&typeof reel.thumbnail==='string'&&reel.thumbnail)||`/showreel/${reel.year}-poster.webp`}));

export const showreels = [{year:"all",label:"ALL",title:"2023-2026",src:"/showreel/all.mp4",poster:"/showreel/all-poster.webp"},...directoryShowreels.map(reel=>({...reel,title:String(reel.year)}))];
