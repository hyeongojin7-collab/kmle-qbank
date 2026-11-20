/* Keep unseen variants available for delayed application of the same learning objective. */
const PROCEDURE_HYPOTENSION='acute.postprocedure_hypotension';
const PATHWAY_DECISIONS={danger:'위험 인지',action:'첫 행동',escalation:'도움 요청'};

// A retry of a known patient can guide practice. Only a delayed, distinct, fresh patient
// can close an action-specific gap. Text ratings and structured selections remain separate.
function writtenPathwayEvidence(now=Date.now()){
  const gaps=new Map(),seen=new Set(),events=[],presentations=new Map();
  let independent=0,complete=0,reviewedText=0,latestDimensions=new Set();
  const attempts=S.attempts.filter(a=>{
    const it=S.bank[a.qid];
    return it?.objective_id===PROCEDURE_HYPOTENSION&&isStudyEligible(it)&&isCurrentAttempt(a)&&
      a.mode!=='mock'&&!a.skipped&&Number.isFinite(a.ts)&&a.ts<=now;
  }).slice().sort((a,b)=>a.ts-b.ts);
  for(const a of attempts){
    const j=a.clinicalJudgment,first=!seen.has(a.qid);seen.add(a.qid);
    if(!j||j.objective!==PROCEDURE_HYPOTENSION||!Array.isArray(j.decisions)||
       !Number.isFinite(j.lockedAt)||j.lockedAt>a.ts)continue;
    const fresh=first&&a.recallFirst===true&&j.freshPresentation===true&&a.priorExposureAt==null;
    if(!presentations.has(a.qid))presentations.set(a.qid,firstItemPresentation(a.qid));
    const openedAt=presentations.get(a.qid)??j.lockedAt;
    const assessed=j.decisions.filter(d=>Object.hasOwn(PATHWAY_DECISIONS,d.id)&&d.selected!=null&&typeof d.correct==='boolean');
    if(fresh){
      latestDimensions=new Set(assessed.map(d=>d.id));
      if(latestDimensions.size)independent++;
      if(latestDimensions.size===Object.keys(PATHWAY_DECISIONS).length)complete++;
    }
    const source={qid:a.qid,revision:a.revision,sourceAttemptTs:a.ts,fresh,openedAt};
    for(const d of assessed)events.push({...source,kind:'structured',id:d.id,met:d.correct,at:a.ts});
    const review=typeof firstTextReview==='function'?firstTextReview(a):null;
    if(!review)continue;
    const reviewedAt=Math.max(a.ts,Number(review.at||0));
    if(reviewedAt>now)continue;
    reviewedText++;
    for(const id of Object.keys(PATHWAY_DECISIONS)){
      const rating=review.ratings?.[id];
      if(rating==='met'||rating==='missed')events.push({...source,kind:'text',id,met:rating==='met',at:reviewedAt,role:review.role});
    }
  }
  for(const e of events.sort((a,b)=>a.at-b.at)){
    const key=e.kind+'.'+e.id,old=gaps.get(key);
    if(!e.met){
      if(!old||e.fresh&&old.qid!==e.qid){
        gaps.set(key,{...e,dueAt:e.at+7*DAY,label:PATHWAY_DECISIONS[e.id]});
      }
    }else if(old&&e.fresh&&e.qid!==old.qid&&e.openedAt>=old.dueAt&&
      (old.role!=='instructor'||e.role==='instructor')){
      gaps.delete(key);
    }
  }
  const unassessed=attempts.length?Object.keys(PATHWAY_DECISIONS).filter(id=>!latestDimensions.has(id)):[];
  return {gaps:[...gaps.values()],independent,complete,unassessed,reviewedText,attempts:attempts.length};
}

function transferWasPresented(item) {
  const started = workspace().transferStarts?.[item.id];
  return !!started || firstItemPresentation(item.id) != null || firstItemExposure(item.id) != null;
}

