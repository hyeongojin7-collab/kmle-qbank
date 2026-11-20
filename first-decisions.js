'use strict';

const DECISION_NAMES={danger:'위험 인식',action:'침상 첫 행동',escalation:'도움 요청'};
const TEXT_RATINGS={met:'기준 충족',missed:'교정 필요',unclear:'판정 유보'};

function pendingDecisions(){
  if(!session||session.done||!session.optionsOpened)return false;
  const id=session.ids[session.i];
  return !session.ans[id]&&!!S.bank[id]?.initial_decisions?.length&&session.clinicalJudgment?.qid!==id;
}

function firstClinicalTextForm(){
  const confidence=[1,2,3].map(n=>'<button data-w="pre-confidence" data-value="'+n+'" aria-pressed="'+(session.preConfidence===n)+'">'+n+' · '+esc(CONF_KO[n])+'</button>').join('');
  return '<section class="recall-panel"><h3>병실에서 받은 첫 연락</h3><label for="reasoning-draft">지금 어떤 상황으로 보고, 무엇을 하겠습니까? 함께 일하는 사람에게 실제로 할 말도 적어 보세요.</label>'
    +'<textarea id="reasoning-draft" rows="4" maxlength="5000">'+esc(session.reasoning||'')+'</textarea>'
    +'<div class="conf"><span>첫 판단의 확신도</span><div class="seg">'+confidence+'</div></div>'
    +'<div class="actions"><button class="btn pri" data-w="open-options">첫 판단 저장 · 초기 대응 선택</button><button class="btn" data-w="open-options" data-mode="oral">구두 응답 · 내용 미기록</button><button class="btn ghost" data-w="open-options" data-mode="omitted">서면 응답 생략</button></div></section>';
}

function clinicalChoicesForm(it){
  const fields=it.initial_decisions.map(r=>{
    const choices=r.choices.map(c=>'<option value="'+esc(c.id)+'" '+(session.decisionPicks?.[r.id]===c.id?'selected':'')+'>'+esc(c.text)+'</option>').join('');
    return '<label class="field">'+esc(r.prompt)+'<select data-first-pick="'+esc(r.id)+'"><option value="">판단 보류</option>'+choices+'</select></label>';
  }).join('');
  return '<section class="recall-panel"><h3>지금 내릴 결정</h3><p>각 상황에서 할 행동을 고르세요. 보류한 항목도 그대로 남습니다.</p>'+fields
    +'<div class="actions"><button class="btn pri" data-lock-decisions>결정 확정 · 필기 보기 열기</button></div></section>';
}

function lockClinicalJudgment(now=Date.now()){
  if(!pendingDecisions())return;
  const id=session.ids[session.i],item=S.bank[id];
  const decisions=item.initial_decisions.map(r=>{
    const choice=r.choices.find(c=>c.id===session.decisionPicks?.[r.id]);
    return {id:r.id,selected:choice?.id??null,correct:choice?choice.id===r.key:null};
  });
  const presentation=session.presentation;
  const fresh=presentation?.qid===id&&presentation.prior===null&&firstItemExposure(id)==null;
  const caseContext={stem:String(item.stem||'').slice(0,6000),title:String(item.topic||'').slice(0,180),revision:itemRevision(item)};
  session.clinicalJudgment={qid:id,objective:item.objective_id,lockedAt:now,freshPresentation:fresh,caseContext,decisions};
  session.decisionPicks=null;
  persistSession();
}

function textReviewKey(a){return JSON.stringify([a.qid,a.revision,a.ts]);}
function validTextReview(r){
  return r&&['peer','instructor'].includes(r.role)&&Number.isFinite(r.at)&&
    Object.keys(DECISION_NAMES).every(id=>Object.hasOwn(TEXT_RATINGS,r.ratings?.[id]));
}
function firstTextReview(a){
  const review=a&&workspace().judgmentReviews?.[textReviewKey(a)];
  return validTextReview(review)?review:null;
}
function mergeJudgmentReviews(w,incoming){
  for(const [key,review] of Object.entries(incoming||{})){
    if(!key.startsWith('[')||!validTextReview(review))continue;
    const all=w.judgmentReviews||(w.judgmentReviews={});
    if(!validTextReview(all[key])||review.at<all[key].at)all[key]=review;
  }
}
function saveFirstTextReview(a,role,ratings,confirmed){
  if(!a||a.skipped||!isCurrentAttempt(a)||!a.clinicalJudgment||a.prediction?.mode!=='written'||
    !a.prediction.text?.trim()||!confirmed||firstTextReview(a))return false;
  const review={role,ratings:{...ratings},at:Date.now()};
  if(!validTextReview(review))return false;
  const w=workspace();w.judgmentReviews||={};w.judgmentReviews[textReviewKey(a)]=review;
  persistWorkspace();return true;
}

