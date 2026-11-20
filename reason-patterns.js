'use strict';

// The existing reflection selector is the only source of a learner's attribution.
Object.assign(NOTE_TYPES, {
  anchoring: '첫 가설에 고정됨',
  perfusion: '관류·충만압 해석 오류',
  evidence: '검사 근거 해석 오류',
  safety: '위험 신호·긴급도 판단 오류'
});

function reasonAttemptKey(attempt, item) {
  return (attempt.revision || itemRevision(item)) + ':' + attempt.ts;
}

function reasonResponse(id) {
  let latest = null;
  for (const attempt of S.attempts) {
    if (attempt.qid !== id || attempt.skipped || !Number.isFinite(attempt.ts) || !isCurrentAttempt(attempt)) continue;
    if (!latest || attempt.ts > latest.ts) latest = attempt;
  }
  return latest;
}

const updateNoteWithoutAttribution = updateNote;
updateNote = function (element) {
  if (element.dataset.note === 'kind') {
    const id = element.dataset.id, item = S.bank[id];
    const note = workspace().notes[id] || {};
    const attempt = item && reasonResponse(id);
    if (attempt) {
      const key = reasonAttemptKey(attempt, item);
      note.reasonPicks = {...note.reasonPicks, [key]: {kind: element.value, updatedAt: Date.now()}};
    } else {
      // A library annotation entered before answering must never become an attributed response later.
      note.reasonPicks ||= {};
    }
    workspace().notes[id] = note;
  }
  return updateNoteWithoutAttribution(element);
};

function recurringReasonGroups() {
  const current = new Map();
  for (const attempt of S.attempts) {
    const item = S.bank[attempt.qid];
    if (!item || attempt.skipped || !Number.isFinite(attempt.ts) || !isCurrentAttempt(attempt)) continue;
    if (!current.has(item.id)) current.set(item.id, new Map());
    current.get(item.id).set(reasonAttemptKey(attempt, item), attempt.ts);
  }
  const groups = new Map();
  for (const [id, note] of Object.entries(workspace().notes)) {
    const item = S.bank[id], responses = current.get(id);
    if (!item || !isStudyEligible(item) || !responses || !note) continue;
    let picks;
    if (note.reasonPicks) {
      picks = Object.entries(note.reasonPicks).filter(([key]) => responses.has(key)).map(([, p]) => p);
    } else {
      // Legacy notes contain an explicit category but no response or edition fingerprint.
      if (Object.keys(item._history || {}).length || ![...responses.values()].some(ts => ts <= note.updatedAt)) continue;
      picks = [note];
    }
    for (const pick of picks) {
      if (!pick || !Object.hasOwn(NOTE_TYPES, pick.kind) || pick.kind === 'insight') continue;
      if (!groups.has(pick.kind)) groups.set(pick.kind, new Map());
      const cases = groups.get(pick.kind);
      const stem = String(item.stem || id).normalize('NFKC').trim().replace(/\s+/g, ' ');
      const previous = cases.get(stem);
      if (!previous || previous.updatedAt < pick.updatedAt) cases.set(stem, {id, updatedAt: pick.updatedAt});
    }
  }
  return [...groups.entries()].filter(([, cases]) => cases.size >= 2).map(([kind, cases]) => ({
    kind, ids: [...cases.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(c => c.id)
  })).sort((a, b) => b.ids.length - a.ids.length || a.kind.localeCompare(b.kind));
}

function reasoningPatternsPanel() {
  const groups = recurringReasonGroups();
  const intro = '<section class="card"><h2>여러 환자에서 반복된 내 판단</h2>';
  if (!groups.length) return intro + '<p class="mut">문항 해설의 ‘내가 놓친 지점’에서 같은 이유를 직접 선택한 서로 다른 증례가 두 개 쌓이면 여기에 표시됩니다.</p></section>';
  const rows = groups.map(group => {
    const labels = group.ids.slice(0, 2).map(id => esc(S.bank[id].topic || S.bank[id].question || id)).join(' · ');
    const count = Math.min(20, group.ids.length);
    return '<tr><td>' + esc(NOTE_TYPES[group.kind]) + '</td><td>' + group.ids.length + '</td><td>' + labels +
      '</td><td><button class="btn sm" data-reason-replay="' + esc(group.kind) + '">보기 전 판단 ' + count +
      '문항</button></td></tr>';
  }).join('');
  return intro + '<p class="mut">풀이 뒤 직접 선택한 이유를 증례별로 셉니다. 같은 환자를 여러 번 풀어도 한 번만 집계합니다.</p>' +
    '<div class="tblwrap"><table class="tbl"><thead><tr><th>내가 선택한 이유</th><th>증례 수</th><th>최근 예시</th><th>다시 풀기</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-reason-replay]');
  if (!button) return;
  const group = recurringReasonGroups().find(entry => entry.kind === button.dataset.reasonReplay);
  if (group) startSession(group.ids.slice(0, 20), true);
});

const mergeBackupWithoutReasonPicks = mergeBackup;
mergeBackup = function (backup) {
  const saved = new Map();
  for (const [id, note] of Object.entries(backup.meta?.workspace?.notes || {})) {
    const local = workspace().notes[id]?.reasonPicks;
    if (!note?.reasonPicks && !local) continue;
    const picks = {...local};
    for (const [key, other] of Object.entries(note?.reasonPicks || {})) {
      if (other && (!picks[key] || other.updatedAt > picks[key].updatedAt)) picks[key] = other;
    }
    saved.set(id, picks);
  }
  const result = mergeBackupWithoutReasonPicks(backup);
  for (const [id, picks] of saved) {
    if (workspace().notes[id]) workspace().notes[id].reasonPicks = picks;
  }
  return result;
};
