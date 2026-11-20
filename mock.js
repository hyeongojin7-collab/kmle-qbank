'use strict';

let mockSelected='',mockDebrief=null;

function mockWorkspace(){const w=workspace();return w.mocks||(w.mocks={});}

function mockHistory(){return Object.values(mockWorkspace()).sort((a,b)=>b.startedAt-a.startedAt||b.id.localeCompare(a.id));}

function mockPool(){
  return Object.values(S.bank).filter(item=>!item.block_id && item.variant_role!=='transfer' &&
    isStudyEligible(item) && firstItemPresentation(item.id)==null && firstItemExposure(item.id)==null);
}

function mockCoverage(items){
  if(!items.length)return '';
  // Show only known broad categories. Imported metadata can contain an answer or a patient vignette.
  const counts=[new Map(),new Map(),new Map()];
  const categories=['과목','분과','판단 유형'],other='기타·미분류';
  for(const item of items){
    const subject=canon(item.subject,SUBJ_ALIASES),system=canon(primSys(item),SYS_ALIASES);
    const type=Object.entries(TYPE_KO).find(([code,label])=>_key(code)===_key(item.question_type)||_key(label)===_key(item.question_type));
    const row=[Object.hasOwn(SUBJ_ALIASES,subject)?subject:other,Object.hasOwn(SYS_ALIASES,system)?system:other,type?type[1]:other];
    row.forEach((label,i)=>counts[i].set(label,(counts[i].get(label)||0)+1));
  }
  const systems=counts[1],small='소표본·미분류';
  for(const [label,n] of [...systems]){
    if(n<3||label===other){
      systems.delete(label);
      systems.set(small,(systems.get(small)||0)+n);
    }
  }
  const rows=counts.map((group,i)=>{
    const labels=[...group].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko'));
    return `<dt>${categories[i]}</dt><dd>${labels.map(([label,n])=>`${esc(label)} ${n}문항`).join(' · ')}</dd>`;
  });
  return `<details><summary>출제 가능한 문항의 분포</summary><dl>${rows.join('')}</dl><p class="hint mut">이 문제은행 기준이며 공식 출제 비율과의 일치도는 미평가입니다. 1~2문항인 분과는 묶어 표시합니다.</p></details>`;
}

function mixedMockItems(items,count){
  const groups=new Map();
  for(const item of shuffle(items.slice())){
    const key=primSys(item)||item.subject||'기타';
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  }
  const selected=[];
  while(selected.length<count && groups.size){
    for(const [key,group] of groups){
      selected.push(group.pop());
      if(!group.length)groups.delete(key);
      if(selected.length===count)break;
    }
  }
  return selected;
}

function mockQuestionSnapshot(item){
  // Store the original question, answer and immediate rationale. Omit notes, source files and other workspace contents.
  const answerNote=item.option_analysis?.[item.answer]||{};
  return {id:item.id,revision:itemRevision(item),stem:item.stem,question:item.question,labs:Array.isArray(item.labs)?item.labs.map(row=>({...row})):[],
    findings_text:item.findings_text||'',options:item.options.map(o=>({label:o.label,text:o.text})),answer:item.answer,
    why:answerNote.why_best||answerNote.mechanism||item.takeaway||'',
    traps:Object.fromEntries(item.options.map(o=>[o.label,item.option_analysis?.[o.label]?.trap||''])),
    system:primSys(item)||item.subject||'미분류'};
}

function newMockBlock(count,now=Date.now()){
  if(![5,10,20].includes(count)||mockHistory().some(b=>!b.finishedAt))return null;
  const items=mixedMockItems(mockPool(),count);
  if(!items.length)return null;
  const block={id:uid('MOCK'),startedAt:now,deadline:now+items.length*90000,index:0,updatedAt:now,
    questions:items.map(mockQuestionSnapshot),answers:{},seen:{},withdrawn:{}};
  mockWorkspace()[block.id]=block;
  mockSelected=block.id;mockDebrief=null;
  showMockItem(block,0,now);
  return block;
}

function mockCurrent(q){
  const item=S.bank[q.id];
  return isStudyEligible(item)&&itemRevision(item)===q.revision&&!item.block_id;
}

