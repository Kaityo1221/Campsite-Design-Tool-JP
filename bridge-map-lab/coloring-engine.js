(() => {
  'use strict';

  const bridgeMapLab_renderFillColors = Object.freeze({
    POKESTOP: '#2F80ED',
    GYM: '#E53935',
    POWERSPOT: '#8E44AD',
    INACTIVE_POWERSPOT: '#C9A7EB'
  });

  function bridgeMapLab_buildStyle(renderItem, color) {
    if (renderItem.itemType === 'marker') {
      return Object.freeze({ fillColor: color });
    }

    if (renderItem.itemType === 'circle' && renderItem.layerKey === 'circle-50') {
      return Object.freeze({
        color,
        weight: 2,
        opacity: 0.58,
        fillColor: color,
        fillOpacity: 0.08,
        interactive: false
      });
    }

    throw new Error(`Unsupported render item: ${renderItem.itemType}/${renderItem.layerKey}`);
  }

  function bridgeMapLab_buildStyledRenderItem(renderItem) {
    const color = bridgeMapLab_renderFillColors[renderItem.renderKind];
    if (!color) {
      throw new Error(`Unsupported renderKind: ${renderItem.renderKind}`);
    }

    return Object.freeze(Object.assign({}, renderItem, {
      style: bridgeMapLab_buildStyle(renderItem, color)
    }));
  }

  window.bridgeMapLab_buildColorLayer = function (scene) {
    return Object.freeze({
      items: Object.freeze(scene.items.map(bridgeMapLab_buildStyledRenderItem))
    });
  };
})();
