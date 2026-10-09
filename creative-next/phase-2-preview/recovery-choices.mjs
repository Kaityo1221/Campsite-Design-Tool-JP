/* Read-only description of exactly inspected fallback generations.
 * No automatic selection, load, repair, or storage mutation is permitted. */
export function recoveryChoices(report){
 if(report?.status!=='FALLBACK'||!Array.isArray(report.candidates))return [];
 return report.candidates.filter(c=>
   (c.slot==='a'||c.slot==='b')&&Number.isSafeInteger(c.revision)&&c.revision>=1&&
   typeof c.checksum==='string'&&/^[a-f0-9]{64}$/.test(c.checksum)
 ).map(c=>Object.freeze({
   slot:c.slot,revision:c.revision,checksum:c.checksum,
   key:`${c.slot}:${c.revision}:${c.checksum}`,
   label:`第${c.revision}世代 · 保存枠${c.slot.toUpperCase()} · SHA256 ${c.checksum.slice(0,12)}…`
 }));
}
export function exactRecoveryChoice(options,key){
 return options.find(x=>x.key===key)||null;
}