function withdrawMockQuestion(block,q){
  if(!mockCurrent(q))block.withdrawn[q.id]='검토 상태 또는 판본 변경';
  else if(!block.withdrawn[q.id]){
    const feedbackAt=lastItemExposure(q.id);
    if(feedbackAt!=null&&feedbackAt>=block.startedAt)block.withdrawn[q.id]='블록 진행 중 다른 경로에서 응답·해설 노출';
    else if(!block.seen[q.id]&&firstItemPresentation(q.id)!=null)block.withdrawn[q.id]='다른 학습에서 먼저 열린 문항';
  }
  return !!block.withdrawn[q.id];
}

function showMockItem(block,index,now=Date.now()){
  if(!block||block.finishedAt||!Number.isInteger(index)||!block.questions[index])return false;
  if(now>=block.deadline){finishMockBlock(block,now);return false;}
  block.index=index;block.updatedAt=now;
  const q=block.questions[index];
  withdrawMockQuestion(block,q);
  if(!block.withdrawn[q.id]&&!block.seen[q.id]){
    block.seen[q.id]=now;
    markItemPresentation(q.id,now);
  }else persistWorkspace();
  return true;
}

function setMockChoice(block,label,now=Date.now()){
  if(!block||block.finishedAt)return false;
  if(now>=block.deadline){finishMockBlock(block,now);return false;}
  const q=block.questions[block.index];
  if(withdrawMockQuestion(block,q)){persistWorkspace();return false;}
  if(!block.seen[q.id]||(label!=null&&!q.options.some(o=>o.label===label)))return false;
  block.answers[q.id]={choice:label,at:now};block.updatedAt=now;
  persistWorkspace();return true;
}

function mockTotals(block){
  let correct=0,unanswered=0,withdrawn=0;
  for(const q of block.questions){
    if(block.withdrawn[q.id]){withdrawn++;continue;}
    const choice=block.answers[q.id]?.choice;
    if(choice==null)unanswered++;
    else if(choice===q.answer)correct++;
  }
  return {correct,unanswered,withdrawn,total:block.questions.length-withdrawn};
}

function recoverMockAttempts(){
  const canonical=new Map(),finishedIds=new Set();
  for(const block of mockHistory()){
    if(!block.finishedAt)continue;
    for(const q of block.questions){
      const answer=block.answers[q.id],attemptId=block.id+'/'+q.id;
      finishedIds.add(attemptId);
      if(!answer||answer.choice==null||block.withdrawn[q.id]||!S.bank[q.id])continue;
      canonical.set(attemptId,{attemptId,qid:q.id,choice:answer.choice,correct:answer.choice===q.answer,
        ts:answer.at,ms:Math.max(0,answer.at-(block.seen[q.id]||answer.at)),
        conf:null,revision:q.revision,recallFirst:false,mode:'mock',retrieval:'recognition'});
    }
  }
  let changed=false;
  const attempts=[];
  for(const row of S.attempts){
    if(row.mode!=='mock'||!finishedIds.has(row.attemptId)){attempts.push(row);continue;}
    const expected=canonical.get(row.attemptId);
    if(expected){
      attempts.push(expected);canonical.delete(row.attemptId);
      if(row.ts!==expected.ts||row.choice!==expected.choice||row.revision!==expected.revision||row.correct!==expected.correct)changed=true;
    }else changed=true;
  }
  if(!changed&&!canonical.size)return false;
  S.attempts=attempts.concat([...canonical.values()]).sort((a,b)=>a.ts-b.ts);
  return true;
}

function finishMockBlock(block,now=Date.now()){
  if(!block||block.finishedAt)return;
  for(const q of block.questions)withdrawMockQuestion(block,q);
  block.finishedAt=Math.min(now,block.deadline);
  block.timedOut=now>=block.deadline;
  block.updatedAt=now;
  const added=recoverMockAttempts();persistWorkspace();
  if(added)save('attempts');
}

function mergeMockBlock(local,incoming){
  if(!local)return incoming;
  if(local.finishedAt||incoming.finishedAt){
    if(!local.finishedAt)return incoming;
    if(!incoming.finishedAt)return local;
    // Both devices closed the same block. The first submission is the recorded result.
    return local.finishedAt<=incoming.finishedAt?local:incoming;
  }
  const latest=incoming.updatedAt>local.updatedAt?incoming:local;
  const merged={...latest,seen:{...local.seen},answers:{...local.answers},withdrawn:{...local.withdrawn,...incoming.withdrawn}};
  for(const [id,ts] of Object.entries(incoming.seen||{}))merged.seen[id]=Math.min(merged.seen[id]??ts,ts);
  for(const [id,answer] of Object.entries(incoming.answers||{})){
    if(!merged.answers[id]||answer.at>merged.answers[id].at)merged.answers[id]=answer;
  }
  return merged;
}