function isReservedTransfer(item) {
  return !!item && item.variant_role === 'transfer' && !!item.objective_id && !transferWasPresented(item);
}

function transferWindow(item) {
  return Number(item.transfer_days) === 30 ? 30 : 7;
}

function transferSchedule(now = Date.now(),pathwayEvidence=null) {
  const anchors = new Map();
  for (const attempt of S.attempts) {
    const item = S.bank[attempt.qid];
    if (!item?.objective_id || item.variant_role !== 'index' || !isStudyEligible(item)) continue;
    if (attempt.skipped || attempt.mode === 'mock' || !Number.isFinite(attempt.ts) || attempt.ts > now) continue;
    if (!isCurrentAttempt(attempt)) continue;
    const anchor = anchors.get(item.objective_id);
    if (!anchor || attempt.ts < anchor.first) {
      anchors.set(item.objective_id, {first: attempt.ts, last: Math.max(attempt.ts, anchor?.last || 0)});
    } else {
      anchor.last = Math.max(attempt.ts, anchor.last);
    }
  }
  const rows = [];
  const pathwayDue=Math.max(0,...(pathwayEvidence||writtenPathwayEvidence(now)).gaps.map(g=>g.dueAt));
  for (const item of Object.values(S.bank)) {
    if (!isStudyEligible(item) || !isReservedTransfer(item)) continue;
    const days = transferWindow(item);
    const anchor = anchors.get(item.objective_id);
    const previous = Object.values(workspace().transferStarts || {}).filter(start =>
      start.objective === item.objective_id && start.qid !== item.id && Number.isFinite(start.openedAt));
    const lastSibling = previous.reduce((last, start) => Math.max(last, start.openedAt), 0);
    const due = anchor ? Math.max(anchor.first + days * DAY, lastSibling ? lastSibling + 7 * DAY : 0,
      item.objective_id===PROCEDURE_HYPOTENSION?pathwayDue:0) : null;
    rows.push({item, days, anchor, lastSibling, due});
  }
  return rows.sort((a,b) => (a.due ?? Infinity) - (b.due ?? Infinity) || a.item.id.localeCompare(b.item.id));
}

