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
  const c=skillPracticeResult(s,{...d,evidence:'supervised',setting:'clinical',observerRole:'faculty',attested:true,notes:'all steps observed',assistance:'independent',
    checks:[0,1,2,3],criticalRatings:{4:'adequate'},targetLog:b.id,outcome:'corrected'}).log;`);
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
    notes:'모형에서 관찰',checks:[1],criticalRatings:{0:'adequate'},targetLog:event.id,outcome:'corrected'};`);
assert.equal(run("event.correction.index===1 && event.rubric.version==='2027-1' && !!event.observerConfirmedAt"),true);
assert.ok(run('skillPracticeResult(edition2,repeat).error'));
assert.ok(run("skillPracticeResult(edition2,{...repeat,mappedStep:'0',criticalRatings:{0:'unobserved'},remediation:'다시',focusStep:'0'}).error"));
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
// Real practice save path accepts incomplete work but never promotes it to demonstrated safety.
async function observedSafetyTests(){
  context.toast=()=>{};context.go=()=>{};
  run("addSkillStarter('venous-blood');selectedSkill='SKILL-STARTER-venous-blood';var vv=campus().skills[selectedSkill];vv.logs=[];");
  run("vv.draft={...newSkillDraft(),notes:'회상만 함',interval:'14'}");
  await run('recordSkillPractice()');
  const unknown=run('vv.logs.at(-1)');
  assert.equal(unknown.checked,0);
  assert.equal(unknown.safetySteps.filter(row=>row.status==='unobserved').length,4);
  assert.equal(unknown.nextDue-unknown.ts,86400000);
  assert.equal(run("pendingCriticalActions().filter(t=>t.skillId===vv.id).length"),4);
  run(`var witnessed={...newSkillDraft(),evidence:'supervised',observerRole:'faculty',attested:true,setting:'clinical',
    assistance:'independent',notes:'확인 전에 검체를 받음',focusStep:'0',remediation:'두 식별자를 먼저 대조',interval:'14',
    criticalRatings:{0:'coaching',3:'adequate',6:'unobserved',7:'unobserved'}};
    vv.draft={...witnessed,focusStep:'1'};`);
  assert.ok(run('skillPracticeResult(vv,vv.draft).error'));
  run('vv.draft={...witnessed};');await run('recordSkillPractice()');
  const coached=run('vv.logs.at(-1)');
  assert.equal(coached.safetySteps[0].status,'coaching');
  assert.ok(coached.nextDue<=coached.ts);
  assert.equal(run("pendingCriticalActions().find(t=>t.skillId===vv.id&&t.stepIndex===0).requiredRank"),3);
  const high=run('vv.logs.at(-1).id');
  run(`var better={...newSkillDraft(),evidence:'peer',observerRole:'peer',attested:true,setting:'simulation',assistance:'independent',
    notes:'단서 없이 모형에서 시연함',criticalRatings:{0:'adequate',3:'adequate',6:'adequate',7:'adequate'},interval:'14'};
    vv.draft=better;`);
  await run('recordSkillPractice()');
  assert.equal(run("pendingCriticalActions().find(t=>t.skillId===vv.id&&t.stepIndex===0).sourceLogId"),high);
  assert.ok(run("skillPracticeResult(vv,{...better,targetLog:vv.logs[1].id,outcome:'corrected'}).error"));
  assert.ok(run("skillPracticeResult({...vv,logs:[{...vv.logs[1],evidence:'peer',observerRole:'peer',setting:'simulation',assistance:'independent'}]},{...better,targetLog:vv.logs[1].id,outcome:'corrected'}).error"));
  run("vv.draft={...better,evidence:'supervised',observerRole:'faculty',setting:'clinical',assistance:'verbal',focusStep:'0',remediation:'단서 없이 반복'};");
  await run('recordSkillPractice()');
  assert.ok(run("vv.logs.at(-1).safetySteps.every(row=>row.status==='assisted')"));
  run("vv.draft={...better,evidence:'supervised',observerRole:'faculty',setting:'clinical',targetLog:vv.logs[1].id,outcome:'corrected'};");
  await run('recordSkillPractice()');
  assert.equal(run("pendingCriticalActions().filter(t=>t.skillId===vv.id).length"),0);
  // Old 'checked' counters and signed text lacked a separate direct-observation verdict per critical item.
  run(`campus().skills.oldSafety={id:'oldSafety',title:'old',source:'paper',type:'osce',steps:['! identity'],
    logs:[{ts:100,checked:1,total:1,notes:'ok',evidence:'supervised',observerConfirmedAt:100,assistance:'independent',rubric:{steps:['! identity']}}]};`);
  assert.equal(run("pendingCriticalActions().find(t=>t.skillId==='oldSafety').status"),'unobserved');
  // A receipt on a peri-procedure call must route to an actual SBAR observer, even if someone renamed the original station.
  run(`workspace().roundAttempts={R:{caseId:'ward-evening',attemptId:'R',finishedAt:100,
    communication:{mode:'peer',readbackAt:95,rating:'one',correction:'보고받는 사람이 요청 시점을 듣지 못함'}},
    clinic:{caseId:'clinic-return',attemptId:'clinic',finishedAt:110}};
    campus().skills[HANDOFF_SKILL_ID]={...vv,id:HANDOFF_SKILL_ID,steps:['! unrelated'],type:'osce'};
    var countBefore=Object.keys(campus().skills).length;`);
  assert.equal(run("handoffObservationTarget('clinic')"),null);
  assert.equal(run("handoffObservationTarget().status"),'coaching');
  assert.equal(run("Object.keys(campus().skills).length"),run('countBefore'));
  assert.ok(run("openHandoffObservation('R')"));
  run("var sb=campus().skills[selectedSkill];");
  assert.equal(run("sb.type"),'communication');
  assert.equal(run("sb.draft.handoffAttempt"),'R');
  assert.ok(run("sb.steps[handoffObservationTarget().stepIndex].includes('지원')"));
  run(`var receive={...sb.draft,evidence:'peer',observerRole:'peer',attested:true,assistance:'independent',notes:'재보고 직접 관찰',
    criticalRatings:{3:'adequate'},heardRisk:'heard',repeatRisk:'진행하는 쇼크',heardRequest:'heard',repeatRequest:'즉시 회복실에 와 주세요'};sb.draft=receive;`);
  await run('recordSkillPractice()');
  assert.equal(run("handoffObservationTarget('R').status"),'coaching');
  assert.ok(run("skillPracticeResult(sb,{...receive,repeatRisk:''}).error"));
  assert.ok(run("skillPracticeResult(sb,{...receive,heardRequest:'missed',repeatRequest:''}).error"));
  assert.equal(run("skillPracticeResult(sb,{...receive,heardRequest:'missed',repeatRequest:'',remediation:'다음 행동과 시점을 다시 확인',focusStep:'3'}).log.safetySteps[0].status"),'coaching');
  run("sb.draft={...receive,evidence:'supervised',observerRole:'resident',setting:'simulation'};");
  await run('recordSkillPractice()');
  assert.equal(run("handoffObservationTarget('R').status"),'observed-independent');
  assert.equal(run("handoffObservationTarget('R').setting"),'simulation');
  run(`var sbBackup=JSON.parse(JSON.stringify(sb)),lastId=sb.logs.at(-1).id;
    sb.logs=sb.logs.slice(0,1);campus().skills[sb.id]=mergeSkillRecords(sb,sbBackup);
    campus().skills[sb.id]=mergeSkillRecords(campus().skills[sb.id],sbBackup);`);
  assert.equal(run("campus().skills[sb.id].logs.filter(l=>l.id===lastId).length"),1);
  assert.equal(run("handoffObservationTarget('R').status"),'observed-independent');
  console.log('PASS: per-step observation, honest incomplete sessions, deadline caps, evidence hierarchy, legacy migration, targeted handoff and cross-device recovery');
}
observedSafetyTests().catch(error=>{console.error(error);process.exitCode=1});

