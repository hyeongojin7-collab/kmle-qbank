const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = {};
const context = vm.createContext({
  document: {addEventListener() {}}, workspace: () => state,
  loadLocal() {}, mergeBackup() {}, pool() {}, startSession() {}, persistWorkspace() {}, render() {},
  DAY: 86400000, crypto: require('node:crypto').webcrypto,
  pageHeading: (title,subtitle,actions) => actions||'', icon: () => '', metric: () => '', esc: String, dstr: String
});
const run = script => vm.runInContext(script, context);
run(fs.readFileSync(path.join(__dirname, '..', 'campus.js'), 'utf8'));
assert.match(run('vSkills()'), /skill-starter/);
assert.equal(Object.keys(state.skills).length, 0);
run("addSkillStarter('hand-rub'); addSkillStarter('hand-rub')");
assert.equal(Object.keys(state.skills).length, 1);
run("const s=campus().skills[selectedSkill], d=newSkillDraft()");
assert.ok(run("skillRubricError({...s,source:'  '})"));
assert.ok(run("skillRubricError({...s,isTemplate:false,steps:skillTemplate('osce')})"));
assert.equal(run("skillRubricError(s)"), '');
assert.ok(run("skillPracticeResult(s,d).error"));
assert.ok(run("skillPracticeResult(s,{...d,checks:[0],evidence:'peer',notes:'fingertips missed'}).error"));
assert.ok(run("skillPracticeResult(s,{...d,checks:[0],evidence:'supervised',notes:'fingertips missed',assistance:'verbal'}).error"));
run(`const a=skillPracticeResult(s,{...d,checks:[0,0,999],notes:'first attempt',setting:'clinical'}).log;
  const b=skillPracticeResult(s,{...d,evidence:'supervised',observerRole:'faculty',attested:true,focusStep:'3',setting:'clinical',notes:'missed thumb',assistance:'verbal',
    remediation:'observe thumb next time',interval:'3',checks:[0,1]}).log;
  s.logs=[b];
  const c=skillPracticeResult(s,{...d,evidence:'supervised',observerRole:'faculty',attested:true,notes:'all steps observed',assistance:'independent',
    checks:[0,1,2,3,4],targetLog:b.id,outcome:'corrected'}).log;`);
assert.equal(run('a.checked'), 1);
assert.equal(run('a.setting'), 'simulation');
assert.equal(run('b.setting'), 'clinical');
assert.equal(run('b.critical.length'), 1);
assert.equal(run('b.nextDue-b.ts'), 3 * 86400000);
assert.equal(run('c.followupOf'), run('b.id'));
run("const originalSteps=[...s.steps];s.steps[0]='revised';");
assert.equal(run('b.rubric.steps[0]'), run('originalSteps[0]'));
run(`const legacy={ts:1,checked:1,total:2,missed:['x'],notes:'',evidence:'peer'};
  const local={...s,title:'my newer rubric',updatedAt:20,logs:[legacy,legacy,a,b]};
  const backup={...s,title:'older rubric',updatedAt:10,logs:[legacy,b,c]};
  campus().skills[s.id]=local;
  const incoming={meta:{workspace:{skills:{[s.id]:backup}}}};
  mergeBackup(incoming);mergeBackup(incoming);`);
assert.equal(run('campus().skills[s.id].logs.length'), 5);
assert.equal(run('campus().skills[s.id].title'), 'my newer rubric');
assert.equal(run('new Set(campus().skills[s.id].logs.filter(l=>l.id).map(l=>l.id)).size'), 3);
assert.match(run('skillLogView(legacy)'), /관찰 수준 미기록/);
assert.doesNotMatch(run('skillLogView(legacy)'), /직접 관찰/);
console.log('PASS: OSCE rubric, evidence, settings, follow-up, versioned rubric and cross-device log union');

// A practice example and a locally verified institutional edition keep separate provenance.
run("addSkillStarter('venous-blood');const station=campus().skills[selectedSkill];");
assert.equal(run("skillRubricSnapshot(station).kind"),'training');
assert.match(run("station.source"),/WHO/);
assert.match(run("vSkills()"),/로컬 평가표 가져오기/);
run(`const text='대상자를 확인한다.\\n! 라벨을 대조한다.';
  const metadata={kind:'school',school:'학교 A',title:'채혈',source:'실습실 배부본 p.3',version:'2027-1'};
  const confirmed={...metadata,originalConfirmed:true},imported=parseLocalRubric(text,confirmed);
  const localRubric=applyLocalRubric(null,imported);
  const observation={...newSkillDraft(),evidence:'supervised',observerRole:'educator',assistance:'verbal',
    notes:'라벨을 확인하기 전 검체를 옮김',focusStep:'1',remediation:'이동 전 라벨 재대조',checks:[0]};`);