function lastIndexJudgment(objective, openedAt) {
  return S.attempts.filter(a => {
    const item = S.bank[a.qid];
    return item?.variant_role === 'index' && item.objective_id === objective &&
      !a.skipped && a.mode !== 'mock' && Number.isFinite(a.ts) && a.ts <= openedAt && isCurrentAttempt(a);
  }).sort((a,b) => b.ts-a.ts)[0];
}
function compareTransferJudgments(assessment) {
  const snapshot = assessment.transferAssessment;
  const anchor = Object.hasOwn(snapshot,'indexJudgment') ? snapshot.indexJudgment
    : lastIndexJudgment(snapshot.objective,snapshot.openedAt);
  function judgment(a) {
    const p = a?.prediction;
    if (p?.mode === 'written' && typeof p.text === 'string' && p.text.trim()) return esc(p.text);
    return p?.mode === 'oral' ? '구두로 응답해 내용 미기록' : '서면 응답 미기록';
  }
  const decision = {same:'유지',changed:'변경'}[assessment.predictionMatch] || '미기록';
  const choice = S.bank[assessment.qid]?.options?.find(o => o.label === assessment.choice);
  return '<details><summary>'+esc(snapshot.targetDays)+'일형 · '+esc(dstr(assessment.ts))+' 제출</summary><dl>'
    +'<dt>원형 환자에서의 보기 전 판단</dt><dd>'+judgment(anchor)+'</dd>'
    +'<dt>새 환자에서의 보기 전 판단</dt><dd>'+judgment(assessment)+'</dd>'
    +'<dt>보기 공개 뒤 판단 변화 · 본인 기록</dt><dd>'+esc(decision)+'</dd>'
    +'<dt>최종 선택</dt><dd>'+(choice?esc(choice.label)+'. '+esc(choice.text)+' · ':'')+(assessment.correct?'정답':'오답')+'</dd></dl>'
    +'<p class="hint">두 환자의 어떤 소견이 같은 결정을 뒷받침했거나 행동을 바꿨나요?</p></details>';
}
function transferReviewPanel() {
  const now = Date.now(), rows = transferSchedule(now);
  const ready = rows.filter(row => row.due != null && row.due <= now);
  const scheduled = rows.find(row => row.due != null && row.due > now);
  const firstByItem = new Map();
  for (const attempt of S.attempts) {
    if (!attempt.transferAssessment || attempt.skipped || typeof attempt.correct !== 'boolean' ||
        !Number.isFinite(attempt.ts) || !S.bank[attempt.qid] || !isCurrentAttempt(attempt)) continue;
    const prior = firstByItem.get(attempt.qid);
    if (!prior || attempt.ts < prior.ts) firstByItem.set(attempt.qid, attempt);
  }
  const attempts = [...firstByItem.values()];
  if (!rows.length && !attempts.length && !Object.keys(workspace().transferStarts || {}).length) return '';
  const started = Object.values(workspace().transferStarts || {});
  const availability = ready.length ? `지금 풀 수 있는 새 환자 ${ready.length}명`
    : scheduled ? `다음 평가 가능일 ${esc(dstr(scheduled.due))}`
    : rows.length ? '원형 문항을 풀면 새 환자의 평가일이 정해집니다.' : '준비된 새 환자를 모두 열어 보았습니다.';
  const button = ready.length ? '<button class="btn pri" data-transfer="begin">새 환자 만나기</button>'
    : rows.some(row => !row.anchor) ? '<button class="btn" data-transfer="index">원형 증례 한 문제 풀기</button>' : '';
  const history = [7,30].map(days => {
    const opened = started.filter(s => s.targetDays === days).length;
    if (!opened) return '';
    const group = attempts.filter(a => a.transferAssessment.targetDays === days);
    const correct = group.filter(a => a.correct).length;
    const written = group.filter(a => a.prediction?.mode === 'written' && a.prediction.text?.trim()).length;
    const latest = group.slice().sort((a,b) => b.ts-a.ts)[0]?.transferAssessment;
    const lastPractice = latest?.lastRelatedAt;
    const lag = lastPractice ? Math.floor(Math.max(0, latest.openedAt-lastPractice)/DAY) : null;
    const lagText = lag == null ? '' : ` · 최근 제출 건은 직전 관련 풀이에서 ${lag}일 경과`;
    return `<p class="hint">${days}일형 · 열어 본 환자 ${opened}명 · 현행판 제출 ${group.length}건 · 보기 전 서면 판단 ${written}건 · 선택지 정답 ${group.length ? correct+'/'+group.length : '채점 전'}${lagText}</p>`;
  }).join('');
  const comparisons = attempts.sort((a,b)=>b.ts-a.ts).slice(0,3).map(compareTransferJudgments).join('');
  const evidence = comparisons ? '<h3>최근 제출한 두 환자의 판단 비교</h3>'+comparisons
    : '<p class="hint">첫 변형을 제출하면 원형과 새 환자에서 보기를 열기 전에 남긴 판단을 비교할 수 있습니다.</p>';
  return `<section class="card transfer-card"><h2>처음 보는 변형 환자</h2><p>같은 판단 원리를 다른 환자에게 적용합니다. 원형 문항의 첫 풀이에서 7일 또는 30일 뒤에 열립니다.</p><p><strong>${availability}</strong></p>${button}${history}${evidence}</section>`;
}

