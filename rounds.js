'use strict';

// Each encounter is authored as a sequence of clinical decisions. Only requested
// findings and consequences of actions taken are rendered during the encounter.
const ROUND_SOURCES = [
  ['2025 ESC 심근염·심막염 진료지침', 'https://doi.org/10.1093/eurheartj/ehaf192'],
  ['2024 EHRA/HRS 심방세동 절제술 합의문 · Cardiac tamponade', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11632303/']
];
const ROUNDS = [{
  id:'recovery-unit', title:'회복실에서 온 전화', setting:'시술 후 회복실',
  opening:'“선생님, 한 시간 전에 심방세동 절제술을 마친 62세 환자예요. 메스껍다고 하시더니 식은땀이 나요. 아까는 대화를 잘하셨어요.”',
  vitals:['BP 84/58 ← 128/76 mmHg','HR 112/min','SpO₂ 96% · 실내 공기'],
  context:'시술팀에 연락했고 모니터와 정맥로를 확보했습니다. 팀이 도착하는 동안 침상에서 평가하세요.',
  findings:[
    ['환자에게 경과 묻기','갑자기 숨이 차고 어지러워졌다. 날카로운 흉통이나 허리 통증은 없다.'],
    ['관류와 경정맥 진찰','손끝이 차고 요골맥이 약하다. 상체를 올려도 경정맥이 팽창해 있다. 양쪽 폐음은 깨끗하다.'],
    ['천자 부위와 복부 진찰','서혜부 드레싱은 건조하고 복부는 부드럽다. 겉에서 보이는 출혈은 없다. 이 소견만으로 후복막 출혈을 배제할 수는 없다.'],
    ['12유도 심전도 확인','동성빈맥. 새 ST분절 상승이나 고도 방실차단은 없다.'],
    ['침상 심초음파 요청','시술 전에는 없던 13 mm 심낭액이 보인다. 우심실 자유벽이 이완기 초기에 안으로 밀려 들어간다. 좌심실 수축은 활발하고 하대정맥은 팽창해 있다.']
  ],
  decision:'지금 시술팀에 무엇을 요청하겠습니까?',
  actions:[
    ['수액 반응을 먼저 재평가','결정질액 소량 투여 직후 수축기압이 94까지 올랐다가 다시 80으로 떨어진다. 정맥환류 증가가 잠시 충만을 도왔지만 쇼크는 지속된다. 팀에 원인 교정을 요청하세요.'],
    ['침상 초음파로 확인하며 응급 배액 준비','시술팀이 심초음파로 심장눌림을 확인하고 영상 유도하에 혈성 심낭액을 배액했다. 혈압은 108/70, 환자는 다시 또렷하게 대답한다. 배액관은 유지 중이다.'],
    ['출혈원을 찾는 복부 CT를 우선 요청','이송 준비 중 수축기압이 78로 떨어진다. 팀이 이송을 보류하고 침상에서 쇼크 원인을 확인하자고 한다. 후복막 출혈도 가능하지만 지금은 이동이 위험하다.']
  ], best:1, reassess:'혈압이 올랐습니다. 다음 30분에 무엇을 관찰하고, 어떤 변화가 오면 다시 팀을 부르겠습니까?',
  audience:'당직의에게 지금 상황과 요청을 두 문장으로 인계하세요.',
  model:'“절제술 직후 저혈압과 새 심낭액, 우심실 이완기 허탈이 있어 배액했고 혈압이 회복됐습니다. 재저류나 지속 출혈을 감시하도록 혈압·관류·배액량을 추적하고 심초음파 재평가를 부탁드립니다.”',
  key:'작은 공간에 혈액이 빠르게 차면 심낭 압력이 급상승한다. 심근이 잘 수축해도 이완기에 충분히 채우지 못하면 박출량이 감소한다.',
  check:'혈압·말초관류와 배액관 유출을 추적하고 심초음파로 재저류를 확인한다. 다시 불안정하거나 출혈이 지속되면 즉시 시술팀·심장수술팀과 재평가한다.',
  source:[0,1]
},{
  id:'clinic-return', title:'외래에서 건넨 검사 결과', setting:'순환기 외래',
  opening:'“건강검진에서 심장 주변에 물이 보인대요. 숫자가 꽤 크다는데 오늘 빼야 하는 건가요?” 56세 환자가 검사 결과지를 건넨다.',
  vitals:['BP 126/74 mmHg','HR 68/min','SpO₂ 98% · 실내 공기'],
  context:'환자는 혼자 걸어 진료실로 들어왔다. 결과지에는 심낭액 24 mm라고 적혀 있다.',
  findings:[
    ['증상과 활동량 묻기','평소처럼 두 층 계단을 오른다. 호흡곤란, 흉통, 실신, 발열이나 체중 감소는 없다.'],
    ['관류와 경정맥 진찰','사지가 따뜻하고 경정맥은 팽창하지 않았다. 폐음은 깨끗하다.'],
    ['이전 영상과 비교','8개월 전 24 mm, 4개월 전 25 mm였다. 오늘 영상에서도 분포와 크기에 유의한 변화는 없다.'],
    ['심초음파 혈역학 확인','우심방·우심실 허탈이 없고 하대정맥은 흡기 때 잘 줄어든다. 도플러 유입 속도의 과도한 호흡성 변동도 없다.'],
    ['원인 평가 기록 확인','반복 측정한 CRP가 정상이고 심장 MRI에서 심낭 염증 소견이 없다. 신장·갑상샘 기능과 결핵·악성질환 등 원인 평가에서 특이 소견이 없었다.']
  ],
  decision:'환자와 오늘 어떤 계획을 세우겠습니까?',
  actions:[
    ['예정된 심낭천자를 예약','시술 전 검토에서 동료가 묻는다. “증상, 혈역학 이상, 진단을 위한 검체가 필요한 단서 중 어떤 것이 있나요?” 이전 영상과 원인 평가를 다시 확인하세요.'],
    ['항염증제와 콜히친을 시작','약제를 검토하는 동료가 염증의 근거를 묻는다. 증상, CRP, 영상 기록을 확인하고 기대하는 치료 효과를 다시 판단하세요.'],
    ['증상 교육과 외래 심초음파 추적','환자가 고개를 끄덕이다가 되묻는다. “그럼 다음 예약까지 어떤 변화가 생기면 먼저 와야 하죠?”']
  ],best:2,reassess:'추적 중 어떤 증상이나 영상 변화가 생기면 계획을 바꾸겠습니까?',
  audience:'환자가 집에 가서 기억할 수 있게 추적 이유와 일찍 도움을 구할 상황을 설명하세요.',
  model:'“몇 달간 양이 비슷했고 지금은 심장이 피를 받아들이는 데 지장이 없습니다. 초음파로 변화를 살피겠습니다. 숨이 새로 차거나 운동이 힘들어지면 일찍 연락해 주세요. 갑자기 숨이 심하게 차거나 실신하면 응급 진료를 받으세요.”',
  key:'같은 심낭액도 축적 속도와 심낭의 여유에 따라 충만을 방해하는 정도가 다르다. 원인 평가와 염증 소견, 시간 경과를 함께 보면 크기가 큰 만성 삼출도 경과 관찰할 수 있다.',
  check:'새 증상은 예약을 앞당겨 재평가할 이유다. 혈역학 장애, 진행성 삼출, 감염·종양 의심이 생기면 배액이나 추가 원인 평가의 필요성을 다시 판단한다.',
  source:[0]
}];

function roundRecords(){
  const w=workspace();
  return w.rounds||(w.rounds={});
}
function roundDraft(c){
  return roundRecords()[c.id]||{seen:[],actions:[],hypothesis:'',followup:'',handoff:'',done:false};
}
function persistRound(c,r){
  r.updatedAt=Date.now();
  roundRecords()[c.id]=r;
  return persistWorkspace();
}
function encounterRequest(it){
  const reference={stem:it.stem,question:it.question,labs:it.labs,findings:it.findings_text,
    options:it.options,proposed_answer:it.answer,analysis:it.option_analysis,takeaway:it.takeaway,source_refs:it.source_refs};
  return [
    'Project Genesis · 이 문항을 턴제 모의진료로 진행해줘. 아래 JSON은 교사용 증례 자료야.',
    '첫 답변에는 환자의 주호소와 당장 보이는 상태만 보여줘. 진단, 선택지, 학습목표와 결말은 숨겨줘.',
    '내가 학생의사로서 문진·진찰·검사를 요청하면 해당 결과만 알려줘. 원문에 없는 정보는 미상이라고 표시하고, 검사 전후 순서와 긴급 보고가 필요한 소견을 보존해줘.',
    '내가 행동을 결정하면 무엇을 재평가할지 묻고, 당직의에게 인계하거나 환자에게 설명하게 해줘. 처치 결과를 새로 가정할 때는 모의 경과임을 밝혀줘.',
    '마친 뒤 내 실제 선택을 근거로 잘한 판단 한 가지와 가장 중요한 교정점 한 가지를 짚어줘. 문항의 정답과 임상 주장은 독립적으로 확인해줘. 환자 증례가 없는 문항이면 그 한계를 먼저 밝혀줘.',
    JSON.stringify(reference)
  ].join('\n\n');
}
function roundCoaching(c,r){
  const trace=r.actions.map(i=>c.actions[i].join(' → ')).join('\n');
  const observed=r.seen.map(i=>c.findings[i].join(' → ')).join('\n');
  return ['Project Genesis · 모의 당직 피드백',c.title,c.opening,c.vitals.join(' · '),c.context,
    '내가 확인한 순서와 결과',observed||'직접 확인한 소견 없음',
    '초기 판단',r.hypothesis||'미작성','행동과 환자 경과',trace,
    '재평가 계획',r.followup||'미작성','전달 대상과 과제',c.audience,'내 실제 표현',r.handoff||'미작성',
    '증례의 재평가 기준',c.check,'전달 예시',c.model,...c.source.map(i=>ROUND_SOURCES[i][1]),
    '내 선택과 발화를 바탕으로 가장 잘한 판단과 가장 중요한 교정점 하나씩만 알려줘. 미작성 내용은 평가를 보류해줘. 먼저 내가 다시 설명하게 한 뒤, 조건이 달라진 새 환자의 최초 호소만 제시하고 내 요청에 따라 정보를 공개해줘.'
  ].join('\n\n');
}
function roundField(key,label,value){
  return '<label class="round-field">'+esc(label)+'<textarea rows="2" maxlength="2500" data-round-field="'+key+'">'+esc(value||'')+'</textarea></label>';
}
function roundChoice(label,index,action,selected){
  return '<button class="btn round-choice" data-round="'+action+'" data-index="'+index+'" '+(selected?'disabled':'')+'>'+esc(label)+'</button>';
}
let roundIndex=0;
function vRounds(){
  const c=ROUNDS[roundIndex],r=roundDraft(c),treated=r.actions.includes(c.best);
  const tabs=ROUNDS.map((item,i)=>'<button class="filter-tab '+(i===roundIndex?'active':'')+'" data-round="switch" data-index="'+i+'" aria-pressed="'+(i===roundIndex)+'">'+esc(item.title)+(roundDraft(item).done?' · 완료':'')+'</button>').join('');
  let h=pageHeading('모의 당직','호출을 받고, 필요한 정보를 찾고, 환자의 다음 단계를 결정하세요.')+'<div class="filter-tabs">'+tabs+'</div><div class="round-layout"><section class="card round-card"><p class="round-setting">'+esc(c.setting)+' · 가상 증례</p><h2>'+esc(c.title)+'</h2><p class="round-call">'+esc(c.opening)+'</p><div class="round-vitals">'+c.vitals.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div><p>'+esc(c.context)+'</p></section>';
  h+='<section class="card round-card"><h2>무엇을 더 확인할까요?</h2><div class="round-choices">'+c.findings.map(([label],i)=>roundChoice(label,i,'inspect',treated||r.seen.includes(i))).join('')+'</div><div aria-live="polite">'+r.seen.map(i=>'<div class="round-observation"><strong>'+esc(c.findings[i][0])+'</strong><p>'+esc(c.findings[i][1])+'</p></div>').join('')+'</div>';
  h+=treated?(r.hypothesis?'<p><strong>내 초기 판단</strong> · '+esc(r.hypothesis)+'</p>':''):roundField('hypothesis','어떤 원인을 의심하나요? 판단을 바꿀 소견도 한 가지 떠올려 보세요.',r.hypothesis);
  h+='</section><section class="card round-card"><h2>'+esc(c.decision)+'</h2>';
  if(!treated)h+='<details '+(r.actions.length?'open':'')+'><summary>내 계획을 정한 뒤 가능한 행동 보기</summary><div class="round-choices">'+c.actions.map(([label],i)=>roundChoice(label,i,'act',r.actions.includes(i))).join('')+'</div></details>';
  h+=r.actions.map(i=>'<div class="round-response"><strong>'+esc(c.actions[i][0])+'</strong><p>'+esc(c.actions[i][1])+'</p></div>').join('')+'</section>';
  if(treated&&!r.done){
    h+='<section class="card round-card"><h2>재평가와 전달</h2>'+roundField('followup',c.reassess,r.followup)+roundField('handoff',c.audience,r.handoff)+'<button class="btn pri" data-round="finish">내 판단과 해설 비교</button></section>';
  }
  if(r.done){
    const missed=c.findings.filter((_,i)=>!r.seen.includes(i));
    h+='<section class="card round-card"><h2>내가 내린 결정 돌아보기</h2><p>'+esc(c.key)+'</p><h3>재평가</h3><p class="round-own">'+esc(r.followup||'작성한 답이 없습니다.')+'</p><p>'+esc(c.check)+'</p><h3>내 설명과 전달 예시</h3><p class="round-own">'+esc(r.handoff||'작성한 답이 없습니다.')+'</p><p>'+esc(c.model)+'</p>';
    if(missed.length)h+='<details><summary>이번에 확인하지 않은 소견 '+missed.length+'개</summary>'+missed.map(([label,result])=>'<p><strong>'+esc(label)+'</strong> · '+esc(result)+'</p>').join('')+'</details>';
    h+='<p class="round-sources">'+c.source.map(i=>'<a target="_blank" rel="noopener" href="'+ROUND_SOURCES[i][1]+'">'+ROUND_SOURCES[i][0]+'</a>').join(' · ')+'</p><div class="actions"><button class="btn pri" data-round="switch" data-index="'+(1-roundIndex)+'">다른 환자 보기</button><button class="btn" data-round="coach">내 기록으로 코칭 요청문 복사</button><button class="btn" data-round="retry">이 환자 다시 연습</button></div></section>';
  }
  return h+'</div>';
}
app.addEventListener('input',e=>{
  const field=e.target.dataset.roundField;
  if(!['hypothesis','followup','handoff'].includes(field))return;
  const c=ROUNDS[roundIndex],r=roundDraft(c);
  r[field]=e.target.value;
  persistRound(c,r);
});
app.addEventListener('click',e=>{
  const btn=e.target.closest('[data-round]');
  if(!btn)return;
  const c=ROUNDS[roundIndex],r=roundDraft(c),i=Number(btn.dataset.index);
  switch(btn.dataset.round){
    case 'switch':
      if(!ROUNDS[i])return;
      roundIndex=i;
      workspace().preferences.roundIndex=i;
      render();window.scrollTo(0,0);return;
    case 'inspect':
      if(!c.findings[i]||r.seen.includes(i)||r.actions.includes(c.best))return;
      r.seen.push(i);break;
    case 'act':
      if(!c.actions[i]||r.actions.includes(i)||r.actions.includes(c.best))return;
      r.actions.push(i);break;
    case 'finish':
      if(!r.actions.includes(c.best))return;
      r.done=true;break;
    case 'coach':
      if(r.done)copy(roundCoaching(c,r));
      return;
    case 'retry':
      if(!confirm('이 환자의 기록을 비우고 처음부터 연습할까요?'))return;
      persistRound(c,{seen:[],actions:[],hypothesis:'',followup:'',handoff:'',done:false});render();window.scrollTo(0,0);return;
    default:return;
  }
  persistRound(c,r);render();
  const target=btn.dataset.round==='inspect'?'.round-observation:last-child':btn.dataset.round==='act'?'.round-response:last-child':'.round-card:last-child';
  const change=app.querySelector(target);
  if(change){change.tabIndex=-1;change.focus({preventScroll:true});change.scrollIntoView({block:'nearest'});}
});
