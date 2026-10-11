const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..'),BASE='7ef98ad4250af8f2d1a1458d289d3ed1989a8da7';
const allowed=p=>p.startsWith('creative-next/original-ui-r31-b3-b4/')||p.startsWith('creative-next/qa/r31-b3-b4/')||p==='creative-next/R31_B3_B4_REPORT.md'||p==='.github/workflows/creative-next-r31-b3-b4.yml';
test('B2 PASS, A/B1, shared engine, legacy UI/data, main snapshot: additions only in dedicated scope',()=>{
 const changes=execFileSync('git',['diff','--name-status',BASE,'--'],{cwd:ROOT,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 for(const line of changes){const [status,file]=line.split('\t');assert.equal(status,'A',line);assert(allowed(file),line);}
 const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:ROOT,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);assert(untracked.every(allowed),untracked.join('\n'));
});
