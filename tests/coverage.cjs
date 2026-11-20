const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) elements.set(selector,{dataset:{},addEventListener(){},setAttribute(){},querySelector(){return null;}});
  return elements.get(selector);
}
const context = vm.createContext({
  document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){},
    body:{classList:{toggle(){}}}, documentElement:{style:{setProperty(){}}}},
  window:{scrollTo(){},addEventListener(){}}, location:{hash:'#insights'},
  localStorage:{setItem(){},getItem(){return null;}},setInterval(){},console
});
const run = code=>vm.runInContext(code,context);
const inline=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
run(inline);
run(fs.readFileSync(path.join(root,'transfer.js'),'utf8'));
run(fs.readFileSync(path.join(root,'workspace.js'),'utf8'));
context.template=JSON.parse(fs.readFileSync(path.join(root,'data/bank.json'),'utf8')).items[0];
run(`
  const vSchool=()=>'',vSkills=()=>'',vRounds=()=>'',vMock=()=>'';
  persistSession=()=>{};tickTimer=()=>{};
  let nextTime=100;
  function bankItem(id,system,objective,extra={}) {
    S.bank[id]={...template,id,system,subject:'내과',subtopic:'시험 주제',variant_role:'index',
      objective_id:objective,related_systems:[],...extra};
  }
  function log(id,correct,extra={}) {
    const q=S.bank[id];
    S.attempts.push({qid:id,ts:++nextTime,choice:correct?q.answer:q.options.find(o=>o.label!==q.answer).label,
      correct,revision:itemRevision(q),priorExposureAt:null,conf:3,...extra});
  }
  uiReady=true;
`);
function actualPage() {run("go('insights')");return element('#app').innerHTML;}
run("bankItem('renal','신장','r0',{related_systems:['순환기']});for(const c of [false,true,true,true,true]) log('renal',c)");
let html=actualPage();
assert.match(html,/분과 간 비교 자료 부족/);
assert.doesNotMatch(html,/가장 약한|약점으로 판정/);
const renalRow=html.split('<tr').find(x=>x.includes('> 신장<')||x.includes('>신장<'));
assert.ok(renalRow || html.includes('신장'), 'renal category rendered');
assert.match(html,/0 \/ 1<\/td><td>4<\/td><td>0 \/ 1/);
assert.match(html,/0 \/ 1<\/div><div class="l">문항 첫 제출/);

run(`
  bankItem('same-family','신장','r0');log('same-family',true);
  bankItem('old','신장','');log('old',true,{priorExposureAt:undefined});
  bankItem('unknown','신장','r-unknown');log('unknown',false,{priorExposureAt:undefined});
  bankItem('seen','신장','r-seen');log('seen',true,{priorExposureAt:1});
  bankItem('held','신장','r-held',{variant_role:'transfer'});log('held',true);
  bankItem('school','외과','school',{block_id:'campus',school_verified:true});log('school',true);
  bankItem('flagged','신장','r-flag');S.flags.flagged={reason:'audit'};log('flagged',true);
  bankItem('mock','신장','r-mock');log('mock',true,{mode:'mock'});log('mock',true);
  bankItem('skip','신장','r-skip');log('skip',false,{skipped:true});
  bankItem('outdated','신장','r-past');log('outdated',true,{revision:'prior'});
  bankItem('unanswered','신장','r-unanswered');log('unanswered',false,{choice:null});
  bankItem('sibling','신장','r-seen-sibling');workspace().presentations={sibling:1};
  bankItem('new-sibling','신장','r-seen-sibling');log('new-sibling',true);
`);
assert.equal(run("specialtyEvidence(Object.values(S.bank)).byItem.size"),8);
assert.equal(run("[...specialtyEvidence(Object.values(S.bank)).byItem.values()].filter(x=>x.familyFirst).length"),1);
assert.match(actualPage(),/분과 간 비교 자료 부족/);
run("for(let i=1;i<=4;i++){bankItem('r'+i,'신장','r'+i);log('r'+i,true)}");
assert.match(actualPage(),/분과 간 비교 자료 부족/);
run("for(let i=1;i<=5;i++){bankItem('c'+i,'순환기','c'+i);log('c'+i,true)}");
html=actualPage();
assert.match(html,/비교 가능한 목표 초회 기록/);
assert.ok(html.includes('신장 4 / 5') && html.includes('순환기 5 / 5'));
assert.doesNotMatch(html,/가장 약한/);
console.log('PASS: Insights route separates 1 renal case / 5 attempts, family coverage, eligibility, edition and scope');
