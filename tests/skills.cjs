const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = {};
const context = vm.createContext({
  document: {addEventListener() {}}, workspace: () => state,
  loadLocal() {}, mergeBackup() {}, pool() {}, startSession() {}, persistWorkspace() {}, render() {},
  DAY: 86400000, crypto: require('node:crypto').webcrypto,
  pageHeading: () => '', icon: () => '', metric: () => '', esc: String, dstr: String
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
  const b=skillPracticeResult(s,{...d,evidence:'supervised',setting:'clinical',notes:'missed thumb',assistance:'verbal',
    remediation:'observe thumb next time',interval:'3',checks:[0,1]}).log;
  s.logs=[b];
  const c=skillPracticeResult(s,{...d,evidence:'supervised',notes:'all steps observed',assistance:'independent',
    checks:[0,1,2,3,4],followup:true}).log;`);
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