function startTransfer(now = Date.now(),targetId=null) {
  const row = transferSchedule(now).find(entry => (!targetId||entry.item.id===targetId)&&entry.due != null && entry.due <= now);
  if (!row) { render(); return; }
  const old = session;
  startSession([row.item.id], true);
  if (old === session || session?.ids[0] !== row.item.id) return;
  let lastRelatedAt = Math.max(row.anchor.last, row.lastSibling || 0);
  for (const it of Object.values(S.bank)) {
    if (it.id === row.item.id || it.objective_id !== row.item.objective_id) continue;
    const prior = lastItemExposure(it.id);
    if (prior != null && prior <= now) lastRelatedAt = Math.max(lastRelatedAt, prior);
  }
  const snapshot = {qid:row.item.id, objective:row.item.objective_id, targetDays:row.days,
    firstStudyAt:row.anchor.first, lastIndexAttemptAt:row.anchor.last, lastSiblingAt:row.lastSibling || null,
    lastRelatedAt, openedAt:now};
  const anchor = lastIndexJudgment(snapshot.objective,now);
  snapshot.indexJudgment = anchor ? {qid:anchor.qid,ts:anchor.ts,revision:anchor.revision,
    prediction:anchor.prediction ? {...anchor.prediction} : null} : null;
  session.transferAssessment = snapshot;
  const w = workspace();
  w.transferStarts ||= {};
  w.transferStarts[row.item.id] = {...snapshot, updatedAt:now};
  persistSession();
}

function writtenPathwayPlan(now=Date.now()){
  const items=Object.values(S.bank).filter(it=>it.objective_id===PROCEDURE_HYPOTENSION&&isStudyEligible(it));
  if(!items.length)return null;
  const evidence=writtenPathwayEvidence(now);
  const currentId=session?.ids?.[session.i];
  const resumed=session&&!session.done&&!session.ans?.[currentId]&&
    (typeof isCurrentSession!=='function'||isCurrentSession(session))&&items.find(it=>it.id===currentId);
  const rows=transferSchedule(now,evidence).filter(r=>r.item.objective_id===PROCEDURE_HYPOTENSION);
  const dated=rows.find(r=>r.due!=null);
  const anchor=items.find(it=>it.variant_role==='index'&&firstItemPresentation(it.id)==null)||
    items.find(it=>it.variant_role==='index');
  let next=null;
  if(resumed)next={kind:'resume',qid:resumed.id};
  else if(dated)next={kind:'retest',qid:dated.item.id,dueAt:dated.due};
  else if(anchor&&!evidence.attempts)next={kind:firstItemPresentation(anchor.id)==null?'new':'practice',qid:anchor.id};
  return {...evidence,next,exhausted:!next&&evidence.attempts>0};
}

function openWrittenPathway(qid,now=Date.now()){
  const next=writtenPathwayPlan(now)?.next;
  if(!next||next.qid!==qid||next.dueAt>now)return false;
  if(next.kind==='resume'){go('quiz');return true;}
  const previous=session;
  if(next.kind==='retest')startTransfer(now,qid);
  else startSession([qid],true);
  return previous!==session&&session?.ids?.[0]===qid;
}

