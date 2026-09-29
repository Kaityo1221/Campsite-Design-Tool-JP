(() => {
  'use strict';

  const bridgeMapLab_renderFillColors = Object.freeze({
    POKESTOP: '#2F80ED',
    GYM: '#E53935',
    POWERSPOT: '#8E44AD',
    INACTIVE_POWERSPOT: '#C9A7EB'
  });

  function bridgeMapLab_buildStyledRenderItem(renderItem) {
    const fillColor = bridgeMapLab_renderFillColors[renderItem.renderKind];
    if (!fillColor) {
      throw new Error(`Unsupported renderKind: ${renderItem.renderKind}`);
    }

    return Object.freeze(Object.assign({}, renderItem, {
      style: Object.freeze({ fillColor })
    }));
  }

  window.bridgeMapLab_buildColorLayer = function (scene) {
    return Object.freeze({
      items: Object.freeze(scene.items.map(bridgeMapLab_buildStyledRenderItem))
    });
  };
})();
