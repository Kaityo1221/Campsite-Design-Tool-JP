/* Shared POI spacing policy used by the main tool and field mode. */
(() => {
  'use strict';

  if (window.CampsitePoiSpacingPolicy) return;

  const FALLBACK_TARGET_METERS = 50;
  const referenceMeters = Object.freeze([30, 40]);

  function getTargetMeters() {
    const policyValue = Number(window.CampsitePolicy?.getSpacingMeters?.());
    return Number.isFinite(policyValue) && policyValue > 0
      ? policyValue
      : FALLBACK_TARGET_METERS;
  }

  function distanceBand(meters) {
    const distance = Number(meters);
    const targetMeters = getTargetMeters();
    if (!Number.isFinite(distance)) return 'waiting';
    if (distance < referenceMeters[0]) return 'danger';
    if (distance < referenceMeters[1]) return 'caution';
    if (distance < targetMeters) return 'near';
    return 'ok';
  }

  const policy = {
    get targetMeters() {
      return getTargetMeters();
    },
    referenceMeters,
    distanceBand,
    get publicLead() {
      return `POI間隔は${getTargetMeters()}mを目安に設計してください。`;
    },
    referenceNote: '30m・40mは参考距離です。',
    get targetCircleFolder() {
      return `${getTargetMeters()}m円（目安）`;
    },
    referenceCircleFolders: Object.freeze({
      30: '30m円（参考距離）',
      40: '40m円（参考距離）'
    })
  };

  window.CampsitePoiSpacingPolicy = Object.freeze(policy);

  if (
    typeof document !== 'undefined' &&
    document.getElementById('distance') &&
    !document.getElementById('distanceBandClarityLoader')
  ) {
    const script = document.createElement('script');
    script.id = 'distanceBandClarityLoader';
    script.src = './js/distance-band-clarity-v2.js?v=2';
    script.async = true;
    document.head.appendChild(script);
  }

  if (
    typeof document !== 'undefined' &&
    document.getElementById('distance') &&
    !document.getElementById('distanceDesignTrackingLoader')
  ) {
    const script = document.createElement('script');
    script.id = 'distanceDesignTrackingLoader';
    script.src = './js/distance-design-tracking.js?v=5';
    script.async = true;
    document.head.appendChild(script);
  }

  /* field-mode.html / field-prep.html are standalone entry points.
     Protect direct URL access with the same Japan CA gate. */
  if (
    typeof document !== 'undefined' &&
    /\/(field-mode|field-prep)\.html$/i.test(window.location.pathname) &&
    !document.getElementById('caAccessBootstrapLoader')
  ) {
    const script = document.createElement('script');
    script.id = 'caAccessBootstrapLoader';
    script.src = './js/ca-access-bootstrap.js?v=1';
    script.async = false;
    document.head.appendChild(script);
  }
})();
