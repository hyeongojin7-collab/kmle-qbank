// Production import, grading, correction and backup paths against an isolated learner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const node = {addEventListener(){},dataset:{}};
const context = vm.createContext({
  document:{querySelector:()=>node,querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){},scrollTo(){}},location:{hash:''},console,URL,
});
const run = code => vm.runInContext(code,context);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
run(fs.readFileSync(path.join(root,'transfer.js'),'utf8'));
run(`
  go=()=>{};toast=()=>{};render=()=>{};save=async()=>{};
  const fixture={id:'q',stem:'Original case',options:[{label:'A',text:'first'},{label:'B',text:'second'}],answer:'A',
    source_refs:[{file:'Handbook',section:'Chapter 4'}],
    option_analysis:{A:{mechanism:'The defining observation',misconception_id:'urgency'},B:{mechanism:'A competing condition'}}};
  const add = (item,remote=false)=>ingestData([{items:[item]}],remote?'repo:bank.json':'manual',{update:!remote});
  const corrected={...fixture,answer:'B',revision:2};
`);
const json = expr => JSON.parse(run('JSON.stringify('+expr+')'));
(async () => {
  run("add({...fixture,id:'draft',needs_review:true,source_refs:[],option_analysis:{}})");
  assert.equal(run("isStudyEligible(S.bank.draft)"),false);
  assert.deepEqual(json("pool({...FILTER0,mode:'new'})"),[]);
  run("startSession(['draft']);");
  assert.equal(run('session'),null);
  assert.throws(()=>run("verifyEdition('draft',strip(S.bank.draft),'Read original')"),/URL/);
  run("verifyEdition('draft',{...fixture,id:'draft'},'Checked Chapter 4')");
  assert.equal(run("isStudyEligible(S.bank.draft)"),true);
  run("add(fixture);startSession(['q']);const originalSession=JSON.parse(JSON.stringify(session));session.choice='A';session.conf=3;");
  await run('submit()');
  assert.equal(run("S.attempts[0].answerKey"),'A');
  run("S.flags.q={reason:'Key under review'};add(corrected,true)");
  assert.equal(run("S.bank.q.answer"),'B');
  assert.equal(run("S.bank.q.revision"),2);
  assert.equal(run("isCurrentAttempt(S.attempts[0])"),false);
  assert.equal(run("S.bank.q._history[S.attempts[0].revision].item.answer"),'A');
  assert.equal(run("!!S.flags.q"),true);
  assert.equal(run("isCurrentSession(originalSession)"),false);
  assert.equal(run("isStudyEligible(S.bank.q)"),false);
  assert.equal(run("S.srs.q.reps"),0);
  assert.equal(run("isDue('q',Date.now())"),true);
  assert.equal(run("statsMap().q"),undefined);
  run("verifyEdition('q',strip(S.bank.q),'Re-read section 4.1',true)");
  assert.equal(run("isStudyEligible(S.bank.q)"),true);
  assert.equal(run("add(fixture,true).dup"),1);
  assert.equal(run("add(corrected,true).updated"),0);
  assert.equal(run("S.bank.q.answer"),'B');
  run("mergeBackup({bank:{q:fixture},attempts:[{qid:'q',ts:5,correct:true,conf:3,choice:'A'}],srs:{q:{last:9999999999999,iv:99}}})");
  assert.equal(run("S.attempts.find(a=>a.ts===5).answerKey"),'A');
  assert.equal(run("isCurrentAttempt(S.attempts.find(a=>a.ts===5))"),false);
  assert.equal(run("S.srs.q.iv"),0);
  run("const answer=(correct,conf)=>({qid:'q',ts:S.attempts.length+10,correct,conf,revision:itemRevision(S.bank.q)});S.attempts.push(answer(false,3),answer(true,3),answer(true,2))");
  assert.equal(run("dangerOpen(statsMap().q)"),false);
  assert.equal(run("statsMap().q.danger"),1);
  run("S.attempts.push(answer(false,3),answer(true,2))");
  assert.equal(run("dangerOpen(statsMap().q)"),true);
  assert.equal(run("misconceptionId(fixture,'A')"),'urgency');
  run("const legacy={...fixture,id:'legacy'};add(legacy);const correction={id:'legacy',before_revision:itemRevision(normalizeItem(legacy)),before_fields:{takeaway:errataFieldFingerprint(undefined),source_refs:errataFieldFingerprint(legacy.source_refs)},changes:{takeaway:'New clinical detail',source_refs:[{url:'https://doi.org/10.1111/test'}]},revision:2};");
  assert.equal(run("applyErrata({schema:'kmle-content-errata',items:[correction]})"),1);
  assert.equal(run("applyErrata({schema:'kmle-content-errata',items:[correction]})"),0);
  run("add({...fixture,id:'custom',stem:'Locally edited'});");
  assert.equal(run("applyErrata({schema:'kmle-content-errata',items:[{...correction,id:'custom'}]})"),0);
  assert.equal(run("applyErrata({schema:'kmle-content-errata',items:[{...correction,id:'absent'}]})"),0);
  run("add({...fixture,id:'personal-source',source_refs:[{file:'Personal handbook',section:'2'}]})");
  assert.equal(run("applyErrata({schema:'kmle-content-errata',items:[{...correction,id:'personal-source'}]})"),0);
  assert.equal(run("S.bank.absent"),undefined);
  context.shippedBank=JSON.parse(fs.readFileSync(path.join(root,'data/bank.json'),'utf8'));
  context.shippedErrata=JSON.parse(fs.readFileSync(path.join(root,'data/errata.json'),'utf8'));
  assert.equal(run("ingestData([shippedBank],'repo:data/bank.json',{update:false}).added"),context.shippedBank.items.length);
  assert.equal(run("shippedBank.items.every(it=>isStudyEligible(S.bank[it.id]))"),true);
  assert.equal(run("shippedErrata.items.every(c=>!S.bank[c.id])"),true);
  assert.equal(run("applyErrata(shippedErrata)"),0);
  assert.deepEqual(context.shippedErrata.items.filter(c=>c.id.startsWith('GEN-CV9-20261107-09-')).map(c=>[c.id,c.before_revision]),[
    ['GEN-CV9-20261107-09-02','q-tk6enzy8c8'],['GEN-CV9-20261107-09-08','q-2aqtoy4ivx2']
  ]);
  for(const c of context.shippedErrata.items){
    assert.ok(!Object.hasOwn(c,'before'));
    assert.deepEqual(Object.keys(c.before_fields).sort(),Object.keys(c.changes).sort());
    assert.ok(Object.values(c.before_fields).every(v=>v==='absent'||/^v-[a-z0-9]+-[a-z0-9]+$/.test(v)));
  }
  run("delete S.bank.legacy;activeErrata={schema:'kmle-content-errata',items:[correction]}");
  assert.equal(run("add(legacy).errataApplied"),1);
  run(`
    const personal={...fixture,id:'export-audit',notes:'PRIVATE AUDIT',unexpected:'PRIVATE AUDIT',_review:{note:'PRIVATE AUDIT'},
      source_refs:[{file:'PRIVATE AUDIT',section:'p.2'}, {url:'https://doi.org/10.1111/example?access=PRIVATE#TOKEN',note:'PRIVATE AUDIT'},{url:'https://drive.google.com/PRIVATE-AUDIT'}],
      options:fixture.options.map(o=>({...o,private_note:'PRIVATE AUDIT'})),option_analysis:{...fixture.option_analysis,A:{...fixture.option_analysis.A,private_note:'PRIVATE AUDIT'}}};
    S.bank.personal=personal;
    S.bank.school={...personal,id:'school',block_id:'private',school_verified:true};
    S.bank.exam={...personal,id:'exam',exam_id:'private'};
  `);
  const published=json('publicBankItems()');
  const example=published.find(q=>q.id==='export-audit');
  assert.ok(example);
  assert.deepEqual(example.source_refs,[{url:'https://doi.org/10.1111/example'}]);
  assert.ok(!published.some(q=>q.id==='school'||q.id==='exam'));
  assert.ok(!JSON.stringify(published).includes('PRIVATE'));
  console.log('PASS: eligibility, source review, revisions, flags, old grades, compatible backup, danger state, shipped bank and targeted errata');
})().catch(error=>{console.error(error);process.exitCode=1;});
