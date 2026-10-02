import fs from 'node:fs';
import vm from 'node:vm';

const backgroundSource = fs.readFileSync('bridge-pc/tab-relay-background.js','utf8');
const creativeRelaySource = fs.readFileSync('bridge-pc/creative-tab-relay.js','utf8');
const wayfarerRelaySource = fs.readFileSync('bridge-pc/wayfarer-tab-relay.js','utf8');
const tabLinkSource = fs.readFileSync('bridge-pc/wm3b-tab-link.js','utf8');
const observeControllerSource = fs.readFileSync('bridge-pc/wm3-observe-controller.js','utf8');
const zoneSource = fs.readFileSync('bridge-pc/wayfarer-observation-zone.js','utf8');
const creativePatchSource = fs.readFileSync('creative/wayfarer-observe-link-patch.js','utf8');

function fastSetTimeout(fn, ms, ...args) {
  const delay = Number(ms) <= 300 ? 5 : 200;
  return setTimeout(fn, delay, ...args);
}

class FakeBroadcastChannel {
  static channels = [];
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    FakeBroadcastChannel.channels.push(this);
  }
  postMessage(data) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;
      channel.onmessage?.({ data });
    }
  }
  close() {}
}

function createWindow(origin) {
  const listeners = new Map();
  const elements = new Map();
  const win = {
    listeners,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    postMessage(data) {
      const event = { data, source:win, origin };
      for (const fn of [...(listeners.get('message') || [])]) fn(event);
    },
    dispatchEvent(event) {
      for (const fn of [...(listeners.get(event.type) || [])]) fn(event);
      return true;
    },
    setTimeout:fastSetTimeout
  };
  const document = {
    visibilityState:'visible',
    readyState:'complete',
    body:{ appendChild() {} },
    documentElement:{
      appendChild(element) {
        if (element?.id) elements.set(element.id, element);
      }
    },
    getElementById(id) { return elements.get(id) || null; },
    createElement() {
      return {
        id:'',
        style:{},
        dataset:{},
        appendChild() {},
        setAttribute() {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
    },
    querySelector(selector) {
      return selector === 'app-wf-base-map' ? {} : null;
    },
    addEventListener() {},
    close() {}
  };
  return { win, document, origin };
}

function createSessionStorage(initial) {
  const map = new Map();
  if (initial) map.set('campsiteProject.v1', JSON.stringify(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    dump(key='campsiteProject.v1') {
      const value = map.get(key);
      return value ? JSON.parse(value) : null;
    }
  };
}

function makeExtensionBus() {
  let backgroundHandler = null;
  const inbound = new Map();
  const tabMeta = new Map();
  let failTabId = null;
  const bgChrome = {
    runtime:{
      lastError:null,
      onMessage:{
        addListener(fn) { backgroundHandler = fn; }
      }
    },
    tabs:{
      sendMessage(tabId, message, callback) {
        if (failTabId === tabId) {
          bgChrome.runtime.lastError = { message:'simulated relay disconnect' };
          callback?.();
          bgChrome.runtime.lastError = null;
          return;
        }
        const receivers = inbound.get(tabId) || [];
        for (const fn of receivers) fn(message, { id:'background' }, () => {});
        callback?.();
      },
      onRemoved:{ addListener() {} }
    }
  };
  vm.runInContext(backgroundSource, vm.createContext({ chrome:bgChrome, Map, Date, String, Number, RegExp }));

  function chromeForTab(tabId, url) {
    tabMeta.set(tabId, { url });
    return {
      runtime:{
        get lastError() { return null; },
        onMessage:{
          addListener(fn) {
            if (!inbound.has(tabId)) inbound.set(tabId, []);
            inbound.get(tabId).push(fn);
          }
        },
        sendMessage(message, callback) {
          if (!backgroundHandler) throw new Error('background relay not installed');
          backgroundHandler(message, { tab:{ id:tabId }, url }, callback || (() => {}));
        }
      }
    };
  }
  return {
    chromeForTab,
    failRelayTo(tabId) { failTabId = tabId; },
    restoreRelay() { failTabId = null; }
  };
}

function baseGlobals(extra={}) {
  return {
    console,
    setTimeout:fastSetTimeout,
    clearTimeout,
    setInterval(){ return 1; },
    clearInterval(){},
    Map,
    Set,
    WeakSet,
    Object,
    String,
    Number,
    Boolean,
    Array,
    JSON,
    Math,
    Date,
    Promise,
    Error,
    RegExp,
    ...extra
  };
}

export function makeProject() {
  return {
    schemaVersion:'1.0',
    projectId:'pseudo-e2e-project',
    source:'bridge',
    receivedAt:'2026-10-02T00:00:00.000Z',
    createdAt:'2026-10-02T00:00:00.000Z',
    sourcePois:[{ guid:'source-1', title:'Source' }],
    polygon:[[35,139],[35,139.01],[35.01,139.01],[35.01,139]],
    selectedPois:[{ guid:'selected-1', title:'Selected' }],
    circleRadii:[50,40,30],
    edits:[{ id:'edit-1' }],
    currentPois:[{ guid:'current-1', title:'Current' }],
    addedPois:[{ guid:'added-1' }],
    deletedPois:[{ guid:'deleted-1' }],
    distanceResult:{ ok:true },
    meta:{ keep:'meta' },
    unknownFutureField:{ keep:true }
  };
}

export function createHarness(options={}) {
  FakeBroadcastChannel.channels = [];
  const project = options.project || makeProject();
  const sessionStorage = createSessionStorage(project);
  const bus = makeExtensionBus();

  const creative = createWindow('https://kaityo1221.github.io');
  const wayfarerWindows = [];
  const wfTabIds = [];

  const creativeChrome = bus.chromeForTab(1, 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/creative/index.html?campsiteProject=bridge');
  vm.runInContext(creativeRelaySource, vm.createContext(baseGlobals({
    window:creative.win,
    location:{ origin:creative.origin },
    chrome:creativeChrome
  })));

  const patchWindow = {};
  vm.runInContext(creativePatchSource, vm.createContext(baseGlobals({ window:patchWindow })));
  const bootstrap = patchWindow.applyCreativeWayfarerObserveLinkPatch([
    'function installCampsiteProjectNext(project){}',
    'function loadCampsiteBridgeProject(project){',
    '  installCampsiteProjectNext(project);',
    '}'
  ].join('\n'));

  vm.runInContext(bootstrap, vm.createContext(baseGlobals({
    window:creative.win,
    document:creative.document,
    sessionStorage,
    location:{ origin:creative.origin },
    crypto:{ randomUUID(){ return 'creative-' + Math.random().toString(16).slice(2); } }
  })));

  const mapCount = options.mapCount ?? 1;
  for (let i=0; i<mapCount; i += 1) {
    const tabId = 10 + i;
    wfTabIds.push(tabId);
    const wf = createWindow('https://wayfarer.scopely.com');
    wayfarerWindows.push(wf);
    const wfChrome = bus.chromeForTab(tabId, 'https://wayfarer.scopely.com/new/mapview');

    const collector = {
      async collectPolygon(points) {
        if (options.gcsFailure) throw new Error('simulated GCS failure');
        const [a,b,c] = points;
        return {
          enginePois:[
            { guid:'inside', title:'Inside', poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE', lat:(a[0]+c[0])/2, lng:(a[1]+c[1])/2 },
            { guid:'outer', title:'Outer', poiKind:'GYM', gameEntity:'GYM', gameStatus:'ACTIVE', lat:(a[0]+c[0])/2, lng:Math.max(a[1],b[1])+0.0005 },
            { guid:'reserve', title:'Reserve', poiKind:'POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'ACTIVE', lat:(a[0]+c[0])/2, lng:Math.max(a[1],b[1])+0.0015 }
          ],
          acquisition:{
            bufferMeters:200,
            tileCount:3,
            transportComplete:true,
            coverageComplete:true,
            coverageStatus:'complete',
            sourceComplete:true
          }
        };
      }
    };

    const wfContext = vm.createContext(baseGlobals({
      window:wf.win,
      document:wf.document,
      location:{ origin:wf.origin, href:'https://wayfarer.scopely.com/new/mapview' },
      crypto:{ randomUUID(){ return 'wf-' + Math.random().toString(16).slice(2); } },
      BroadcastChannel:FakeBroadcastChannel,
      CustomEvent:class {
        constructor(type, init={}) { this.type=type; this.detail=init.detail; }
      }
    }));
    wf.win.CampsiteBridgePcCollector = collector;
    vm.runInContext(zoneSource, wfContext);
    vm.runInContext(observeControllerSource, wfContext);

    if (options.engineBusy) {
      wf.win.CampsiteWayfarerObserveController = Object.freeze({
        getState(){ return { busy:true }; },
        async runPolygon(){ throw new Error('must not run while busy'); }
      });
    } else if (options.corruptResult) {
      wf.win.CampsiteWayfarerObserveController = Object.freeze({
        getState(){ return { busy:false }; },
        async runPolygon(points) {
          return {
            version:'0.2.0',
            observedAt:new Date().toISOString(),
            polygon:JSON.parse(JSON.stringify(points)),
            counts:{},
            zones:{ interior:[], reference100:[] },
            visibleTotal:0,
            retainedTotal:0,
            canProceed:false,
            acquisition:{}
          };
        }
      });
    } else if (options.noResult) {
      wf.win.CampsiteWayfarerObserveController = Object.freeze({
        getState(){ return { busy:false }; },
        async runPolygon(){ return new Promise(() => {}); }
      });
    }

    vm.runInContext(tabLinkSource, wfContext);
    vm.runInContext(wayfarerRelaySource, vm.createContext(baseGlobals({
      window:wf.win,
      document:wf.document,
      location:{ origin:wf.origin },
      chrome:wfChrome
    })));
  }

  return {
    project,
    sessionStorage,
    creativeApi:creative.win.CampsiteCreativeWayfarerLink,
    creativeWindow:creative.win,
    wayfarerWindows,
    wfTabIds,
    bus,
    async connect() {
      return creative.win.CampsiteCreativeWayfarerLink.checkConnection(project);
    },
    async observe() {
      return creative.win.CampsiteCreativeWayfarerLink.startObservation(project);
    }
  };
}
