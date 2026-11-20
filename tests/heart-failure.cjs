// Optional original pack path runs the same matching/migration checks against a private local copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const errata = JSON.parse(read('data/errata.json'));
const changes = errata.items.filter(c=>/^GEN-CV9-20261107-03-\d{2}$/.test(c.id));
const expectedIds = Array.from({length:20},(_,i)=>'GEN-CV9-20261107-03-'+String(i+1).padStart(2,'0'));
assert.deepEqual(changes.map(c=>c.id).sort(),expectedIds);
assert.equal(new Set(changes.map(c=>c.before_revision)).size,20);
const node = {addEventListener(){},dataset:{}};
const ctx = vm.createContext({
  document:{querySelector:()=>node,querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){},scrollTo(){}}, location:{hash:'',protocol:'https:'},console,URL
});
const run = code=>vm.runInContext(code,ctx);
run(read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1]);
ctx.errata=errata;
ctx.remoteBank=JSON.parse(read('data/bank.json'));
run(`save=async()=>{};toast=()=>{};render=()=>{};
  fetch=async path=>({ok:path!=='bank.json',json:async()=>path==='data/bank.json'?remoteBank:errata});`);

function auditLabels(items){
  const longest={first:[],exclusive:[],among:[]};
  for(const it of items){
    const lens=it.options.map(o=>[...o.text.trim()].length);
    const max=Math.max(...lens);
    const winners=it.options.filter((o,i)=>lens[i]===max).map(o=>o.label);
    if(winners[0]===it.answer)longest.first.push(it.id);
    if(winners.includes(it.answer)){
      longest.among.push(it.id);
      if(winners.length===1)longest.exclusive.push(it.id);
    }
    assert.deepEqual(it.options.map(o=>o.label),['A','B','C','D','E'],it.id);
    assert.equal(new Set(it.options.map(o=>o.text.trim())).size,5,it.id+' five distinct choices');
    for(const opt of it.options){
      const rationale=it.option_analysis[opt.label],key=opt.label===it.answer;
      assert.equal(rationale.verdict,key?'correct':'incorrect',it.id+' '+opt.label);
      assert.ok((key?rationale.why_best||rationale.mechanism:rationale.trap||rationale.mechanism)?.trim(),it.id+' '+opt.label);
    }
  }
  return longest;
}

(async()=>{
  for(const patch of changes){
    assert.ok(!Object.hasOwn(patch,'before'));
    assert.deepEqual(Object.keys(patch.before_fields).sort(),Object.keys(patch.changes).sort(),patch.id);
    assert.ok(patch.reason?.trim(),patch.id);
    assert.ok(patch.changes.source_refs.some(ref=>/^https?:\/\//.test(ref.url)&&ref.section?.trim()),patch.id);
    const keyed=Object.entries(patch.changes.option_analysis).filter(([,v])=>v.verdict==='correct');
    assert.equal(keyed.length,1,patch.id);
    const [answer,analysis]=keyed[0];
    auditLabels([{id:patch.id,options:patch.changes.options,answer,option_analysis:patch.changes.option_analysis}]);
    for(const field of ['KEY','HBM','reasoning_skeleton','Textbook Floor','적용 경계','가장 강한 경쟁 선택지']){
      assert.ok(typeof analysis[field]==='string'&&analysis[field].trim(),patch.id+' '+field);
    }
  }
  await run('syncRemote()');
  assert.ok(expectedIds.every(id=>!run('S.bank['+JSON.stringify(id)+']')),'No new HF cases from errata alone');

  if(process.argv[2]){
    const originals=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    ctx.originals=Array.isArray(originals)?originals:originals.items;
    assert.deepEqual(ctx.originals.map(x=>x.id).sort(),expectedIds);
    const before=auditLabels(ctx.originals);
    assert.equal(before.first.length,11);
    assert.equal(before.exclusive.length,11);
    assert.equal(before.among.length,14);
    run(`activeErrata=null;ingestData([{items:originals}],'local pack');
      for(const item of originals){
        S.attempts.push({qid:item.id,ts:1000,choice:item.answer,correct:true,conf:3});
        S.srs[item.id]={last:1000,iv:30,due:1000+30*DAY};
      }
      S.flags[originals[0].id]={reason:'learner flag',ts:1000};`);
    await run('syncRemote()');
    const revised=JSON.parse(run('JSON.stringify(originals.map(it=>S.bank[it.id]))'));
    const after=auditLabels(revised);
    for(const [i,it] of revised.entries()){
      const original=ctx.originals[i],patch=changes.find(x=>x.id===it.id);
      assert.equal(it.revision,patch.revision,it.id);
      assert.equal(it.answer,original.answer,it.id+' key');
      assert.ok(it.learning_objective?.trim()&&it.learning_objective!==original.learning_objective,it.id+' revised objective');
      const comparator=it.author_review?.closest_competing_option;
      assert.ok(comparator!==it.answer&&it.options.some(o=>o.label===comparator),it.id+' valid competing option');
      const texts=JSON.stringify([it.option_analysis,it.learning_objective,it.author_review,it.takeaway,it.causal_chain]);
      for(const previous of original.options){
        if([...previous.text].length<14||it.options.some(o=>o.text===previous.text))continue;
        assert.ok(!texts.includes(previous.text),it.id+' explanation quotes a retired full-length option');
      }
      assert.ok(it._history[patch.before_revision],it.id+' history');
      assert.ok(!run('isStudyEligible(S.bank['+JSON.stringify(it.id)+'])'),it.id+' pending human review');
      ctx.caseId=it.id;
      assert.ok(run('S.attempts.some(a=>a.qid===caseId&&!isCurrentAttempt(a)&&a.answerKey===S.bank[caseId].answer)'));
      assert.equal(run('S.srs[caseId].reps'),0);
      for(const key of Object.keys(patch.changes))assert.deepEqual(it[key],patch.changes[key],it.id+' '+key);
    }
    assert.ok(run('S.flags[originals[0].id]'));
    assert.equal(run('applyErrata(errata)'),0,'Repeat application');
    run(`S.bank={};S.srs={};S.attempts=[];activeErrata=null;
      const edited={...originals[0],stem:originals[0].stem+' [local]'},only=originals[1];
      ingestData([{items:[edited,only]}],'restore');`);
    await run('syncRemote()');
    assert.equal(run('S.bank[edited.id].stem'),ctx.originals[0].stem+' [local]');
    assert.equal(run('S.bank[edited.id].revision'),ctx.originals[0].revision,'Locally edited version preserved');
    assert.equal(run('Object.values(S.bank).filter(it=>it.id.startsWith("GEN-CV9-20261107-03-")).length'),2);
    assert.equal(run('S.bank[only.id].revision'),changes.find(c=>c.id===ctx.originals[1].id).revision);
    run(`S.bank={};S.attempts=[];S.srs={};S.flags={};
      ingestData([{items:originals.slice(0,3)}],'manual:after-sync');`);
    assert.equal(run('Object.values(S.bank).filter(it=>it.revision===2).length'),3);
    run(`const restored=originals.slice(3,5);
      mergeBackup({bank:Object.fromEntries(restored.map(it=>[it.id,it])),attempts:[]});`);
    assert.equal(run('Object.values(S.bank).filter(it=>it.revision===2).length'),5);
    console.log('Matched local HF originals: 20/20. First, exclusive, any-longest (IDs)',JSON.stringify({before,after}));
  }
  console.log('PASS: 20 targeted HF corrections; no private originals or unsolicited cases in the public bank');
})().catch(error=>{console.error(error);process.exitCode=1;});
