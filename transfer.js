/* Keep unseen variants available for delayed application of the same learning objective. */
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

function transferSchedule(now = Date.now()) {
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
  for (const item of Object.values(S.bank)) {
    if (!isStudyEligible(item) || !isReservedTransfer(item)) continue;
    const days = transferWindow(item);
    const anchor = anchors.get(item.objective_id);
    const previous = Object.values(workspace().transferStarts || {}).filter(start =>
      start.objective === item.objective_id && start.qid !== item.id && Number.isFinite(start.openedAt));
    const lastSibling = previous.reduce((last, start) => Math.max(last, start.openedAt), 0);
    const due = anchor ? Math.max(anchor.first + days * DAY, lastSibling ? lastSibling + 7 * DAY : 0) : null;
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

function startTransfer(now = Date.now()) {
  const row = transferSchedule(now).find(entry => entry.due != null && entry.due <= now);
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

function nextStudyPanel() {
  const ready = transferSchedule().filter(row => row.due != null && row.due <= Date.now());
  const stats = statsMap();
  const activeRisk = Object.keys(stats).filter(id => isStudyEligible(S.bank[id]) && dangerOpen(stats[id])).length;
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
  return `<section class="card next-study"><h2>다음 학습에서 보완할 점</h2><p>${message}</p><a class="btn" href="${href}">${label}</a></section>`;
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-transfer]');
  if (button?.dataset.transfer === 'begin') startTransfer();
  if (button?.dataset.transfer === 'index') {
    const unstarted = new Set(transferSchedule().filter(row => !row.anchor).map(row => row.item.objective_id));
    const item = Object.values(S.bank).find(it => it.variant_role === 'index' &&
      unstarted.has(it.objective_id) && isStudyEligible(it));
    if (item) startSession([item.id], true);
  }
});
