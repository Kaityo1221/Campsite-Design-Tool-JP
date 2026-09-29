(() => {
  'use strict';

  window.bridgeMapLab_fixture = Object.freeze([
    Object.freeze({
      guid: 'poi-a',
      lat: 35.7148,
      lng: 139.7731,
      sourceGameObjects: Object.freeze([
        Object.freeze({ entity: 'POWERSPOT', status: 'ACTIVE', gameBrand: '' }),
        Object.freeze({ entity: 'POKESTOP', status: 'ACTIVE', gameBrand: 'HOLOHOLO' })
      ])
    }),
    Object.freeze({
      guid: 'poi-b',
      lat: 35.71515,
      lng: 139.77355,
      sourceGameObjects: Object.freeze([
        Object.freeze({ entity: 'POWERSPOT', status: 'ACTIVE', gameBrand: '' }),
        Object.freeze({ entity: 'POKESTOP', status: 'ACTIVE', gameBrand: 'HOLOHOLO' }),
        Object.freeze({ entity: 'GYM', status: 'ACTIVE', gameBrand: 'HOLOHOLO' })
      ])
    }),
    Object.freeze({
      guid: 'poi-c',
      lat: 35.71442,
      lng: 139.77262,
      sourceGameObjects: Object.freeze([
        Object.freeze({ entity: 'POWERSPOT', status: 'ACTIVE', gameBrand: '' })
      ])
    }),
    Object.freeze({
      guid: 'poi-d',
      lat: 35.71542,
      lng: 139.77402,
      sourceGameObjects: Object.freeze([
        Object.freeze({ entity: 'POWERSPOT', status: 'INACTIVE', gameBrand: 'HOLOHOLO' })
      ])
    }),
    Object.freeze({
      guid: 'poi-e',
      lat: 35.71412,
      lng: 139.77382,
      sourceGameObjects: Object.freeze([])
    }),
    Object.freeze({
      guid: 'poi-f',
      lat: 35.71572,
      lng: 139.77272
    }),
    Object.freeze({ guid: 'poi-a', lat: 35.71542, lng: 139.77295 }),
    Object.freeze({ guid: 'poi-invalid-lat', lat: 91, lng: 139.7731 }),
    Object.freeze({ guid: 'poi-invalid-lng', lat: 35.7148, lng: 181 })
  ]);
})();
