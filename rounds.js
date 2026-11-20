'use strict';

// Each encounter is authored as a sequence of clinical decisions. Only requested
// findings and consequences of actions taken are rendered during the encounter.
const ROUND_SOURCES = [
  ['2025 ESC 심근염·심막염 진료지침', 'https://doi.org/10.1093/eurheartj/ehaf192'],
  ['2024 EHRA/HRS 심방세동 절제술 합의문', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11632303/'],
  ['EHRA/EACVI 합의문 · 시술 후 혈관 합병증 영상 평가', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11104536/']
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
  source:[0,1], visualPractice:'subcostal-cine'
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
},{
  id:'ward-evening', title:'병실에서 다시 잰 혈압', setting:'심장내과 병동',
  opening:'“선생님, 오늘 오후에 심방세동 절제술을 받은 69세 환자가 기운이 없대요. 혈압을 다시 쟀는데 아까보다 낮아요.”',
  vitals:['BP 88/56 ← 124/72 mmHg','HR 118/min','SpO₂ 97% · 실내 공기'],
  context:'시술팀에 긴급 연락했고 모니터와 정맥로를 확보했다. 의료진과 함께 환자 곁에서 초기 평가를 진행한다.',
  findings:[
    ['환자에게 불편한 곳 묻기','조금 전부터 오른쪽 옆구리와 허리가 묵직하고 어지럽다고 한다. 흉통은 없다.'],
    ['관류와 경정맥 진찰','피부가 차고 창백하다. 경정맥은 팽창하지 않았고 호흡음은 양쪽에서 들린다.'],
    ['시술 기록과 천자 부위 확인','오른쪽 대퇴혈관으로 접근했고 시술 중 항응고제를 사용했다. 천자 부위 드레싱은 말라 있고 눈에 띄는 혈종은 없다.'],
    ['침상 심초음파 요청','충분한 영상 창에서 새로운 심낭액이나 우심방·우심실 허탈이 보이지 않는다. 좌심실은 작고 활발하게 수축한다.'],
    ['혈액검사 추이 확인','시술 전 Hb 13.2 g/dL, 현재 10.0 g/dL이다. 침대에 누운 채 반복해 잰 혈압도 낮다.']
  ],
  decision:'시술팀과 지금 어떤 조치를 우선하겠습니까?',
  actions:[
    ['잠재적 대량 출혈로 소생을 시작하고 지혈팀에 도움 요청','시술팀이 수혈 필요성을 평가하며 소생을 시작하고 중재팀과 지혈 계획을 세운다. 이 모의 환자는 이송 가능한 상태로 안정된 뒤 CT 혈관조영에서 오른쪽 후복막 출혈이 확인됐다.'],
    ['시술 후 심장눌림을 예상하고 바로 심낭 배액을 요청','팀이 침상 초음파를 다시 본다. 배액할 심낭액이 확인되지 않는다. 혈색소 추이와 환자가 호소하는 통증 위치를 다시 확인하세요.'],
    ['외부 출혈이 보이는지 드레싱을 관찰하며 기다리기','드레싱은 그대로인데 환자가 더 어지러워하고 수축기 혈압은 80 mmHg까지 떨어진다. 보이지 않는 공간에서 피가 소실될 가능성을 팀과 재평가하세요.']
  ],best:0,reassess:'팀의 초기 대응 뒤 어떤 지표로 관류와 출혈 경과를 추적하고, 언제 다시 긴급히 보고하겠습니까?',
  audience:'중재팀에 의심하는 출혈 부위, 판단 근거와 현재 필요한 도움을 두 문장으로 인계하세요.',
  model:'“대퇴 접근 절제술 후 저혈압·빈맥, 새 우측 옆구리 통증과 혈색소 감소가 있어 후복막 출혈을 의심합니다. 초기 소생 중이며 출혈원 확인과 지혈을 위해 즉시 함께 평가해 주세요.”',
  key:'같은 시술 뒤의 저혈압이라도 정맥 환류가 줄어든 이유는 다를 수 있다. 대퇴 접근 뒤 후복막에 출혈하면 드레싱은 말라 있어도 순환 혈액량이 감소한다.',
  check:'혈압과 맥박, 의식과 말초관류, 연속 혈색소 및 소생에 대한 반응을 함께 추적한다. 다시 불안정해지면 즉시 팀에 알리고 출혈원 통제 계획을 재평가한다.',
  source:[1,2]
}];

function roundRecords(){
  const w=workspace();
  return w.rounds||(w.rounds={});
}
function roundDraft(c){
  return roundRecords()[c.id]||newRound();
}
function newRound(){
  return {seen:[],actions:[],hypothesis:'',followup:'',handoff:'',done:false,optionsOpened:false};
}
function roundAttempts(){
  const w=workspace();
  return w.roundAttempts||(w.roundAttempts={});
}
function savedRounds(c){
  return Object.values(roundAttempts()).filter(a=>a.caseId===c.id).sort((a,b)=>b.finishedAt-a.finishedAt);
}
function presentedRound(c){
  const existing=roundRecords()[c.id],r=existing||newRound();
  if(!r.openedAt){
    if(existing?.done){
      r.finishedAt=r.finishedAt||r.updatedAt||0;
      if(!r.attemptId)r.attemptId='legacy-'+c.id+'-'+r.finishedAt;
    }
    r.presentation=existing?(r.presentation||'unknown'):(savedRounds(c).length?'repeat':'first');
    r.openedAt=Date.now();persistRound(c,r);
  }
  return r;
}
const PRESENTATION={first:'이 기기의 기록상 첫 제시',repeat:'같은 환자 재연습',unknown:'이전 기록 · 첫 제시 여부 미상'};
const RECEIVERS={peer:'실제 동료',supervisor:'실제 지도자',self:'혼자 예상하기'};
const RECEIPT={unknown:'미평가',both:'두 가지 모두 전달됨',one:'한 가지만 전달됨',neither:'둘 다 전달되지 않음'};
function archiveRound(c,r){
  if(!r.done)return;
  const finishedAt=r.finishedAt||r.updatedAt||0;
  const id=r.attemptId||('legacy-'+c.id+'-'+finishedAt);
  if(roundAttempts()[id])return;
  roundAttempts()[id]={...JSON.parse(JSON.stringify(r)),attemptId:id,caseId:c.id,finishedAt,updatedAt:finishedAt};
}
function persistRound(c,r){
  r.updatedAt=Date.now();
  if(!r.attemptId)r.attemptId=uid('ROUND');
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
    '선택지를 보기 전 계획',r.firstPlan||'확인할 수 없음','기록된 초기 판단',r.hypothesis||'미작성','행동과 환자 경과',trace,
    '재평가 계획',r.followup||'미작성','전달 대상과 과제',c.audience,'내 실제 표현',r.handoff||'미작성',
    '증례 노출',PRESENTATION[r.presentation]||PRESENTATION.unknown,
    '되말하기와 수정',readbackSummary(r).map(row=>row.join(' · ')).join('\n')||'청자 근거 없음',
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
function readbackSummary(r){
  const p=r.communication;
  if(!p)return [];
  const rows=[['첫 전달',p.first]];
  if(!p.readbackAt)return [...rows,['되말하기','완료한 기록 없음 · 전달 정도 미평가']];
  rows.push(['입력자가 선택한 연습 방식',RECEIVERS[p.mode]||'미상'],[p.mode==='self'?'내가 예상한 위험':'청자가 되말한 위험',p.danger],[p.mode==='self'?'내가 예상한 요청':'청자가 되말한 요청',p.request],
    [p.mode==='self'?'본인 추정':'청자가 표시한 전달 정도',RECEIPT[p.rating]||RECEIPT.unknown],['다시 말할 때 고칠 한 가지',p.correction]);
  if(p.secondAt)rows.push(['같은 환자에서 교정 뒤 두 번째 전달',p.second]);
  return rows;
}
function readbackView(r){
  const p=r.communication;
  if(!p)return '<button class="btn" data-round="lock-handoff">첫 전달 저장하고 되말하기 연습</button>';
  let h='<div class="round-observation"><h3>첫 전달</h3><p>'+esc(p.first)+'</p>';
  if(!p.readbackAt){
    h+='<p>실제 청자와 연습 중이면 화면의 예시를 열기 전에 첫 전달을 말하고, 청자에게 기기를 건네세요.</p>'+
      '<div class="actions">'+Object.entries(RECEIVERS).map(([key,label])=>'<button class="btn" data-round="receiver" data-value="'+key+'" aria-pressed="'+(p.mode===key)+'">'+label+'</button>').join('')+'</div>';
    if(p.mode){
      const actual=p.mode!=='self';
      h+='<p>'+ (actual?'청자가 직접 작성합니다. 들리지 않은 내용은 “듣지 못함”으로 적으세요.':'혼자 연습할 때는 상대가 어떻게 이해할지 예상해 적으세요.')+'</p>'+
        roundField('danger',actual?'어떤 위험 또는 주의할 변화를 들었습니까?':'상대가 이해했을 것으로 예상하는 위험',p.danger)+
        roundField('request',actual?'본인이 무엇을, 언제 해야 한다고 들었습니까?':'상대가 이해했을 것으로 예상하는 행동과 시점',p.request)+
        '<label class="round-field">'+(actual?'청자가 판단한 전달 정도':'내가 예상한 전달 정도')+
        '<select data-round-rating>'+Object.entries(RECEIPT).map(([key,label])=>'<option value="'+key+'" '+(p.rating===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
        roundField('correction','다시 들을 때 한 가지 더 분명했으면 하는 점',p.correction)+
        '<button class="btn" data-round="lock-readback">되말하기와 교정점 저장</button>';
    }
  }else{
    const rows=readbackSummary(r).slice(1);
    h+='<dl>'+rows.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
    if(!p.secondAt)h+=roundField('second','학습자가 기기를 돌려받아, 교정점을 반영해 두 문장으로 다시 전달하세요.',p.second)+
      '<button class="btn" data-round="lock-second">두 번째 전달 저장</button>';
  }
  return h+'</div>';
}
function roundResult(c,r){
  const firstAction=c.actions[r.actions[0]]?.[0];
  const includedPlan=Boolean(r.firstPlan?.trim());
  const fullTrace=includedPlan&&r.followup?.trim()&&r.handoff?.trim();
  const status=fullTrace?'선지 전 계획·재평가·전달 기록':'해설 열람 · 일부 수행 근거 미기록';
  const first=firstAction?(r.actions[0]===c.best?'권장 행동을 첫 선택으로 고름':'첫 선택 후 계획을 수정함'):'첫 선택 기록 없음';
  const receiverRows=r.communication?readbackSummary(r).slice(1):[['되말하기','청자 기록 없음 · 전달 정도 미평가']];
  return '<p><strong>'+status+'</strong></p><dl>'+
    '<dt>선지 전 내 계획</dt><dd>'+esc(r.firstPlan||'기록 없음')+'</dd>'+
    '<dt>첫 행동</dt><dd>'+esc(firstAction||'기록 없음')+' · '+first+'</dd>'+
    '<dt>재평가 계획</dt><dd>'+esc(r.followup||'기록 없음')+'</dd>'+
    '<dt>인계 또는 환자 설명</dt><dd>'+esc(r.handoff||'기록 없음')+'</dd>'+
    '<dt>증례 노출</dt><dd>'+esc(PRESENTATION[r.presentation]||PRESENTATION.unknown)+'</dd>'+
    receiverRows.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
}
function roundHistory(c,r){
  const previous=savedRounds(c).filter(a=>a.attemptId!==r.attemptId);
  if(!previous.length)return '';
  if(!r.done)return '<p class="hint mut">이 환자를 다시 연습 중입니다. 이전 시도 '+previous.length+'회는 이번 해설에서 비교할 수 있습니다.</p>';
  return '<details class="card round-card"><summary>이전 시도 '+previous.length+'회</summary>'+
    previous.map(a=>'<details><summary>'+esc(a.finishedAt?dstr(a.finishedAt):'이전 기록')+
      '</summary>'+roundResult(c,a)+'</details>').join('')+'</details>';
}
let roundIndex=0;
function vRounds(){
  const c=ROUNDS[roundIndex],r=presentedRound(c),treated=r.actions.includes(c.best);
  const tabs=ROUNDS.map((item,i)=>'<button class="filter-tab '+(i===roundIndex?'active':'')+'" data-round="switch" data-index="'+i+'" aria-pressed="'+(i===roundIndex)+'">'+esc(item.title)+(roundDraft(item).done?' · 해설 확인':'')+'</button>').join('');
  let h=pageHeading('모의 당직','호출을 받고, 필요한 정보를 찾고, 환자의 다음 단계를 결정하세요.')+'<div class="filter-tabs">'+tabs+'</div><div class="round-layout"><section class="card round-card"><p class="round-setting">'+esc(c.setting)+' · 가상 증례</p><h2>'+esc(c.title)+'</h2><p class="round-call">'+esc(c.opening)+'</p><div class="round-vitals">'+c.vitals.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div><p>'+esc(c.context)+'</p></section>';
  h+='<section class="card round-card"><p class="hint mut">'+esc(PRESENTATION[r.presentation]||PRESENTATION.unknown)+'</p><h2>무엇을 더 확인할까요?</h2><div class="round-choices">'+c.findings.map(([label],i)=>roundChoice(label,i,'inspect',treated||r.seen.includes(i))).join('')+'</div><div aria-live="polite">'+r.seen.map(i=>'<div class="round-observation"><strong>'+esc(c.findings[i][0])+'</strong><p>'+esc(c.findings[i][1])+'</p></div>').join('')+'</div>';
  const optionsVisible=r.optionsOpened||r.actions.length>0;
  if(!optionsVisible)h+=roundField('hypothesis','현재 의심하는 원인과 먼저 할 행동을 근거와 함께 한 문장으로 적어 보세요.',r.hypothesis);
  else if(r.hypothesis)h+='<p><strong>기록한 계획</strong> · '+esc(r.hypothesis)+'</p>';
  h+='</section><section class="card round-card"><h2>'+esc(c.decision)+'</h2>';
  if(!treated){
    h+=optionsVisible?'<div class="round-choices">'+c.actions.map(([label],i)=>roundChoice(label,i,'act',r.actions.includes(i))).join('')+'</div>':
      '<button class="btn" data-round="options">가능한 행동 보기</button><p class="hint mut">선지를 열면 현재 작성한 계획이 저장됩니다. 바로 대응할 때는 빈칸으로 진행할 수 있습니다.</p>';
  }
  h+=r.actions.map(i=>'<div class="round-response"><strong>'+esc(c.actions[i][0])+'</strong><p>'+esc(c.actions[i][1])+'</p></div>').join('')+'</section>';
  if(treated&&!r.done){
    h+='<section class="card round-card"><h2>재평가와 전달</h2>'+roundField('followup',c.reassess,r.followup)+
      (r.communication?'':roundField('handoff',c.audience,r.handoff))+readbackView(r)+
      '<div class="actions"><button class="btn pri" data-round="finish">현재 기록으로 해설 보기</button></div></section>';
  }
  if(r.done){
    const missed=c.findings.filter((_,i)=>!r.seen.includes(i));
    h+='<section class="card round-card"><h2>이번 시도</h2>'+roundResult(c,r)+'<p class="hint mut">직접 작성한 내용과 선택 순서를 보존합니다. 계획의 적절성과 전달의 정확성은 예시와 비교하세요.</p><h3>판단 근거</h3><p>'+esc(c.key)+'</p><h3>재평가 기준</h3><p>'+esc(c.check)+'</p><h3>전달 예시</h3><p>'+esc(c.model)+'</p>';
    if(missed.length)h+='<details><summary>이번에 확인하지 않은 소견 '+missed.length+'개</summary>'+missed.map(([label,result])=>'<p><strong>'+esc(label)+'</strong> · '+esc(result)+'</p>').join('')+'</details>';
    const unseen=ROUNDS.findIndex(other=>other.id!==c.id&&!roundRecords()[other.id]&&!savedRounds(other).length);
    const next=unseen>=0?unseen:(roundIndex+1)%ROUNDS.length;
    h+='<p class="round-sources">'+c.source.map(i=>'<a target="_blank" rel="noopener" href="'+ROUND_SOURCES[i][1]+'">'+ROUND_SOURCES[i][0]+'</a>').join(' · ')+'</p><div class="actions"><button class="btn pri" data-round="switch" data-index="'+next+'">'+(unseen>=0?'기록상 처음 보는 환자':'다른 환자 보기')+'</button><button class="btn" data-round="coach">내 기록으로 코칭 요청문 복사</button><button class="btn" data-round="retry">이 환자 다시 연습</button></div></section>';
    if(c.visualPractice&&window.KMLEVisualPractice)h+='<section class="card round-card"><h2>다른 환자 영상으로 판독 연습</h2><div data-visual-practice="'+esc(c.visualPractice)+'"></div></section>';
  }
  return h+roundHistory(c,r)+'</div>';
}
app.addEventListener('input',e=>{
  const field=e.target.dataset.roundField;
  if(!field)return;
  const c=ROUNDS[roundIndex],r=roundDraft(c);
  if(r.done||(field==='hypothesis'&&(r.optionsOpened||r.actions.length)))return;
  if(field!=='hypothesis'&&!r.actions.includes(c.best))return;
  const p=r.communication;
  if(['danger','request','correction'].includes(field)){
    if(!p?.mode||p.readbackAt)return;
    p[field]=e.target.value;
  }else if(field==='second'){
    if(!p?.readbackAt||p.secondAt)return;
    p.second=e.target.value;
  }else if(['hypothesis','followup','handoff'].includes(field)){
    if(field==='handoff'&&p)return;
    r[field]=e.target.value;
  }else return;
  persistRound(c,r);
});
app.addEventListener('change',e=>{
  if(!Object.hasOwn(e.target.dataset,'roundRating'))return;
  const c=ROUNDS[roundIndex],r=roundDraft(c),p=r.communication;
  if(r.done||!p?.mode||p.readbackAt||!Object.hasOwn(RECEIPT,e.target.value))return;
  p.rating=e.target.value;persistRound(c,r);
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
      persistWorkspace();
      render();window.scrollTo(0,0);return;
    case 'inspect':
      if(!c.findings[i]||r.seen.includes(i)||r.actions.includes(c.best))return;
      r.seen.push(i);break;
    case 'options':
      if(r.optionsOpened||r.actions.length||r.done)return;
      r.firstPlan=(r.hypothesis||'').trim();r.optionsOpened=true;break;
    case 'act':
      if(!c.actions[i]||r.actions.includes(i)||r.actions.includes(c.best))return;
      r.actions.push(i);break;
    case 'lock-handoff':
      if(r.done||r.communication||!r.actions.includes(c.best))return;
      if(!r.handoff?.trim()){toast('받는 사람에게 전달할 말을 먼저 적으세요.');return;}
      r.communication={first:r.handoff.trim(),firstAt:Date.now(),mode:'',rating:'unknown'};break;
    case 'receiver':{
      const p=r.communication,mode=btn.dataset.value;
      if(r.done||!p||p.readbackAt||!Object.hasOwn(RECEIVERS,mode)||p.mode===mode)return;
      if(p.mode&&[p.danger,p.request,p.correction].some(text=>text?.trim())){
        toast('되말하기 작성 중에는 기록 방식을 바꿀 수 없습니다.');return;
      }
      p.mode=mode;p.rating='unknown';break;
    }
    case 'lock-readback':{
      const p=r.communication;
      if(r.done||!p?.mode||p.readbackAt)return;
      if(![p.danger,p.request,p.correction].every(text=>text?.trim())){
        toast('들은 위험과 행동, 고칠 점 한 가지를 적으세요.');return;
      }
      p.readbackAt=Date.now();break;
    }
    case 'lock-second':{
      const p=r.communication;
      if(r.done||!p?.readbackAt||p.secondAt)return;
      if(!p.second?.trim()){toast('교정점을 반영해 다시 전달한 말을 적으세요.');return;}
      p.secondAt=Date.now();break;
    }
    case 'finish':
      if(r.done||!r.actions.includes(c.best))return;
      r.done=true;r.finishedAt=Date.now();
      if(!r.attemptId)r.attemptId=uid('ROUND');
      archiveRound(c,r);break;
    case 'coach':
      if(r.done)copy(roundCoaching(c,r));
      return;
    case 'retry':
      if(!r.done)return;
      archiveRound(c,r);
      persistRound(c,{...newRound(),openedAt:Date.now(),presentation:'repeat'});render();window.scrollTo(0,0);return;
    default:return;
  }
  persistRound(c,r);render();
  const target=btn.dataset.round==='inspect'?'.round-observation:last-child':btn.dataset.round==='act'?'.round-response:last-child':'.round-card:last-child';
  const change=app.querySelector(target);
  if(change){change.tabIndex=-1;change.focus({preventScroll:true});change.scrollIntoView({block:'nearest'});}
});