function textReviewForm(it,a){
  if(a.prediction?.mode!=='written'||!a.prediction.text?.trim())return '<p class="hint">대조할 첫 서면 응답이 없습니다.</p>';
  const review=firstTextReview(a);
  if(review)return '<p><strong>'+esc(review.role==='instructor'?'지도자':'동료')+'가 대조한 첫 서면 응답</strong> · '
    +Object.entries(DECISION_NAMES).map(([id,name])=>name+' '+TEXT_RATINGS[review.ratings[id]]).join(' · ')+'</p>';
  const fields=it.initial_decisions.map(r=>'<label class="field"><strong>'+DECISION_NAMES[r.id]+'</strong>'+esc(r.criterion)
    +'<select name="'+esc(r.id)+'" required><option value="">판정 선택</option>'+Object.entries(TEXT_RATINGS).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>').join('');
  return '<details><summary>동료·지도자가 첫 서면 응답 대조하기</summary><p style="white-space:pre-wrap">'+esc(a.prediction.text)+'</p><form data-text-review="'+esc(textReviewKey(a))+'">'
    +fields+'<label class="field">확인자<select name="role" required><option value="">선택</option><option value="peer">동료</option><option value="instructor">지도자</option></select></label>'
    +'<label><input type="checkbox" name="confirmed" required> 위의 첫 서면 응답을 읽고 직접 대조했습니다.</label> <button class="btn" type="submit">대조 기록 저장</button></form></details>';
}

function clinicalDecisionResult(it,a){
  if(!Array.isArray(a.clinicalJudgment?.decisions)||!it.initial_decisions?.length)return '';
  const rows=it.initial_decisions.map(r=>{
    const d=a.clinicalJudgment.decisions.find(x=>x?.id===r.id);
    const choice=r.choices.find(c=>c.id===d?.selected);
    return '<li><strong>'+DECISION_NAMES[r.id]+'</strong> · '+(choice?esc(choice.text):'판단 보류')+' · '
      +(d?.correct===true?'기준 충족':d?.correct===false?'교정 필요':'미평가')+'<p class="hint">'+esc(r.criterion)+'</p></li>';
  }).join('');
  return '<section class="card"><h3>필기 보기 전 초기 대응</h3><ul>'+rows+'</ul>'
    +(typeof it.model_handoff==='string'?'<details><summary>인계 예시</summary><p>'+esc(it.model_handoff)+'</p></details>':'')
    +textReviewForm(it,a)+'</section>';
}

function firstDecisionInsights(){
  const submissions=S.attempts.filter(a=>!a.skipped&&a.clinicalJudgment&&isCurrentAttempt(a)&&S.bank[a.qid]?.initial_decisions?.length).sort((a,b)=>b.ts-a.ts);
  if(!submissions.length)return '';
  const fresh=submissions.filter(a=>a.clinicalJudgment.freshPresentation).length;
  const reviewed=submissions.filter(a=>firstTextReview(a)).length;
  return '<section class="card"><h2>초기 대응과 서면 판단</h2><p>구조화된 결정 제출 '+submissions.length+'건 · 처음 제시된 문항 '+fresh+'건 · 동료·지도자가 대조한 서면 응답 '+reviewed+'건</p>'
    +submissions.slice(0,10).map(a=>'<details><summary>'+esc(dstr(a.ts))+' · '+esc(S.bank[a.qid].topic||a.qid)+'</summary>'+clinicalDecisionResult(S.bank[a.qid],a)+'</details>').join('')+'</section>';
}

document.addEventListener('change',event=>{
  const id=event.target.dataset.firstPick;
  if(!id||!pendingDecisions())return;
  const row=S.bank[session.ids[session.i]].initial_decisions.find(r=>r.id===id);
  if(!row)return;
  session.decisionPicks||={};session.decisionPicks[id]=row.choices.some(c=>c.id===event.target.value)?event.target.value:null;
  persistSession();
});
document.addEventListener('click',event=>{
  if(event.target.closest('[data-lock-decisions]')&&pendingDecisions()){lockClinicalJudgment();render();}
});
document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-text-review]');
  if(!form)return;
  event.preventDefault();
  const attempt=S.attempts.find(a=>textReviewKey(a)===form.dataset.textReview);
  const ratings=Object.fromEntries(Object.keys(DECISION_NAMES).map(id=>[id,form.elements.namedItem(id).value]));
  if(saveFirstTextReview(attempt,form.elements.role.value,ratings,form.elements.confirmed.checked)){
    render();toast('첫 서면 판단에 대한 대조 기록을 저장했습니다.');
  }
});
