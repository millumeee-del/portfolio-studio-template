import { mountCharacter } from './character-interaction.js';
import { selectHomeModel } from '../lib/home-model-choice.js';
import { getCharacterPoster, mountCharacterPosterSizing } from '../lib/character-preview.js';

export function mountHomeCharacter(stage, switcher) {
  const CHARACTER_MODELS = JSON.parse(stage.dataset.characterModels || '[]');
  if (!CHARACTER_MODELS.length) return () => {};
  const key = 'studio-debug-model';
  const poster = stage.querySelector('[data-character-poster]');
  let index = 0, active, pending, generation = 0, handoff;
  try {
    index = selectHomeModel(CHARACTER_MODELS, sessionStorage, String(performance.timeOrigin));
  } catch {}
  function posterFor(model) {
    try { return getCharacterPoster(model, localStorage); } catch { return model.poster; }
  }
  function configure(model) {
    if(!stage.__characterPosterSizing)mountCharacterPosterSizing(stage,model);
    else stage.__characterPosterSizing.setModel(model);
    stage.dataset.modelSrc = model.src;
    stage.dataset.animationName = model.animationName;
    stage.dataset.animationUrl = model.animationUrl || '';
    stage.dataset.faceDirectory = model.faceDirectory;
    stage.dataset.faceTexturePrefix = model.faceTexturePrefix || 'face';
    stage.dataset.faceTextures = JSON.stringify(model.faceTextures || null);
    const source = posterFor(model);
    stage.style.setProperty('--character-poster-image', source ? `url(${JSON.stringify(source)})` : 'none');
    return source;
  }
  function updateButton() {
    if (switcher) {
      switcher.setAttribute('aria-busy', String(!!pending));
      const button = switcher.querySelector('[data-model-next]');
      if(button){
        button.dataset.modelColor=String(index);
        button.title=`当前：${CHARACTER_MODELS[index].label}；点击切换到 ${CHARACTER_MODELS[(index+1)%CHARACTER_MODELS.length].label}`;
      }
    }
  }
  function finishHandoff() {
    if (!handoff) return;
    cancelAnimationFrame(handoff.frame);clearTimeout(handoff.timer);handoff = undefined;
    poster.hidden = true;poster.classList.remove('is-handing-off');
    active?.startMotion();
  }
  function revealCharacter(current, startMotion) {
    if (!poster || poster.hidden) { startMotion();return; }
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.max(0, parseFloat(getComputedStyle(stage).getPropertyValue('--home-character-handoff-ms')) || 0);
    handoff = {};
    if (!duration) { finishHandoff();return; }
    handoff.frame = requestAnimationFrame(() => {
      if (current !== generation) return;
      poster.classList.add('is-handing-off');
      handoff.timer = setTimeout(finishHandoff, duration);
    });
  }
  function load() {
    finishHandoff();
    const current = ++generation;
    pending?.dispose(); pending = undefined;
    const status = stage.querySelector('.character-status');
    if (active?.index === index) {
      try { sessionStorage.setItem(key, CHARACTER_MODELS[index].id); } catch {}
      configure(CHARACTER_MODELS[index]);status.hidden = true;updateButton();return;
    }
    const requested = {index, dispose: () => {}};
    pending = requested;
    const source = configure(CHARACTER_MODELS[index]);
    if (poster && !active) poster.hidden = !source;
    // 首次进入、刷新、切换都不显示加载文字；只有真实错误才使用状态栏。
    status.hidden = true;
    status.textContent = '';
    updateButton();
    requested.dispose = mountCharacter(stage, {
      holdMotion: true,
      getState: () => active?.state(),
      onReady({startMotion, captureFrame, getState}) {
        if (current !== generation) return;
        const previous = active;
        // 更新 GLB 后的首次加载只缓存新模型的标准首帧，绝不沿用旧版本截图。
        if (!previous && !CHARACTER_MODELS[index].poster) {
          try {
            const model = CHARACTER_MODELS[index];
            localStorage.setItem(`studio-character-preview:${model.id}`, JSON.stringify({revision:model.revision, image:captureFrame()}));
          } catch {}
        }
        active = {...requested, state: getState, startMotion};
        pending = undefined;
        previous?.dispose();
        revealCharacter(current, startMotion);
        stage.classList.remove('is-dragging');
        try { sessionStorage.setItem(key, CHARACTER_MODELS[index].id); } catch {}
        updateButton();
      },
      onError() {
        if (current !== generation) return;
        pending = undefined;
        requested.dispose();
        if (active) { index = active.index; configure(CHARACTER_MODELS[index]); }
        updateButton();
      },
    });
    // WebGL 初始化也可能同步失败，确保失败的画布及时清理。
    if (pending !== requested && active?.index !== requested.index) requested.dispose();
  }
  function next(event) {
    event?.stopPropagation();
    index = (index + 1) % CHARACTER_MODELS.length;
    load();
  }
  function select(event) {
    const dot = event.target.closest?.('[data-model-next]');
    if (!dot || !switcher.contains(dot) || stage.closest('[data-home-canvas]')?.__homeLayoutEditing) return;
    next(event);
  }
  function restorePage(event) {
    if (!event.persisted) return;
    // 浏览器后退可能直接恢复缓存页面，此时脚本不会重新执行。
    try {
      const savedIndex = CHARACTER_MODELS.findIndex(model => model.id === sessionStorage.getItem(key));
      if (savedIndex >= 0) index = savedIndex;
      sessionStorage.setItem(`${key}-page`, String(performance.timeOrigin));
    } catch {}
    next();
    try { sessionStorage.setItem(key, CHARACTER_MODELS[index].id); } catch {}
  }
  switcher?.addEventListener('click', select);
  const stopControlEvent=event=>event.stopPropagation();
  switcher?.addEventListener('pointerdown',stopControlEvent);
  switcher?.addEventListener('keydown',stopControlEvent);
  window.addEventListener('pageshow', restorePage);
  load();
  return () => {
    generation++;
    if(handoff){cancelAnimationFrame(handoff.frame);clearTimeout(handoff.timer);handoff=undefined;}
    switcher?.removeEventListener('pointerdown',stopControlEvent);
    switcher?.removeEventListener('keydown',stopControlEvent);
    switcher?.removeEventListener('click', select); window.removeEventListener('pageshow', restorePage); pending?.dispose(); active?.dispose();
    stage.__characterPosterSizing?.dispose();
  };
}