function pathwayWrittenRow(plan,now){
  const n=plan.next;
  const gaps=plan.gaps.map(g=>(g.kind==='text'?'서면 답변 관찰':'구조화 선택')+' · '+g.label);
  const notes=[gaps.length?'재평가할 항목 '+gaps.join(', '):plan.independent&&!plan.unassessed.length?'평가된 행동에서 미해결 항목 없음':'',
    '새 환자의 선지 전 구조화 판단 '+plan.independent+'건 · 세 항목 모두 응답 '+plan.complete+'건',
    '동료·지도자의 첫 서면 응답 대조 '+plan.reviewedText+'건'];
  if(plan.unassessed.length)notes.push('최근 독립 초회 미평가 · '+plan.unassessed.map(k=>PATHWAY_DECISIONS[k]).join(', ')+'. 다음 새 환자에서 선택을 기록하세요.');
  const row={title:'필기 · 선지 전 판단',notes,rank:8};
  if(n?.dueAt>now)notes.push('다른 환자 평가 가능일 '+dstr(n.dueAt));
  else if(n){
    const labels={resume:'진행 중인 환자 이어 풀기',retest:'새 환자로 필기 재평가',new:'첫 필기 환자 시작',practice:'열람한 원형 환자 연습'};
    row.button={action:'written',id:n.qid,label:labels[n.kind]};
    row.rank=n.kind==='resume'?1:n.kind==='retest'?2:6;
  }else if(plan.exhausted)notes.push('평가에 쓸 수 있는 미노출 필기 환자가 없습니다. 같은 환자는 연습에 사용할 수 있습니다.');
  return row;
}
function pathwayRoundRow(state,now){
  const n=state.next,gaps=state.gaps||[];
  const notes=[gaps.length?'다음 모의 당직에서 확인할 행동 '+[...new Set(gaps.map(g=>g.label))].join(', '):
    state.evidence?.independent?'최근 기록에 미해결 행동 없음':'아직 첫 대응의 일치 여부를 기록하지 않았습니다.'];
  if(state.started&&state.evidence)notes.push('보기 전 서술과 선택이 일치했다고 본인이 표시한 첫 증례 '+state.evidence.independent+'건 · 도움 또는 반복 '+
    state.evidence.assisted+'건 · 다른 환자 지연 재평가에서 구조화 선택 기준 충족 '+(state.evidence.delayedIndependentPassed||0)+'건');
  const row={title:'모의 당직 · 첫 행동',notes,rank:8};
  if(n?.dueAt>now)notes.push('다른 환자 평가 가능일 '+dstr(n.dueAt));
  else if(n?.caseId){
    const labels={resume:'모의 당직 이어 하기',new:'첫 모의 환자 시작',retest:'다른 모의 환자로 재평가',practice:'모의 환자 다시 연습'};
    row.button={action:'round',id:n.caseId,label:labels[n.kind]||'모의 환자 시작'};
    row.rank=n.kind==='resume'?1:n.kind==='retest'?2:5;
  }else if(state.exhausted)notes.push('남은 미노출 모의 환자가 없습니다.');
  return row;
}

function pathwayObservationRow(when,escalationSources){
  const pending=typeof pendingCriticalActions==='function'?pendingCriticalActions(when):[];
  let specific=null,handoff=null;
  if(typeof handoffObservationTarget==='function'){
    specific=escalationSources.map(id=>handoffObservationTarget(id)).find(t=>t&&t.status!=='observed-independent');
    handoff=specific||handoffObservationTarget();
  }
  const due=target=>Number(target?.due)||0;
  const critical=pending.find(t=>due(t)<=when)||pending[0];
  const handoffCorrection=handoff&&['coaching','assisted'].includes(handoff.status);
  const target=specific|| (handoffCorrection?handoff:critical||handoff);
  if(!target)return null;
  const isSkill=target===critical;
  const row={title:isSkill?'전체 실기 · 다시 관찰할 중요 단계':'직접 관찰 · 환자 인계',notes:[],rank:8};
  const status={coaching:'교정 후 다시 관찰해야 합니다.',assisted:'도움을 받아 수행한 단계입니다.',
    unobserved:'독립 수행에 대한 관찰 기록이 필요합니다.','observed-independent':'해당 환경에서 독립 수행 기록이 있습니다.'};
  row.notes.push([target.title,target.step].filter(x=>typeof x==='string'&&x).join(' · '));
  row.notes.push(status[target.status]||'관찰 평가 기록을 확인하세요.');
  const role=typeof SKILL_OBSERVERS!=='undefined'?SKILL_OBSERVERS[target.observerRole]:null;
  const setting={simulation:'모의 실습',clinical:'지도하 임상 실습'}[target.setting];
  const evidence=typeof SKILL_EVIDENCE!=='undefined'?SKILL_EVIDENCE[target.evidence]:null;
  if(evidence||role||setting)row.notes.push([role||evidence,setting].filter(Boolean).join(' · '));
  if(!isSkill&&target.feedback){
    const attribution=target.sourceType==='written'?'서면 판단 기록 ':['peer','supervisor'].includes(target.mode)?'수신자가 교정한 내용 ':'이전 연습 메모 ';
    row.notes.push(attribution+target.feedback);
  }
  if(specific)row.notes.unshift('이전 환자에서 도움 요청 또는 보고에 누락이 있었습니다. 같은 상황을 수신자에게 다시 보고하고 되말한 내용과 비교하세요.');
  if(due(target)>when)row.notes.push('다음 관찰일 '+dstr(due(target)));
  if(target.status!=='observed-independent'){
    row.button=isSkill?{action:'skill',id:target.skillId,step:target.stepIndex,label:'해당 단계 관찰 기록 열기'}:
      {action:'handoff',id:target.sourceAttemptId||'',label:'환자 인계 관찰 연습 열기'};
    row.rank=specific?-2:(isSkill||handoffCorrection)&&due(target)<=when?0:4;
  }
  return row;
}

