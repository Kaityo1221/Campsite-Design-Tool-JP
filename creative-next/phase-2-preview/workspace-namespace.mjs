/* Creative Next isolated preview workspace selector.
 * Never migrate, clear or overwrite previously created preview workspaces.
 * The r10 recovery test uses a new namespace even on the same Pages origin.
 */
export const LEGACY_PREVIEW_NAMESPACE='campsite-creative-next-v1-preview';
export const R10_SAVE_NAMESPACE='campsite-creative-next-v1-save-isolated-r10';
export const R11_AUDIT_NAMESPACE='campsite-creative-next-v1-legacy-audit-r11';
export const R12_WINDING_NAMESPACE='campsite-creative-next-v1-legacy-winding-r12';
export const R13_SAFETY_NAMESPACE='campsite-creative-next-v1-iphone-safety-r13';
export const R14_UI_NAMESPACE='campsite-creative-next-v1-iphone-ui-r14';

export function namespaceForPreviewPath(pathname=''){
  if(typeof pathname==='string' &&
     /(?:^|\/)save-isolated-r10\/phase-2-preview\/(?:index\.html)?$/.test(pathname))
    return R10_SAVE_NAMESPACE;
  if(typeof pathname==='string' &&
     /(?:^|\/)legacy-audit-r11\/phase-2-preview\/(?:index\.html)?$/.test(pathname))
    return R11_AUDIT_NAMESPACE;
  if(typeof pathname==='string' &&
     /(?:^|\/)legacy-winding-r12\/phase-2-preview\/(?:index\.html)?$/.test(pathname))
    return R12_WINDING_NAMESPACE;
  if(typeof pathname==='string' &&
     /(?:^|\/)iphone-safety-r13\/phase-2-preview\/(?:index\.html)?$/.test(pathname))
    return R13_SAFETY_NAMESPACE;
  if(typeof pathname==='string' &&
     /(?:^|\/)iphone-ui-r14\/phase-2-preview\/(?:index\.html)?$/.test(pathname))
    return R14_UI_NAMESPACE;
  return LEGACY_PREVIEW_NAMESPACE;
}