function mockDuration(ms){
  const seconds=Math.ceil(Math.max(0,ms)/1000);
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}

function mockDebriefView(block,q){
  const mine=block.answers[q.id]?.choice;
  const selection=q.options.find(o=>o.label===mine)?.text||'미응답';
  const key=q.options.find(o=>o.label===q.answer)?.text||q.answer;
  return `<section class="card"><h2>${esc(q.system)} · 문항 복기</h2>${qBody(q,{interactive:false,choice:mine,hideOptions:true})}
    <p>내 응답 · ${esc(selection)}</p><p><strong>출제 당시 정답 · ${esc(key)}</strong></p>
    ${q.why?`<p>${esc(q.why)}</p>`:''}${mine&&mine!==q.answer&&q.traps[mine]?`<p>${esc(q.traps[mine])}</p>`:''}
    ${!mockCurrent(q)?'<p>제출 당시 응답을 표시합니다. 현재 문항은 검토 상태 또는 판본이 바뀌었습니다. <a href="#browse">문제 라이브러리</a></p>':''}</section>`;
}

function vMock(){
  const now=Date.now(),history=mockHistory();
  for(const b of history)if(!b.finishedAt&&now>=b.deadline)finishMockBlock(b,now);
  const active=history.filter(b=>!b.finishedAt),block=mockWorkspace()[mockSelected]||active[0]||history[0];
  let h=pageHeading('시간제 모의 블록','근거와 선지 해설 기준을 통과한 미노출 KMLE 문항을 분과별로 섞어 풉니다.');
  if(block&&!block.finishedAt){
    if(active.length>1)h+=`<div class="actions">${active.map(b=>`<button class="btn" data-mock="open" data-value="${esc(b.id)}">${esc(dstr(b.startedAt))} · ${b.questions.length}문항 이어 풀기</button>`).join('')}</div>`;
    const q=block.questions[block.index],choice=block.answers[q.id]?.choice;
    if(!block.withdrawn[q.id]&&withdrawMockQuestion(block,q))persistWorkspace();
    h+=`<div class="card"><div class="section-title"><h2>문항 ${block.index+1} / ${block.questions.length}</h2><strong id="mock-clock" aria-label="남은 시간">${mockDuration(block.deadline-now)}</strong></div>`;
    if(block.withdrawn[q.id])h+=`<p>채점 제외 · ${esc(typeof block.withdrawn[q.id]==='string'?block.withdrawn[q.id]:'검토 상태 또는 사전 노출')}</p>`;
    else h+=qBody(q,{interactive:false,choice:null,hideOptions:true})+`<div class="opts">${q.options.map(o=>`<button class="opt ${choice===o.label?'sel':''}" data-mock="choose" data-value="${esc(o.label)}" aria-pressed="${choice===o.label}"><span class="ol">${esc(CIR[o.label]||o.label)}</span><span>${fmt(o.text)}</span></button>`).join('')}</div>`;
    h+=`<div class="actions"><button class="btn" data-mock="previous" ${block.index===0?'disabled':''}>이전</button><button class="btn" data-mock="next" ${block.index===block.questions.length-1?'disabled':''}>다음</button><button class="btn ghost" data-mock="clear" ${choice==null?'disabled':''}>응답 지우기</button></div>
      <div class="actions">${block.questions.map((it,i)=>`<button class="btn sm ${i===block.index?'pri':''}" data-mock="jump" data-value="${i}" aria-label="${i+1}번 ${block.answers[it.id]?.choice!=null?'응답':'미응답'}">${i+1}${block.answers[it.id]?.choice!=null?' ✓':''}</button>`).join('')}</div></div>
      <div class="actions"><button class="btn pri" data-mock="finish">블록 제출</button></div>`;
    return h;
  }
  if(block?.finishedAt){
    const t=mockTotals(block);
    h+=`<div class="card"><h2>${block.timedOut?'시간 종료':'제출 완료'}</h2><p><strong>제출 당시 ${t.correct} / ${t.total} 정답</strong> · 미응답 ${t.unanswered} · 제외 ${t.withdrawn} · 소요 ${mockDuration(block.finishedAt-block.startedAt)}</p><div class="actions">${block.questions.map((q,i)=>`<button class="btn" data-mock="debrief" data-value="${i}" ${block.withdrawn[q.id]?'disabled':''}>${i+1}번 · ${block.withdrawn[q.id]?'제외':block.answers[q.id]?.choice==null?'미응답':block.answers[q.id].choice===q.answer?'정답':'오답'}${!block.withdrawn[q.id]&&!mockCurrent(q)?' · 이전 검토 상태':''}</button>`).join('')}</div></div>`;
    if(mockDebrief!=null&&block.questions[mockDebrief]&&!block.withdrawn[block.questions[mockDebrief].id])h+=mockDebriefView(block,block.questions[mockDebrief]);
  }
  const availableItems=mockPool(),available=availableItems.length;
  if(!active.length)h+=`<div class="card"><h2>새 블록</h2><p>출제 가능 ${available}문항 · 문항당 90초 · 제출 후 해설 공개</p>
    ${mockCoverage(availableItems)}
    <p>선택한 수보다 문항이 적으면 남은 수로 시작합니다. 처음 보는 변형 환자는 별도 복습에 남겨 둡니다.</p><div class="actions">${[5,10,20].map(n=>`<button class="btn" data-mock="start" data-value="${n}" ${available?'':'disabled'}>${n}문항</button>`).join('')}<a class="btn ghost" href="#browse">문제 라이브러리</a></div></div>`;
  if(history.length)h+=`<div class="card"><h2>블록 기록</h2>${history.map(b=>`<p><button class="btn" data-mock="open" data-value="${esc(b.id)}">${esc(dstr(b.startedAt))} · ${b.questions.length}문항 · ${b.finishedAt?'결과 보기':'이어 풀기'}</button></p>`).join('')}</div>`;
  return h;
}