function clinicalPathwayPanel(now=Date.now()){
  const written=writtenPathwayPlan(now);
  const simulation=typeof roundPathwayStatus==='function'?roundPathwayStatus(now):null;
  const escalationSources=[];
  for(const g of written?.gaps||[]){
    if(g.id==='escalation'&&typeof writtenHandoffId==='function'){
      escalationSources.push(writtenHandoffId({qid:g.qid,revision:g.revision,ts:g.sourceAttemptTs}));
    }
  }
  for(const g of simulation?.gaps||[]){
    if(['escalation','handoff'].includes(g.id)&&g.attemptId)escalationSources.push(g.attemptId);
  }
  const observation=pathwayObservationRow(now,escalationSources);
  if(!written&&!simulation&&!observation)return '';
  const writtenRow=written&&pathwayWrittenRow(written,now),roundRow=simulation&&pathwayRoundRow(simulation,now);
  const acuteGaps=[...(written?.gaps||[]),...(simulation?.gaps||[])].filter(g=>['danger','action','recognition','bedside','cause'].includes(g.id));
  if(acuteGaps.length&&roundRow?.button&&['new','retest','resume'].includes(simulation.next.kind)){
    roundRow.rank=-1;
    roundRow.notes.unshift('이전 환자의 '+[...new Set(acuteGaps.map(g=>g.label))].join(', ')+'에서 교정이 필요했습니다. 모의 호출에서 첫 대응을 다시 결정하세요.');
  }else if(writtenRow?.button&&written.next.kind==='new'&&!written.attempts&&!simulation?.started){
    writtenRow.rank=1;
    writtenRow.notes.unshift('아직 이 목표의 첫 판단이 없어 원형 환자부터 시작합니다.');
  }
  const observedRow=observation||{title:'직접 관찰 · 환자 인계',rank:8,
    notes:['이 목표에 연결된 관찰 기록이 없습니다. 모의 호출에서 보고를 마치면 수신자와 관찰 내용을 기록할 수 있습니다.']};
  const rows=[writtenRow,roundRow,observedRow].filter(Boolean).sort((a,b)=>a.rank-b.rank);
  const next=rows.filter(r=>r.button).sort((a,b)=>a.rank-b.rank)[0];
  const markup=rows.map(row=>{
    const b=row.button;
    const button=b?`<button class="btn ${row===next?'pri':''}" data-pathway="${esc(b.action)}" data-id="${esc(b.id||'')}"${b.step==null?'':' data-step="'+esc(b.step)+'"'}>${esc(b.label)}</button>`:'';
    return `<section class="pathway-lane"><h3>${row===next?'먼저 · ':''}${esc(row.title)}</h3><p>${row.notes.filter(Boolean).map(esc).join(' · ')}</p>${button}</section>`;
  }).join('');
  return `<section class="card"><h2>시술 후 저혈압 · 다음 연습</h2>${markup}</section>`;
}

