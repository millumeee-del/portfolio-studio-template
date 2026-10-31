// 自包含：也会在首页 HTML 顶部执行，3D 模块加载前就能选到正确版本。
export function mountCharacterPosterSizing(stage, model) {
  let current=model;
  function update() {
    const frame=current?.posterFraming;
    const width=stage.clientWidth,height=stage.clientHeight;
    const scale=frame&&width>0&&height>0 ? frame.referenceDistance/Math.max(frame.baseDistance,frame.horizontalDistance*height/width) : 1;
    stage.style.setProperty('--character-poster-scale',String(scale));
  }
  const observer=new ResizeObserver(update);observer.observe(stage);
  const controller={update,setModel(model){current=model;update();},dispose(){observer.disconnect();if(stage.__characterPosterSizing===controller)delete stage.__characterPosterSizing;}};
  stage.__characterPosterSizing=controller;update();return controller;
}

export function getCharacterPoster(model, storage) {
  if (model.poster) return model.poster;
  try {
    const cached = JSON.parse(storage.getItem(`studio-character-preview:${model.id}`) || 'null');
    if (cached?.revision === model.revision && typeof cached.image === 'string' && cached.image.length < 4000000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(cached.image)) return cached.image;
  } catch {}
  return null;
}