const previousMockMerge=mergeBackup;
mergeBackup=function(data){
  const result=previousMockMerge(data),blocks=mockWorkspace();
  for(const [id,incoming] of Object.entries(data.meta?.workspace?.mocks||{})){
    if(incoming?.id===id&&Array.isArray(incoming.questions)&&incoming.answers&&incoming.seen&&incoming.withdrawn)blocks[id]=mergeMockBlock(blocks[id],incoming);
  }
  recoverMockAttempts();
  return result;
};

const previousMockLoad=loadLocal;
loadLocal=async function(){
  await previousMockLoad();
  if(recoverMockAttempts())await save('attempts');
};

app.addEventListener('click',event=>{
  const btn=event.target.closest('[data-mock]');
  if(!btn)return;
  const action=btn.dataset.mock,value=btn.dataset.value;
  const block=mockWorkspace()[mockSelected]||mockHistory().find(b=>!b.finishedAt);
  if(action==='start')newMockBlock(Number(value));
  else if(action==='open'){
    if(!mockWorkspace()[value])return;
    mockSelected=value;mockDebrief=null;
    const opened=mockWorkspace()[value];
    if(!opened.finishedAt)showMockItem(opened,opened.index);
  }else{
    if(!block)return;
    mockSelected=block.id;
    if(action==='finish'){
      if(!block.finishedAt&&Date.now()<block.deadline&&!confirm('남은 시간을 종료하고 현재 응답을 제출할까요?'))return;
      finishMockBlock(block);
    }else if(action==='choose'||action==='clear')setMockChoice(block,action==='clear'?null:value);
    else if(action==='previous'||action==='next'||action==='jump')showMockItem(block,action==='jump'?Number(value):block.index+(action==='next'?1:-1));
    else if(action==='debrief'){
      const index=Number(value),q=block.questions[index];
      if(!q||!block.finishedAt||block.withdrawn[q.id])return;
      mockDebrief=index;
      if(!block.seen[q.id])block.seen[q.id]=Date.now();
      markAnswerExposure(q.id);
    }else return;
  }
  render();
});

setInterval(()=>{
  const clock=document.getElementById('mock-clock');
  if(!clock)return;
  const block=mockWorkspace()[mockSelected]||mockHistory().find(b=>!b.finishedAt);
  if(!block||block.finishedAt)return;
  const remaining=block.deadline-Date.now();
  if(remaining<=0){finishMockBlock(block);render();}
  else clock.textContent=mockDuration(remaining);
},1000);