function generalStudyPanel(otherOnly=false) {
  const include=it=>!otherOnly||it?.objective_id!==PROCEDURE_HYPOTENSION;
  const ready = transferSchedule().filter(row => include(row.item)&&row.due != null && row.due <= Date.now());
  const stats = statsMap();
  const activeRisk = Object.keys(stats).filter(id => include(S.bank[id])&&isStudyEligible(S.bank[id]) && dangerOpen(stats[id])).length;
  if(otherOnly&&!ready.length&&!activeRisk)return '';
  const opened = Object.keys(workspace().transferStarts || {}).length;
  let message, href, label;
  if (ready.length) {
    message = '전에 공부한 원리를 새로운 환자에게 적용할 시점입니다. 보기를 열기 전에 첫 판단과 근거를 남겨 보세요.';
    href = '#review'; label = '새 환자 평가';
  } else if (activeRisk) {
    message = `확신하고 틀린 문항 ${activeRisk}개가 남아 있습니다. 지난 선택과 결론을 바꿀 단서를 한 문장씩 비교해 보세요.`;
    href = '#review'; label = '확신 오답 복습';
  } else if (Object.keys(workspace().roundAttempts || {}).length) {
    message = '지난 모의 당직에서 확인한 점을 다른 환자에게 적용해 보세요. 첫 행동과 인계를 각각 기록하면 나중에 두 시도를 비교할 수 있습니다.';
    href = '#rounds'; label = '모의 당직';
  } else if (!Object.values(campus().skills || {}).some(skill => skill.logs?.length)) {
    message = '실기 연습 이력을 시작할 수 있습니다. 학교에서 연습하는 한 항목을 고르고, 관찰받은 행동과 다음에 교정할 점을 남겨 보세요.';
    href = '#skills'; label = '실기 연습 열기';
  } else {
    message = opened ? '이전에 적어 둔 판단과 최근의 환자 설명을 비교하고, 다음번에 바꿀 행동 한 가지를 골라 보세요.'
      : '문항 하나를 고르고 보기를 보기 전에 결론이 바뀔 조건을 적어 보세요. 원형 문항을 풀면 변형 환자 복습이 예약됩니다.';
    href = opened ? '#notebook' : '#quiz'; label = opened ? '추론 노트' : '집중 학습';
  }
  return `<section class="card next-study"><h2>${otherOnly?'다른 복습':'다음 학습에서 보완할 점'}</h2><p>${message}</p><a class="btn" href="${href}">${label}</a></section>`;
}
function nextStudyPanel(){
  const clinical=clinicalPathwayPanel();
  return clinical+generalStudyPanel(!!clinical);
}

app.addEventListener('click', event => {
  const plan=event.target.closest('[data-pathway]');
  if(plan){
    const id=plan.dataset.id;
    if(plan.dataset.pathway==='written')openWrittenPathway(id);
    if(plan.dataset.pathway==='round'&&typeof openPathwayRound==='function')openPathwayRound(id,Date.now());
    if(plan.dataset.pathway==='skill'&&typeof pendingCriticalActions==='function'&&typeof openSkillTarget==='function'){
      const step=Number(plan.dataset.step);
      if(pendingCriticalActions().some(t=>t.skillId===id&&t.stepIndex===step))openSkillTarget(id,step);
      else render();
    }
    if(plan.dataset.pathway==='handoff'&&typeof handoffObservationTarget==='function'&&typeof openHandoffObservation==='function'){
      const target=handoffObservationTarget(id||undefined);
      if(target&&target.status!=='observed-independent')openHandoffObservation(id||undefined);
      else render();
    }
    return;
  }
  const button = event.target.closest('[data-transfer]');
  if (button?.dataset.transfer === 'begin') startTransfer();
  if (button?.dataset.transfer === 'index') {
    const unstarted = new Set(transferSchedule().filter(row => !row.anchor).map(row => row.item.objective_id));
    const item = Object.values(S.bank).find(it => it.variant_role === 'index' &&
      unstarted.has(it.objective_id) && isStudyEligible(it));
    if (item) startSession([item.id], true);
  }
});
