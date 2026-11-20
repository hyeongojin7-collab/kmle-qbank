// Validate the shipped cases through the real importer, quality filter, presentation and scheduler.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const data = JSON.parse(read('data/bank.json'));
const objective = 'acute.postprocedure_hypotension';
const cases = data.items.filter(item => item.objective_id === objective);
const ids = ['GEN-POSTPROC-01', 'GEN-POSTPROC-07', 'GEN-POSTPROC-30'];
assert.deepEqual(cases.map(item => item.id), ids);
assert.deepEqual(cases.map(item => [item.variant_role, item.transfer_days]), [['index',undefined],['transfer',7],['transfer',30]]);
assert.equal(data.batch_meta.item_count, data.items.length);
for (const item of cases) {
  assert.deepEqual(item.initial_decisions.map(d=>d.id), ['danger','action','escalation']);
  assert.equal(item.options.length, 5);
  assert.deepEqual(Object.entries(item.option_analysis).filter(([,entry])=>entry.verdict==='correct').map(([label])=>label), [item.answer]);
  assert.ok(item.source_refs.length >= 2 && item.source_refs.every(r => /^https:\/\//.test(r.url) && r.section));
  assert.ok(item.model_handoff.length > 40 && item.provenance.independent_clinical_review === false);
  for (const dimension of item.initial_decisions) {
    assert.equal(dimension.choices.length, 3);
    assert.equal(new Set(dimension.choices.map(c=>c.text)).size, 3);
    assert.equal(new Set(dimension.choices.map(c=>c.id)).size, 3);
    assert.equal(dimension.choices.filter(c=>c.id===dimension.key).length, 1);
    assert.ok(dimension.criterion && dimension.prompt);
  }
}
for (const dimension of ['danger','action','escalation']) {
  const keys = cases.map(it=>it.initial_decisions.find(d=>d.id===dimension).key);
  assert.equal(new Set(keys).size, 3, 'correct position must not reveal the '+dimension+' response');
}
const element = {dataset:{},addEventListener(){}};
const ctx = vm.createContext({document:{querySelector:()=>element,querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){}}, location:{hash:''}, URL, console, data, ids});
const run = code => vm.runInContext(code, ctx);
run(read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1]);
run(read('transfer.js'));
run(`
  function workspace(){return S.meta.workspace ||= {};}
  function firstItemExposure(){return null;}
  function firstItemPresentation(){return null;}
  const imported=ingestData([data],'repo:data/bank.json',{update:false}),at=500*DAY;
`);
assert.equal(run('imported.invalid.length'),0);
assert.equal(run('ids.every(id=>isStudyEligible(S.bank[id]))'),true);
const ordinary = JSON.parse(run("JSON.stringify(pool({...FILTER0,mode:'new'}))"));
assert.ok(ordinary.includes(ids[0]));
assert.ok(!ordinary.includes(ids[1]) && !ordinary.includes(ids[2]));
for (const item of cases) {
  ctx.caseId=item.id;
  const blind=run('qBody(S.bank[caseId],{interactive:true,hideOptions:true})');
  assert.ok(blind.includes(item.stem.slice(0,10)));
  const teaching=[item.model_handoff,...item.options.map(o=>o.text),...item.initial_decisions.flatMap(d=>[d.criterion,...d.choices.map(c=>c.text)])];
  assert.ok(teaching.every(text=>!blind.includes(text)), 'blind stem must withhold keyed choices and debrief');
}
run("const ix=S.bank[ids[0]];S.attempts.push({qid:ix.id,choice:ix.answer,correct:true,conf:2,ts:at,revision:itemRevision(ix)});");
const schedule=JSON.parse(run("JSON.stringify(transferSchedule(at).filter(row=>ids.includes(row.item.id)).map(row=>[row.item.id,(row.due-at)/DAY]))"));
assert.deepEqual(schedule, [[ids[1],7],[ids[2],30]]);
console.log('PASS: 3 distinct clinical cases, blind danger/action/escalation evidence, source-backed keys, ordinary-pool exclusion and 7/30-day scheduling');