async function writtenObservationTest(){
  const noop=()=>{},node={addEventListener:noop,dataset:{},classList:{toggle:noop},style:{setProperty:noop}};
  const ctx=vm.createContext({document:{addEventListener:noop,querySelector:()=>node,querySelectorAll:()=>[],body:node,documentElement:node},
    window:{addEventListener:noop,scrollTo:noop},location:{hash:''},navigator:{},crypto:require('node:crypto').webcrypto,
    setInterval:noop,setTimeout:noop,clearTimeout:noop});
  const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8'), evalInApp=js=>vm.runInContext(js,ctx);
  evalInApp(read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1]);
  for(const script of ['first-decisions.js','transfer.js','workspace.js','campus.js'])evalInApp(read(script));
  ctx.patient=JSON.parse(read('data/bank.json')).items.find(q=>q.objective_id==='acute.postprocedure_hypotension'&&q.initial_decisions);
  evalInApp(`go=()=>{};render=()=>{};toast=()=>{};save=async()=>{};persistWorkspace=()=>{};persistSession=()=>{};
    ingestData([{items:[patient]}],'manual');startSession([patient.id]);vQuestion();
    session.reasoning='My pre-choice assessment';freezePrediction();
    session.decisionPicks=Object.fromEntries(patient.initial_decisions.map(r=>[r.id,r.id==='escalation'?r.choices.find(c=>c.id!==r.key).id:r.key]));
    lockClinicalJudgment();session.choice=patient.answer;session.conf=3;`);
  await evalInApp('submit()');
  evalInApp("const submitted=S.attempts[0], origin=writtenHandoffId(submitted)");
  assert.equal(evalInApp('Object.keys(workspace().roundAttempts||{}).length'),0);
  assert.equal(evalInApp('handoffObservationTarget().sourceAttemptId'),evalInApp('origin'));
  assert.equal(evalInApp('openHandoffObservation(origin)'),true);
  assert.ok(evalInApp('vSkills().includes(patient.stem)&&vSkills().includes("모의 전화 보고")'));
  evalInApp(`const station=campus().skills[selectedSkill];station.draft={...station.draft,evidence:'peer',observerRole:'peer',
    attested:true,assistance:'independent',notes:'receiver confirmed the actual phone call',criticalRatings:{3:'adequate'},
    heardRisk:'heard',repeatRisk:'Persistent fall in blood pressure',heardRequest:'heard',repeatRequest:'Come now to assist'};`);
  assert.ok(evalInApp("skillPracticeResult(station,{...station.draft,attested:false}).error"));
  assert.equal(evalInApp("skillPracticeResult(station,{...station.draft,heardRequest:'unobserved',repeatRequest:''}).log.handoffObservation.status"),'unobserved');
  await evalInApp('recordSkillPractice()');
  assert.equal(evalInApp('handoffObservationTarget(origin).status'),'observed-independent');
  assert.equal(evalInApp('station.logs[0].handoffObservation.source.revision'),evalInApp('submitted.revision'));
  assert.equal(evalInApp('station.logs[0].handoffObservation.receiverRequest.text'),'Come now to assist');
  assert.equal(evalInApp("writtenPathwayEvidence().gaps.some(g=>g.id==='escalation')"),true);
  evalInApp(`const earlier=submitted.ts-10000,allMet={...submitted,ts:earlier,clinicalJudgment:{...submitted.clinicalJudgment,lockedAt:earlier,
    decisions:submitted.clinicalJudgment.decisions.map(d=>({...d,correct:true}))}};
    S.attempts.push(allMet);const textId=writtenHandoffId(allMet);`);
  assert.equal(evalInApp('handoffObservationTarget(textId)'),null);
  evalInApp("saveFirstTextReview(allMet,'instructor',{danger:'met',action:'met',escalation:'missed'},true)");
  assert.equal(evalInApp('handoffObservationTarget(textId).source.reviewRole'),'instructor');
  assert.equal(evalInApp('handoffObservationTarget(textId).requiredRank'),2);
  assert.equal(evalInApp('openHandoffObservation(textId)'),true);
  evalInApp(`station.draft={...station.draft,evidence:'supervised',setting:'clinical',observerRole:'faculty',
    attested:true,assistance:'independent',notes:'receiver confirmed',criticalRatings:{3:'adequate'},heardRisk:'heard',
    repeatRisk:'I heard the deterioration',heardRequest:'heard',repeatRequest:'I heard the immediate call for help'};`);
  await evalInApp('recordSkillPractice()');
  assert.equal(evalInApp('handoffObservationTarget(textId).setting'),'simulation');
  assert.equal(evalInApp('handoffObservationTarget(textId).status'),'observed-independent');
  evalInApp(`const mock={...submitted,ts:earlier-10,mode:'mock'},skipped={...submitted,ts:earlier-20,skipped:true};
    S.attempts.push(mock,skipped);S.bank[patient.id].stem='replacement edition, different scenario';`);
  assert.equal(evalInApp('handoffObservationTarget(writtenHandoffId(mock))'),null);
  assert.equal(evalInApp('handoffObservationTarget(writtenHandoffId(skipped))'),null);
  assert.equal(evalInApp('handoffObservationTarget(origin).sourceContext===patient.stem'),true);
  assert.notEqual(evalInApp('writtenHandoffId({...submitted,revision:"new edition"})'),evalInApp('origin'));
  // A skills-only backup still carries the original vignette and the receiver's actual readback.
  evalInApp(`const restored=JSON.parse(JSON.stringify(station));S.attempts=[];delete S.bank[patient.id];
    campus().skills[selectedSkill]=mergeSkillRecords({},restored);`);
  assert.equal(evalInApp('handoffObservationTarget(origin).sourceContext===patient.stem'),true);
  assert.equal(evalInApp('handoffObservationTarget(origin).status'),'observed-independent');
  console.log('PASS: keyed or reviewed written escalation, original case SBAR with no prior round, verified readback and durable edition-specific evidence');
}
writtenObservationTest().catch(error=>{console.error(error);process.exitCode=1});

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