assert.throws(()=>run('parseLocalRubric(text,metadata)'),/원문/);
assert.throws(()=>run("parseLocalRubric(text,{...confirmed,version:''})"),/판본/);
assert.throws(()=>run("parseLocalRubric('{broken',confirmed)"),/JSON/);
assert.throws(()=>run("parseLocalRubric('동작\\n동작',confirmed)"),/중복/);
assert.equal(run("JSON.stringify(parseLocalRubric(JSON.stringify({...metadata,steps:imported.steps}),confirmed))===JSON.stringify(imported)"),true);
assert.ok(run('skillPracticeResult(localRubric,observation).error'));
assert.ok(run("skillPracticeResult(localRubric,{...observation,attested:true,observerRole:'peer'}).error"));
assert.ok(run("skillPracticeResult(localRubric,{...observation,attested:true,focusStep:''}).error"));
run(`const event=skillPracticeResult(localRubric,{...observation,attested:true}).log;localRubric.logs=[event];
  const edition2=applyLocalRubric(localRubric,{...imported,version:'2027-2',steps:['! 라벨을 다시 대조한다.','환자 확인 행동을 수행한다.']});
  const repeat={...newSkillDraft(),evidence:'supervised',observerRole:'faculty',assistance:'independent',attested:true,
    notes:'모형에서 관찰',checks:[0,1],targetLog:event.id,outcome:'corrected'};`);
assert.equal(run("event.correction.index===1 && event.rubric.version==='2027-1' && !!event.observerConfirmedAt"),true);
assert.ok(run('skillPracticeResult(edition2,repeat).error'));
assert.ok(run("skillPracticeResult(edition2,{...repeat,mappedStep:'0',checks:[1],remediation:'다시',focusStep:'0'}).error"));
assert.ok(run("skillPracticeResult(edition2,{...repeat,evidence:'self',mappedStep:'0'}).error"));
assert.ok(run("skillPracticeResult(edition2,{...repeat,attested:false,mappedStep:'0'}).error"));
for(const outcome of ['corrected','coaching','not_assessed']){
  const log=run(`skillPracticeResult(edition2,{...repeat,mappedStep:${outcome==='not_assessed'?"''":"'0'"},outcome:'${outcome}'}).log`);
  assert.equal(log.reassessment.originalId,run('event.id'));
  assert.equal(log.reassessment.outcome,outcome);
  assert.equal(log.reassessment.revisionChanged,true);
}
run(`const resultLog=skillPracticeResult(edition2,{...repeat,mappedStep:'0'}).log;edition2.logs.push(resultLog);
  const otherCopy={...localRubric,rubricVersion:'fork',rubricChangedAt:1,updatedAt:Date.now()+1000,logs:[event]};
  const m=mergeSkillRecords(edition2,otherCopy), duplicate=mergeSkillRecords(m,otherCopy);`);
assert.equal(run('duplicate.rubricVersion'),'2027-2');
assert.equal(run('duplicate.logs.length'),2);
assert.deepEqual(Array.from(run('duplicate.editions.map(r=>r.version).sort()')),['2027-1','2027-2','fork']);
assert.match(run('skillLogView(resultLog)'),/교정 수행을 확인/);
console.log('PASS: private TXT/JSON rubrics, version history, observer confirmation, specific action and mapped re-observation');

// Exercise the school action against the real quality gate, including ordinary pre-upgrade imports.
const handlers = [];
const dummy = {dataset:{}, addEventListener() {}, classList:{toggle() {}}, style:{setProperty() {}}};
const school = vm.createContext({
  document:{addEventListener(event,fn){if(event==='click')handlers.push(fn);},querySelector:()=>dummy,
    querySelectorAll:()=>[],documentElement:dummy,body:dummy},
  window:{addEventListener() {}},location:{hash:''},navigator:{},crypto:require('node:crypto').webcrypto,
  localStorage:{getItem:()=>null},setTimeout(){},setInterval(){},clearTimeout(){}
});
const appRoot=path.resolve(__dirname,'..');
const inline=fs.readFileSync(path.join(appRoot,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const schoolRun=script=>vm.runInContext(script,school);
schoolRun(inline);
schoolRun(fs.readFileSync(path.join(appRoot,'workspace.js'),'utf8'));
schoolRun(fs.readFileSync(path.join(appRoot,'campus.js'),'utf8'));
schoolRun(`save=async()=>{};render=()=>{};toast=()=>{};selectedBlock='b';selectedExam='e';
  campus().blocks.b={id:'b',exams:[{id:'e'}]};S.bank.school={id:'school',block_id:'b',exam_id:'e',
    school_verified:false,needs_review:true,stem:'s',options:[{label:'A',text:'x'},{label:'B',text:'y'}],answer:'A',
    option_analysis:{A:{why_best:'reason'},B:{trap:'alternate explanation'}}};`);
const verify=()=>handlers.at(-1)({target:{closest:()=>({dataset:{campus:'verify-question',id:'school'}})}});
(async()=>{
  await verify();
  assert.equal(schoolRun('isStudyEligible(S.bank.school)'),false);
  schoolRun("S.bank.school.source_refs=[{file:'lecture.pdf',section:'p.12'}]");
  await verify();
  assert.equal(schoolRun('isStudyEligible(S.bank.school)'),true);
  assert.equal(schoolRun('S.bank.school._schoolVerifiedRevision===itemRevision(S.bank.school)'),true);
  await verify();
  assert.equal(schoolRun('isStudyEligible(S.bank.school)'),false);
  console.log('PASS: school source evidence, revision-bound review and unverify via normal action');
})().catch(error=>{console.error(error);process.exitCode=1});
