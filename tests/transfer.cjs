const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
const run = script => vm.runInContext(script, ctx);
run(`
  const DAY=86400000, app={addEventListener(){}}, state={}, seen={};
  const workspace=()=>state, firstItemExposure=id=>seen[id]??null, firstItemPresentation=firstItemExposure, lastItemExposure=firstItemExposure;
  const itemRevision=item=>item.rev??1, isStudyEligible=item=>!!item&&!item.pending;
  const isCurrentAttempt=a=>a.revision===itemRevision(S.bank[a.qid]);
  const dstr=ts=>new Date(ts).toISOString().slice(0,10), esc=s=>s;
  const statsMap=()=>({}), campus=()=>({skills:{}}), dangerOpen=()=>false;
  const at=2000*DAY, index={id:'a',objective_id:'goal',variant_role:'index'};
  const seven={id:'b',objective_id:'goal',variant_role:'transfer',transfer_days:7};
  const thirty={...seven,id:'c',transfer_days:30};
  const S={bank:{a:index,b:seven,c:thirty},attempts:[]};
  let session=null,cancel=false;
  function startSession(ids,blind){ if(!cancel)session={ids,recallFirst:blind}; }
  let saved=0; function persistSession(){saved++;} function render(){}
`);
run(fs.readFileSync(path.join(__dirname,'../transfer.js'),'utf8'));
const results = code => JSON.parse(run('JSON.stringify('+code+')'));
assert.deepEqual(results('transferSchedule(at).map(r=>r.due)'),[null,null]);
run('S.attempts.push({qid:"a",ts:at,revision:0})');
assert.deepEqual(results('transferSchedule(at).map(r=>r.due)'),[null,null]);
run('S.attempts.push({qid:"a",ts:at,revision:1})');
assert.deepEqual(results('transferSchedule(at).map(r=>r.due)'),[2007*86400000,2030*86400000]);
run('startTransfer(at+6*DAY)'); assert.equal(run('session'),null);
run('cancel=true;startTransfer(at+7*DAY)'); assert.equal(run('state.transferStarts'),undefined);
run('cancel=false;startTransfer(at+40*DAY)');
assert.equal(run('session.recallFirst'),true);
assert.equal(run('session.transferAssessment.qid'),'b');
assert.equal(run('state.transferStarts.b.targetDays'),7);
assert.equal(run('isReservedTransfer(seven)'),false);
assert.equal(run('transferSchedule(at+40*DAY)[0].due'),(2000+47)*86400000);
run('seen.c=at+41*DAY'); assert.equal(run('transferSchedule(at+50*DAY).length'),0);
console.log('PASS: held-out transfers, dated eligibility, abandoned/revealed items, revision and spacing');
