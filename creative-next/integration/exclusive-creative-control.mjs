let fallbackOwnerId=0;
/* Isolated U3-E ownership handoff. Do not invoke on production DOM.
 * A physical DOM replacement discards old direct listeners. New events are
 * contained before reaching legacy delegated click listeners.
 */
export function replaceWithExclusiveCreativeControl({element,dispatch,makeAction}={}){
 if(!element?.parentNode||typeof element.cloneNode!=='function')throw new TypeError('Mounted DOM control required');
 if(typeof dispatch!=='function'||typeof makeAction!=='function')throw new TypeError('Explicit dispatch required');
 if(element.dataset?.creativeNextOwner)throw new Error('CONTROL_ALREADY_OWNED');
 const clone=element.cloneNode(true);
 clone.removeAttribute('onclick');
 clone.dataset.creativeNextOwner='isolated';
 let disposed=false,sequence=0;
 const ownerId=globalThis.crypto?.randomUUID?.()||String(++fallbackOwnerId);
 const onClick=e=>{
   e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
   if(disposed||clone.disabled)return;
   const action=makeAction();
   if(!action)return;
   const type=action.type;
   if(!['poi','area','undo','redo'].includes(type))return;
   dispatch({...action,requestId:'isolated-'+ownerId+'-'+(++sequence)});
 };
 clone.addEventListener('click',onClick,true);
 element.replaceWith(clone);
 return Object.freeze({element:clone,dispose(){disposed=true;clone.removeEventListener('click',onClick,true);clone.disabled=true}});
}
