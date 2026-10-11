// Isolated iPhone Safari safety guard. Does not mutate Leaflet, KMZ, storage or legacy code.
(() => {
  'use strict';
  if (window.creativeR27TapGuard?.installed) return;
  const controls = '.topbtn,.toolbox,.save,.bottom-bar button,#toolMenu button,#layerPanel button,#circlePanel button,.popup-form button,.popup-form select';
  const selectControl = node => node?.closest?.(controls) || null;
  const maxDelayMs = 410, maxDistancePx = 32;
  let previous = null, active = null, swallowed = false, blockedCount = 0;
  const near = (a,b) => Math.hypot(a.x-b.x,a.y-b.y) <= maxDistancePx;
  const onStart = event => {
    swallowed = false;
    active = null;
    if (event.touches?.length !== 1 || !event.cancelable) return;
    const control = selectControl(event.target);
    if (!control || control.disabled) return;
    const touch = event.touches[0];
    active = {control, x:touch.clientX, y:touch.clientY, time:Date.now(), moved:false};
    if (previous && previous.control === control &&
        active.time >= previous.time &&
        active.time-previous.time <= maxDelayMs && near(active,previous)) {
      swallowed = true;
      previous = null;
      blockedCount++;
      // Prevent Safari page smart-zoom before the second synthetic click.
      event.preventDefault();
    }
  };
  const onMove = event => {
    if (!active || !event.touches?.length) return;
    const t = event.touches[0];
    if (!near(active,{x:t.clientX,y:t.clientY})) {
      active.moved = true;
      previous = null;
    }
  };
  const onEnd = event => {
    if (swallowed) {
      if (event.cancelable) event.preventDefault();
      swallowed = false;
      active = null;
      return;
    }
    if (active && !active.moved && event.changedTouches?.length===1) {
      const t = event.changedTouches[0];
      if (near(active,{x:t.clientX,y:t.clientY})) {
        previous = {control:active.control,x:t.clientX,y:t.clientY,time:Date.now()};
      } else previous = null;
    } else previous = null;
    active = null;
  };
  const onCancel = () => {previous=null;active=null;swallowed=false;};
  // Explicit non-passive listeners matter on iOS Safari. Do not cancel first taps.
  document.addEventListener('touchstart',onStart,{capture:true,passive:false});
  document.addEventListener('touchmove',onMove,{capture:true,passive:true});
  document.addEventListener('touchend',onEnd,{capture:true,passive:false});
  document.addEventListener('touchcancel',onCancel,{capture:true,passive:true});
  window.creativeR27TapGuard = Object.freeze({
    installed:true,
    status:()=>({installed:true,secondTapsBlocked:blockedCount}),
    dispose(){
      document.removeEventListener('touchstart',onStart,true);
      document.removeEventListener('touchmove',onMove,true);
      document.removeEventListener('touchend',onEnd,true);
      document.removeEventListener('touchcancel',onCancel,true);
      previous=null;active=null;swallowed=false;
      window.creativeR27TapGuard=null;
    }
  });
})();
