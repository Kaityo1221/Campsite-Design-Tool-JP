/* Shared POI spacing policy used by the main tool and field mode. */
(() => {
  'use strict';

  if (window.CampsitePoiSpacingPolicy) return;

  const targetMeters = 50;
  const referenceMeters = Object.freeze([30, 40]);

  function distanceBand(meters) {
    const distance = Number(meters);
    if (!Number.isFinite(distance)) return 'waiting';
    if (distance < referenceMeters[0]) return 'danger';
    if (distance < referenceMeters[1]) return 'caution';
    if (distance < targetMeters) return 'near';
    return 'ok';
  }

  window.CampsitePoiSpacingPolicy = Object.freeze({
    targetMeters,
    referenceMeters,
    distanceBand,
    publicLead: 'POI間隔は50mを目安に設計してください。',
    referenceNote: '30m・40mは参考距離です。',
    targetCircleFolder: '50m円（目安）',
    referenceCircleFolders: Object.freeze({
      30: '30m円（参考距離）',
      40: '40m円（参考距離）'
    })
  });

  /*
    Main distance-check UI only:
    clarify the 40m以上50m未満 band without changing shared field-mode policy.
  */
  if (
    typeof document !== 'undefined' &&
    document.getElementById('distance') &&
    !document.getElementById('distanceBandClarityLoader')
  ) {
    const script = document.createElement('script');
    script.id = 'distanceBandClarityLoader';
    script.src = './js/distance-band-clarity-v2.js?v=1';
    script.async = true;
    document.head.appendChild(script);
  }
})();
