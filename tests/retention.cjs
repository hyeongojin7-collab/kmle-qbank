// Run the shipped scripts, and replace only DOM rendering and storage I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const element = {dataset:{}, addEventListener() {}, querySelector() {return null;}};
const context = vm.createContext({
  document:{querySelector:()=>element, querySelectorAll:()=>[], addEventListener(){}},
  window:{addEventListener(){},scrollTo(){}}, location:{hash:''},
  setInterval(){},setTimeout(){},clearTimeout(){},console,confirm:()=>true
});
const run = code => vm.runInContext(code,context);
const read = name => fs.readFileSync(path.join(root,name),'utf8');
run(read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1]);
run(read('transfer.js'));
run(read('workspace.js'));
run(`render=()=>{};save=async()=>{};persistWorkspace=async()=>{};roundRecords=()=>({});
  const specimen=id=>({id,stem:'case',question:'decision',options:[{label:'A',text:'A'},{label:'B',text:'B'}],
    answer:'A',source_refs:[{file:'Guide',section:'1'}],option_analysis:{A:{mechanism:'a'},B:{trap:'b'}}});
  S.bank.one=specimen('one');S.bank.two=specimen('two');
  const initial=1000000000;
  const score=(ts,extra={})=>({qid:'one',ts,conf:3,correct:true,...extra});
`);

(async()=>{
  run(`for(let i=0;i<6;i++)updateSrs('one',score(initial+i*1000));`);
  assert.equal(run('S.srs.one.due'),run('initial+3*DAY'));
  assert.equal(run('S.srs.one.iv'),3);
  run(`updateSrs('one',score(initial+3*DAY));`);
  assert.equal(run('S.srs.one.iv'),8);
  run(`S.srs={};updateSrs('one',score(initial,{correct:false}));updateSrs('one',score(initial+600000,{priorExposureAt:initial}));`);
  assert.equal(run('S.srs.one.iv'),1);
  run(`S.srs={};S.attempts=[score(initial)];recoverLearningState({ans:{one:score(initial)}});recoverLearningState(null);`);
  assert.equal(run('S.attempts.length'),1);
  assert.equal(run('S.srs.one.reps'),1);
  assert.equal(run('S.srs.one.due'),run('initial+3*DAY'));

  run(`S.srs={};S.attempts=[];session={ids:['one','two'],i:0,ans:{},qt:Date.now(),recallFirst:true,reasoning:'initial hypothesis',preConfidence:3};
    freezePrediction();session.reasoning='revised hypothesis';session.choice='A';session.conf=3;
    session.predictionMatch='changed';session.predictionChoice='A';session.transferAssessment={qid:'one',targetDays:7};`);
  await run('submit()');
  const actual=JSON.parse(run('JSON.stringify(S.attempts[0])'));
  assert.equal(actual.prediction.text,'initial hypothesis');
  assert.equal(actual.prediction.conf,3);
  assert.equal(actual.prediction.mode,'written');
  assert.equal(actual.reasoning,'revised hypothesis');
  assert.equal(actual.predictionMatch,'changed');
  assert.equal(actual.transferAssessment.targetDays,7);
  assert.equal(actual.priorExposureAt,null);
  assert.equal(run('S.srs.one.iv'),1);
  assert.equal(run('firstItemExposure("one")'),actual.ts);
  await run('submit()');
  assert.equal(run('S.attempts.length'),1);
  run(`next();session.preConfidence=2;freezePrediction('oral');session.choice='A';session.conf=3;`);
  await run('submit()');
  assert.equal(run('S.attempts[1].prediction.mode'),'oral');
  assert.equal(run('S.attempts[1].prediction.text'),'');
  assert.equal(run('S.attempts[1].transferAssessment'),null);
  assert.equal(run('S.srs.two.iv'),1);

  run(`S.bank.unscored=specimen('unscored');
    session={ids:['unscored'],i:0,ans:{},qt:Date.now(),recallFirst:true};freezePrediction();
    skip(true);`);
  assert.equal(run('session.prediction.mode'),'omitted');
  assert.equal(run('firstItemExposure("unscored")>0'),true);
  assert.equal(run('S.attempts.some(a=>a.qid==="unscored")'),false);
  assert.equal(run('pool({...FILTER0,mode:"new"}).includes("unscored")'),false);
  run(`workspace().exposures.old={first:100,last:200};mergeBackup({meta:{workspace:{exposures:{old:{first:50,last:300}},transferStarts:{z:{openedAt:1}},roundAttempts:{abc:{updatedAt:3}}}}});`);
  assert.equal(run('firstItemExposure("old")'),50);
  assert.equal(run('lastItemExposure("old")'),300);
  assert.equal(run('workspace().transferStarts.z.openedAt'),1);
  assert.equal(run('workspace().roundAttempts.abc.updatedAt'),3);
  run(`workspace().transferStarts.same={openedAt:100};
    mergeBackup({meta:{workspace:{transferStarts:{same:{openedAt:80}}}}});
    mergeBackup({meta:{workspace:{transferStarts:{same:{openedAt:120}}}}});`);
  assert.equal(run('workspace().transferStarts.same.openedAt'),80);
  run(`session=null;workspace().resume=null;
    const incomingResume={ids:['one'],i:0,ans:{},done:false,reasoning:'imported draft'};
    mergeBackup({meta:{workspace:{resume:incomingResume}}});`);
  assert.equal(run('session.reasoning'),'imported draft');
  assert.equal(run('workspace().resume.reasoning'),'imported draft');
  run(`session.reasoning='keep local work';mergeBackup({meta:{workspace:{resume:incomingResume}}});`);
  assert.equal(run('session.reasoning'),'keep local work');
  run(`session=null;workspace().resume=null;
    mergeBackup({meta:{workspace:{resume:{...incomingResume,itemRevisions:{one:'obsolete'}}}}});`);
  assert.equal(run('session'),null);
  run(`S.bank.viewed=specimen('viewed');markItemPresentation('viewed',initial);markItemPresentation('viewed',initial+100);
    mergeBackup({meta:{workspace:{presentations:{viewed:initial-100}}}});`);
  assert.equal(run('firstItemPresentation("viewed")'),run('initial-100'));
  assert.equal(run('lastItemExposure("viewed")'),null);
  assert.equal(run('firstItemPresentation("z")'),1);
  run(`S.attempts=[
    score(initial,{recallFirst:true,delayDays:8,prediction:{mode:'written'},predictionMatch:'same'}),
    score(initial+1,{recallFirst:true,delayDays:14,prediction:{mode:'written'},predictionMatch:'changed'}),
    score(initial+2,{recallFirst:true,delayDays:10,prediction:{mode:'oral'}}),
    score(initial+3,{recallFirst:true,delayDays:35,prediction:{mode:'written'},predictionMatch:'same'}),
    score(initial+4,{recallFirst:true,delayDays:17,prediction:{mode:'written'},predictionMatch:'same',revision:'outdated'}),
    score(initial+5,{recallFirst:false,mode:'mock',delayDays:19})
  ];`);
  assert.match(run('retentionInsights()'),/7–29일<\/td><td>1 \/ 2<\/td><td>1<\/td>/);
  assert.match(run('retentionInsights()'),/30일 이상<\/td><td>1 \/ 1<\/td><td>0<\/td>/);
  console.log('PASS: spaced vs early practice, recovery, frozen predictions, exposure, backup merge');
})().catch(error=>{console.error(error);process.exitCode=1;});
