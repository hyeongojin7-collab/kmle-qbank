'use strict';
/* No API key or remote upload. Original files stay in IndexedDB until exported. */
let selectedBlock='',selectedExam='',selectedSkill='',schoolBusy=false;
const assetAvailability=new Map();
function campus(){const w=workspace();w.blocks=w.blocks||{};w.skills=w.skills||{};return w;}
function uid(prefix){return prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));}
function activeBlock(){return campus().blocks[selectedBlock];}
function activeExam(){const b=activeBlock();if(!b)return null;return b.exams.find(e=>e.id===selectedExam)||b.exams[0];}
function schoolItems(block,exam){return Object.values(S.bank).filter(it=>it.block_id===block&&(!exam||it.exam_id===exam));}
function fileSize(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';}
function blockSelector(){return `<div class="campus-tabs">${Object.values(campus().blocks).map(b=>`<button class="campus-tab ${selectedBlock===b.id?'active':''}" data-campus="select-block" data-id="${esc(b.id)}">${icon('layers')}${esc(b.title)}</button>`).join('')}<button class="campus-tab" data-campus="new-block">${icon('plus')}블록 추가</button></div>`;}
function vSchool(){const blocks=Object.values(campus().blocks);if(!selectedBlock&&blocks.length)selectedBlock=blocks[0].id;const b=activeBlock();let h=pageHeading('학교 블록시험','강의 자료에서 출제 범위까지. 이번 시험을 하나의 흐름으로.',`<button class="btn" data-campus="new-block">${icon('plus')}새 블록</button>`);
 h+=`<div class="campus-banner"><div class="system-icon">${icon('layers')}</div><div><strong>자료 → 시험범위 → AI 출제 → 검토 → 풀이</strong><p>자료는 이 브라우저에 보관합니다. 출제는 사용 중인 AI에서 진행하고 결과를 가져옵니다. 사이트의 API 호출은 없습니다.</p></div></div>`;
 if(!b)return h+`<div class="card empty"><div class="empty-icon">${icon('layers')}</div><h2>이번 학기의 첫 블록을 만들어 보세요.</h2><p>예: 2학년 1학기 · 신장–내분비<br>정리 PDF, 기출, 강의 PPT, 녹음본을 한곳에 모으고 시험별 범위를 지정할 수 있어요.</p><div class="actions" style="justify-content:center"><button class="btn pri" data-campus="new-block">첫 블록 만들기</button></div></div>`;
 const exam=activeExam();selectedExam=exam.id;const materialMap=exam.materials||{};const selected=b.materials.filter(m=>materialMap[m.id]?.selected),questions=schoolItems(b.id,exam.id),verified=questions.filter(q=>q.school_verified),reviewNeeded=questions.length-verified.length;
 h+=blockSelector()+`<div class="card"><div class="section-title"><div><div class="eyebrow">${esc(b.semester||'나의 학기')}</div><h2>${esc(b.title)}</h2></div><button class="btn ghost sm" data-campus="edit-block">블록 정보</button></div><div class="exam-bar"><label class="field">시험 범위<select id="exam-select">${b.exams.map(e=>`<option value="${esc(e.id)}" ${e.id===exam.id?'selected':''}>${esc(e.title)}</option>`).join('')}</select></label><button class="btn sm" data-campus="new-exam">${icon('plus')}시험 추가</button><label class="field">시험일<input type="date" data-exam="date" value="${esc(exam.date||'')}"></label><span class="mut" style="font-size:11px">${selected.length}개 자료 선택 · 검토 완료 ${verified.length} / ${questions.length}문항</span></div><label class="field">시험범위 · 교수님 강조점<textarea rows="3" maxlength="10000" data-exam="instructions" placeholder="예: 신장 1–4강, 내분비 1–2강. 교수님이 강조한 감별 기준과 강의별 비중을 적어 주세요.">${esc(exam.instructions||'')}</textarea></label></div>`;
 h+=`<section class="card"><div class="section-title"><h2>블록 자료</h2><label class="btn">${icon('plus')}자료 추가<input id="campus-files" type="file" accept=".pdf,.ppt,.pptx,.mp3,.m4a,.wav,.txt,.md,.docx,.png,.jpg,.jpeg,.webm,.mp4,.json" multiple hidden></label></div><p class="mut" style="font-size:12px;margin-bottom:19px">이번 시험에 포함할 자료를 체크하고 페이지·슬라이드·녹음 구간을 적어 주세요. 원문 자동 분석·음성 전사는 이 사이트에서 실행되지 않습니다.</p>${b.materials.length?b.materials.map(m=>{const scope=materialMap[m.id]||{},available=assetAvailability.get(m.id);return `<div class="material-row"><label class="material-check"><input type="checkbox" data-material="selected" data-id="${esc(m.id)}" ${scope.selected?'checked':''} aria-label="${esc(m.name)} 시험범위 포함"></label><div class="material-info"><strong>${esc(m.name)}</strong><small>${esc(m.kind||'자료')} · ${fileSize(m.size)}${available===false?' · 파일 복원 필요':''}</small></div><label class="field material-range">포함 범위<input type="text" maxlength="1000" data-material="range" data-id="${esc(m.id)}" value="${esc(scope.range||'')}" placeholder="전체 / p.12–40 / 10:00–35:00" aria-label="${esc(m.name)} 포함 범위"></label><button class="btn ghost sm" data-campus="download-material" data-id="${esc(m.id)}">받기</button>${available===false?`<label class="btn sm">파일 복원<input type="file" data-restore="${esc(m.id)}" hidden></label>`:''}</div>`;}).join(''):`<div class="upload-placeholder">${icon('archive')}<span>정리본 · 기출 PDF · 강의 PPT · 녹음본<br><small>파일당 최대 100 MB · 브라우저 저장공간 내에서 보관</small></span></div>`}<div id="campus-file-status" role="status" class="hint mut"></div></section>`;
 h+=`<div class="campus-columns"><section class="card"><div class="eyebrow">01 / CREATE WITH YOUR AI</div><h2>범위에 맞는 변형문제 요청</h2><p class="mut" style="font-size:12px">선택한 자료를 사용하는 AI에 직접 첨부하고 아래 요청문을 붙여넣으세요. 녹음은 해당 서비스가 지원하는 경우 원본을, 아니면 전사본을 사용하세요.</p><div class="row"><label class="field">문항 수<input id="school-count" type="number" min="1" max="30" value="${exam.count||10}" style="width:85px"></label><label class="field">출제 방식<select id="school-style"><option value="mixed" ${exam.style==='mixed'?'selected':''}>기전 + 사례 변형</option><option value="past" ${exam.style==='past'?'selected':''}>기출 구조의 변형</option><option value="professor" ${exam.style==='professor'?'selected':''}>강의 강조점 중심</option></select></label></div><div class="actions"><button class="btn pri" data-campus="copy-prompt" ${selected.length?'':'disabled'}>${icon('copy')}출제 요청문 복사</button><button class="btn" data-campus="download-pack" ${selected.length?'':'disabled'}>${icon('download')}자료 묶음 ZIP</button></div><p class="hint mut">ZIP에는 원본 자료·범위표·요청문이 들어갑니다. AI가 ZIP을 지원하지 않으면 압축을 풀어 파일을 첨부하세요. 기존 구독의 업로드·사용량 제한은 적용됩니다.</p></section><section class="card"><div class="eyebrow">02 / REVIEW & STUDY</div><h2>생성된 문항 가져오기</h2><p class="mut" style="font-size:12px">AI가 반환한 JSON을 붙여넣으세요. 현재 블록·시험과 연결되며, 모든 새 문항은 근거 검토 대기 상태로 들어갑니다.</p><textarea id="school-import" rows="5" aria-label="학교 문항 JSON" placeholder='{"items": [...]}'></textarea><div class="actions"><button class="btn" data-campus="import-questions">현재 시험에 가져오기</button><button class="btn pri" data-campus="study-exam" ${verified.length?'':'disabled'}>검토한 ${verified.length}문항 풀기</button></div><div id="school-report" role="status"></div></section></div>`;
 h+=`${exam.source_reports?.length?`<details class="card"><summary>AI의 자료 접근·범위·충돌 보고</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(exam.source_reports,null,2))}</pre></details>`:''}<section class="card"><div class="section-title"><h2>이번 시험의 문항</h2><span class="mut" style="font-size:11px">${reviewNeeded}문항 근거 검토 대기</span></div>${questions.length?questions.map(q=>`<details class="school-question"><summary><span class="status-pill ${q.school_verified?'correct':'danger'}">${q.school_verified?'검토 완료':'근거 확인'}</span><span>${esc(q.topic||q.question||q.id)}</span></summary><div class="school-question-body"><div class="source-check"><strong>출제 근거</strong><p>${(q.source_refs||[]).map(r=>esc(typeof r==='string'?r:[r.file,r.section,r.page||r.timestamp].filter(Boolean).join(' · '))).join('<br>')||'근거 위치가 없습니다. 원문과 대조하고 AI에 근거를 보완해 달라고 요청하세요.'}</p></div>${qBody(q,{interactive:false,choice:null})}${explanation(q,null)}<div class="actions"><button class="btn ${q.school_verified?'':'pri'}" data-campus="verify-question" data-id="${esc(q.id)}">${q.school_verified?'검토 대기로 되돌리기':'원문과 정답 확인 완료'}</button><button class="btn ghost" data-w="open-question" data-id="${esc(q.id)}">라이브러리에서 열기</button></div></div></details>`).join(''):'<p class="mut" style="font-size:12px">범위를 지정하고 첫 변형문제를 가져오세요.</p>'}</section>`;
 return h;
}
function newBlock(){const title=prompt('블록 이름을 입력하세요. 예: 신장–내분비');if(!title?.trim())return;const semester=prompt('학기 (예: 본과 2학년 1학기)','본과 2학년 1학기');if(semester===null)return;const id=uid('BLOCK'),eid=uid('EXAM');campus().blocks[id]={id,title:title.trim(),semester:semester.trim(),materials:[],exams:[{id:eid,title:'블록 시험',date:'',instructions:'',materials:{},count:10,style:'mixed'}],createdAt:Date.now(),updatedAt:Date.now()};selectedBlock=id;selectedExam=eid;persistWorkspace();render();}
function selectedSources(){const b=activeBlock(),e=activeExam();return b?b.materials.filter(m=>e.materials?.[m.id]?.selected):[];}
function schoolPrompt(){const b=activeBlock(),e=activeExam(),materials=selectedSources();return `# 학교 블록시험 — 자료 기반 변형문제 출제\n\n블록: ${b.title}\n학기: ${b.semester}\n시험: ${e.title}\n시험일: ${e.date||'미정'}\n문항 수: ${e.count||10}\n방식: ${{mixed:'기전 이해와 사례 변형의 균형',past:'기출의 평가 목표를 유지하면서 사례·수치·선지를 새로 구성',professor:'교수님 강의 강조점 중심'}[e.style||'mixed']}\n\n## 정확한 출제 범위\n${materials.map((m,i)=>`${i+1}. ${m.name}\n   자료 ID: ${m.id}\n   포함 구간: ${e.materials[m.id].range||'전체 (별도 범위 지정 없음)'}`).join('\n')}\n\n## 강의 강조점과 범위 제한\n${e.instructions||'추가 지정 없음'}\n\n## 수행 규칙\n1. 첨부 자료의 실제 내용을 먼저 읽고, 접근 가능한 파일과 읽지 못한 파일·구간을 밝히세요. 파일명만 보고 내용을 추정하지 마세요. 녹음을 처리할 수 없으면 전사본을 요청하세요.\n2. 위 범위 내에서 출제하세요. 범위 밖 정보가 필요하면 해당 문항을 보류하고 누락을 보고하세요. 녹음의 명확한 타임스탬프와 PDF 페이지/PPT 슬라이드를 근거에 표시하세요.\n3. 강의의 강조점과 기출의 학습 목표를 반영하되 문장을 복사하는 수준을 넘어, 사례·수치·질문 유형을 바꾸세요. 단일 최선 정답과 설득력 있는 오답 4개를 구성하세요.\n4. 각 문항의 근거로 정확한 파일명과 페이지·슬라이드·시간을 반드시 남기세요. 존재하지 않는 근거 위치를 만들지 마세요.\n5. 강의와 최신 임상 기준이 충돌하면 둘을 구분해 conflict를 표시하세요. 근거가 불명확하거나 정답이 복수인 문항은 출제하지 마세요.\n6. 선택지마다 기전, 정답/오답 이유, 함정, 해당 선택지가 맞는 조건을 설명하세요. 본문은 한국어, 핵심 의학 용어는 clinical English를 사용하세요.\n7. 먼저 자료별 출제 개수와 범위 충족 여부를 간단히 검토하고, 최종 결과는 아래 형식의 유효한 JSON 코드블록 하나로 주세요. 각 문항의 subject, system, subtopic은 내용에 맞게 작성하세요.\n\n## JSON 형식 (필드명 유지)\n{\n  "schema_version": "2.0",\n  "block_id": "${b.id}",\n  "exam_id": "${e.id}",\n  "batch_meta": {"source_status": "읽은 자료와 읽지 못한 자료", "conflicts": [], "coverage_gaps": []},\n  "items": [{\n    "subject": "내과", "system": "실제 분과", "subtopic": "실제 단원", "topic": "학습 목표를 나타내는 제목",\n    "stem": "증례", "question": "질문",\n    "options": [{"label":"A","text":"선지"},{"label":"B","text":"선지"},{"label":"C","text":"선지"},{"label":"D","text":"선지"},{"label":"E","text":"선지"}],\n    "answer": "A", "difficulty": 5, "learning_objective": "평가하는 판단", "takeaway": "재사용할 원칙",\n    "causal_chain": ["정상 생리", "교란", "검사 소견", "판단"],\n    "option_analysis": {"A":{"verdict":"correct","mechanism":"기전","why_best":"최선인 이유"},"B":{"verdict":"incorrect","mechanism":"기전","trap":"함정","correct_when":"맞는 상황"},"C":{"verdict":"incorrect","mechanism":"기전","trap":"함정"},"D":{"verdict":"incorrect","mechanism":"기전","trap":"함정"},"E":{"verdict":"incorrect","mechanism":"기전","trap":"함정"}},\n    "source_refs": [{"file":"정확한 원본 파일명","section":"페이지/슬라이드/타임스탬프"}],\n    "misconception_tags": ["오개념"], "generator_confidence":"high"\n  }]\n}\n\n이 JSON은 사용자가 원문과 대조한 뒤 학습에 사용합니다. 근거에 접근하지 못했다면 문항을 지어내지 말고 필요한 자료를 먼저 요청하세요.`;}
async function putAsset(id,file){const db=await(dbp||(dbp=idbOpen()));await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(file,'asset:'+id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('파일 저장 중단'));});assetAvailability.set(id,true);}
function saveBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);}
async function addMaterials(files,restoreId){if(schoolBusy)return;const b=activeBlock(),e=activeExam();if(!b)return;schoolBusy=true;const messages=[];for(const file of files){if(file.size>100*1048576){messages.push(file.name+': 100 MB 초과. 녹음을 분할하거나 전사본을 사용하세요.');continue;}if(restoreId&&file.name!==b.materials.find(m=>m.id===restoreId)?.name){messages.push(file.name+': 원래 파일명과 일치하는 원본을 선택하세요.');continue;}const id=restoreId||uid('SOURCE');try{await putAsset(id,file);if(restoreId){const old=b.materials.find(m=>m.id===id);if(old){old.size=file.size;old.restoredAt=Date.now();}}else{b.materials.push({id,name:file.name,type:file.type,size:file.size,kind:/\.(mp3|m4a|wav|webm|mp4)$/i.test(file.name)?'녹음·영상':/\.pptx?$/i.test(file.name)?'강의 슬라이드':'문서·자료',addedAt:Date.now()});e.materials[id]={selected:true,range:''};}messages.push(file.name+': 저장 완료');}catch(err){messages.push(file.name+': 저장 실패. 브라우저 용량 또는 저장소 접근을 확인하세요.');}}b.updatedAt=Date.now();await persistWorkspace();schoolBusy=false;render();const status=$('#campus-file-status');if(status)status.textContent=messages.join(' / ');}
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
async function zipFiles(files){const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;for(const f of files){const name=encoder.encode(f.name),bytes=new Uint8Array(await f.blob.arrayBuffer()),crc=crc32(bytes),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);parts.push(header,bytes);const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=header.length+bytes.length;}const size=directory.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);parts.push(...directory,end);return new Blob(parts,{type:'application/zip'});}
async function downloadPack(){const b=activeBlock(),e=activeExam();if(schoolBusy)return;schoolBusy=true;toast('선택한 원본 자료와 시험범위를 묶고 있어요.');try{const entries=[],sources=[];for(const[i,m]of selectedSources().entries()){const blob=await kvGet('asset:'+m.id);if(!(blob instanceof Blob))throw new Error(m.name+' 원본 파일이 없습니다. 파일 복원 후 다시 시도하세요.');const path='materials/'+String(i+1).padStart(2,'0')+'/'+m.name.replace(/[\\/]/g,'_');entries.push({name:path,blob});sources.push({...m,path,range:e.materials[m.id].range||'전체'});}entries.push({name:'출제_요청문.txt',blob:new Blob([schoolPrompt()],{type:'text/plain'})},{name:'manifest.json',blob:new Blob([JSON.stringify({schema:'genesis-study-pack',version:1,block:{id:b.id,title:b.title,semester:b.semester},exam:e,sources},null,2)],{type:'application/json'})});const zip=await zipFiles(entries);saveBlob(zip,(b.title+'_'+e.title).replace(/[\\/:*?"<>|]/g,'_')+'.zip');toast('자료 묶음을 내보냈어요. 압축을 풀어 사용하는 AI에 첨부하세요.');}catch(err){toast(err.message,'err');}finally{schoolBusy=false;}}
const CLINICAL_DOMAINS={cpx:'CPX · 환자 진료',osce:'OSCE · 술기',communication:'환자 설명 · 인계'};
function skillTemplate(type){if(type==='cpx')return ['도입: 소개·환자 확인·면담 목적 설명','응급성 및 주요 위험 신호 확인','가설을 구분하는 병력청취','적응증에 맞는 진찰 선택·설명','핵심 소견 요약과 감별 근거 제시','검사·치료 계획과 불확실성 설명','환자의 걱정 확인·마무리'];if(type==='communication')return ['핵심 상황과 판단을 먼저 전달','근거와 우선순위를 구분해 설명','불확실성과 다음 행동을 명시','상대방의 이해와 질문 확인'];return ['학교 평가표에서 준비·안전 항목 입력','학교 평가표에서 술기 수행 단계를 입력','학교 평가표에서 마무리·정리 항목 입력'];}
const SKILL_STARTERS = {
  "chest-pain": {
    "title": "흉통 환자의 첫 면담",
    "type": "cpx",
    "source": "NICE CG95 §1.2 · 급성 흉통 초진. Genesis 모의 면담용으로 재구성",
    "url": "https://www.nice.org.uk/guidance/cg95",
    "scenario": "외래에서 56세 환자가 “계단에서 가슴이 조였어요”라고 말한다. 첫 질문을 하고 면담을 이어가세요.",
    "partner": "물어보면 답하세요. 통증이 20분째 지속되고 쉬어도 가라앉지 않으며 식은땀이 납니다. 위험성을 알아채면 즉시 도움을 요청하는지, 그 이유를 이해할 수 있게 말하는지 관찰하세요.",
    "steps": [
      "환자에게 자신을 소개하고 가장 걱정되는 증상을 듣는다.",
      "현재도 아픈지, 언제 시작했고 어떻게 변했는지 묻는다.",
      "통증의 성격·부위·방사와 식은땀·호흡곤란 등 동반 증상을 확인한다.",
      "! 진행 중인 위험 증상을 알아차리고 면담을 멈춰 활력징후 확인과 즉각적인 도움을 요청한다.",
      "환자에게 응급 평가가 필요한 이유를 쉬운 말로 설명한다."
    ]
  },
  "hand-rub": {
    "title": "손소독제 사용을 직접 관찰하기",
    "type": "osce",
    "source": "WHO · How to handrub? (2009), 손위생 교육 포스터",
    "url": "https://www.who.int/teams/integrated-health-services/infection-prevention-control/hand-hygiene/training-tools",
    "scenario": "실습실에서 손에 눈에 보이는 오염이 없는 상황을 가정합니다. 손소독제를 사용하고 동료가 도포 범위와 건조까지 관찰합니다.",
    "steps": [
      "눈에 보이는 오염 여부를 확인하고 이 상황에 적절한 손위생 방법을 선택한다.",
      "양손의 모든 표면을 적실 만큼 손소독제를 덜어 손바닥을 문지른다.",
      "양쪽 손등, 손가락 사이와 손가락 뒷면에 닿도록 문지른다.",
      "양쪽 엄지와 손가락 끝·손톱 주변을 반대 손바닥에 문지른다.",
      "! 전체 동작을 약 20–30초 시행하고 마를 때까지 문지른다."
    ]
  },
  "sbar": {
    "title": "악화한 환자에 대해 전화 보고하기",
    "type": "communication",
    "source": "AHRQ TeamSTEPPS 3.0 · Tool: SBAR, Genesis 모의 인계",
    "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html",
    "scenario": "가상 환자의 시술 후 혈압이 128/76에서 84/58로 떨어지고 식은땀이 난다. 상급자에게 지금 필요한 도움을 요청하세요.",
    "steps": [
      "현재 상태와 긴급성을 첫 문장에 전달한다.",
      "시술 직후라는 배경과 활력징후의 변화를 전달한다.",
      "직접 확인한 소견과 의심하는 원인을 구분한다.",
      "! 즉시 필요한 지원을 구체적으로 요청하고 상대방의 응답을 확인한다."
    ]
  }
};
const SKILL_EVIDENCE={self:"혼자 연습",peer:"동료가 직접 관찰",supervised:"지도자가 직접 관찰"};
const SKILL_ASSISTANCE={independent:"참여자 도움 없이 수행",verbal:"말로 단서 제공",hands:"동작을 직접 도와줌",stopped:"중단 또는 시범으로 전환"};

function newSkillDraft(){return {checks:[],notes:'',evidence:'self',setting:'simulation',assistance:'',remediation:'',interval:'1',followup:false};}

function skillRubricError(s){
  const steps = Array.isArray(s.steps) ? s.steps : [];
  if (!steps.length || steps.some(step=>typeof step!=='string'||!step.replace(/^!\s*/,'').trim())) return '체크리스트에 실제로 관찰할 행동을 입력하세요.';
  if (s.type==='osce') {
    if (!String(s.source||'').trim()) return '술기 교육자료 이름이나 학교 평가표 출처를 입력하세요.';
    if (steps.some(step=>skillTemplate('osce').includes(step.trim()))) return 'OSCE 틀의 안내 문구를 실제 수행 단계로 바꾸세요.';
  }
  return '';
}

function skillLogKey(log){
  if (log.id) return String(log.id);
  // Old records have no ID. Equal timestamps alone do not identify the same practice.
  return 'legacy:'+JSON.stringify([log.ts,log.checked,log.total,log.missed||[],log.notes||'',log.evidence||'']);
}

function mergeSkillRecords(local,incoming){
  const newer = !local || (incoming.updatedAt||0)>(local.updatedAt||0) ? incoming : local;
  const records = new Map();
  for (const history of [local?.logs,incoming.logs]) {
    const occurrences=new Map();
    for (const log of Array.isArray(history)?history:[]) {
      if (!log||typeof log!=='object') continue;
      const key=skillLogKey(log),count=occurrences.get(key)||0;
      occurrences.set(key,count+1);
      records.set(log.id?key:JSON.stringify([key,count]),log);
    }
  }
  const logs = [...records.values()].sort((a,b)=>a.ts-b.ts || skillLogKey(a).localeCompare(skillLogKey(b)));
  const latest = logs[logs.length-1];
  const latestSource=[newer,local,incoming].find(s=>latest&&s?.logs?.some(l=>skillLogKey(l)===skillLogKey(latest)));
  return {...newer, logs, due:latest?.nextDue ?? latestSource?.due ?? newer.due};
}

function addSkillStarter(key){
  const example = SKILL_STARTERS[key];
  if (!example) return;
  const id='SKILL-STARTER-'+key;
  const skills=campus().skills;
  if (!skills[id]) {
    const {url,...spec}=example;
    skills[id]={id,...spec,steps:[...spec.steps],sourceUrl:url,logs:[],createdAt:Date.now(),updatedAt:Date.now()};
  }
  selectedSkill=id;
  persistWorkspace();
  render();
}

function skillPracticeResult(s,draft){
  const rubricProblem=skillRubricError(s);
  if (rubricProblem) return {error:rubricProblem};
  const evidence=Object.hasOwn(SKILL_EVIDENCE,draft.evidence)?draft.evidence:'self';
  const observed=evidence!=='self';
  const setting=evidence==='supervised'&&draft.setting==='clinical'?'clinical':'simulation';
  const notes=String(draft.notes||'').trim(), remediation=String(draft.remediation||'').trim();
  if (observed&&(!notes||!Object.hasOwn(SKILL_ASSISTANCE,draft.assistance))) return {error:'관찰한 행동 한 가지와 실제 도움 수준을 기록하세요.'};
  const checked=new Set((draft.checks||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<s.steps.length));
  if (!checked.size&&!notes&&!remediation) return {error:'실제로 연습한 단계를 체크하거나 관찰한 내용을 기록하세요.'};
  const missed=s.steps.filter((_,i)=>!checked.has(i));
  const critical=missed.filter(step=>/^!\s/.test(step));
  if (observed&&(critical.length||draft.assistance!=='independent')&&!remediation) return {error:'다음 관찰에서 다시 확인할 행동을 한 가지 적으세요.'};
  const ts=Date.now(),days=[1,3,7,14].includes(Number(draft.interval))?Number(draft.interval):1;
  const previous=(s.logs||[]).at(-1);
  return {log:{id:uid('PRACTICE'),ts,checked:checked.size,total:s.steps.length,missed,notes,evidence,setting,
    assistance:observed?draft.assistance:'',critical,remediation,followupOf:draft.followup&&previous?skillLogKey(previous):null,
    rubric:{source:s.source||'',steps:[...s.steps]},nextDue:ts+days*DAY}};
}

function skillLogView(log){
  const mode=log.id?SKILL_EVIDENCE[log.evidence]:({self:'혼자 연습',peer:'동료와 연습',supervised:'지도하 연습'})[log.evidence];
  const help=SKILL_ASSISTANCE[log.assistance];
  return `<div class="skill-log"><span class="bdg">${esc(dstr(log.ts))}</span> <strong>${esc(log.checked)}/${esc(log.total)}단계</strong>
    <span class="mut"> · ${esc(mode||'방식 미기록')}${log.setting?' · '+(log.setting==='clinical'?'임상 실습':'모의 실습'):''}${help?' · '+esc(help):''}</span>
    ${log.followupOf?'<p>이전 연습에 이어 재평가</p>':''}
    ${log.evidence!=='self'&&!help?'<p>과거 기록 · 관찰 수준 미기록</p>':''}
    <p>${esc(log.notes||'피드백 기록 없음')}</p>
    ${log.missed?.length?`<p>체크하지 않은 단계 · ${log.missed.map(esc).join(' / ')}</p>`:''}
    ${log.remediation?`<p>다음에 확인할 행동 · ${esc(log.remediation)}</p>`:''}
    ${log.rubric?`<details><summary>사용한 평가표</summary><p>${esc(log.rubric.source||'자기연습용')}</p><ol>${log.rubric.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></details>`:''}</div>`;
}

function skillStartersView(){
  return `<div class="card"><h2>실습 예시</h2><div class="actions">${Object.entries(SKILL_STARTERS).map(([key,s])=>`<button class="btn" data-campus="skill-starter" data-id="${esc(key)}">${esc(s.title)}</button>`).join('')}</div></div>`;
}

function practiceOptions(labels,current,empty){
  const lead=empty?'<option value="">선택하세요</option>':'';
  return lead+Object.entries(labels).map(([v,label])=>`<option value="${esc(v)}" ${v===String(current)?'selected':''}>${esc(label)}</option>`).join('');
}

function vSkills(){
  const skills=Object.values(campus().skills),now=Date.now();
  const due=skills.filter(s=>!s.due||s.due<=now),logs=skills.flatMap(s=>s.logs||[]);
  let h=pageHeading('실기 연습','',`<button class="btn" data-campus="new-skill">${icon('plus')}연습 항목</button>`);
  h+=`<div class="metrics skills-metrics">${metric(skills.length,'연습 항목','체크리스트','layers')}${metric(due.length,'복습할 항목','미연습 또는 복습일 도달','repeat')}${metric(logs.length,'연습 기록','자기 기록 및 관찰 피드백','check')}</div>`;
  if (!skills.length) return h+skillStartersView()+`<div class="card"><button class="btn" data-campus="new-skill">학교 평가표로 새 항목 만들기</button></div>`;
  if (!campus().skills[selectedSkill]) selectedSkill=skills[0].id;
  const s=campus().skills[selectedSkill],draft={...newSkillDraft(),...s.draft},observed=draft.evidence!=='self';
  const history=[...(s.logs||[])].reverse(),previous=history[0],rubricProblem=skillRubricError(s);
  const rubricUrl=s.sourceUrl&&/^https?:\/\//i.test(s.sourceUrl)?` · <a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener noreferrer">교육자료 열기</a>`:'';
  h+=`<div class="skills-layout"><div class="skill-menu">${skills.map(item=>`<button class="skill-item ${item.id===s.id?'active':''}" data-campus="select-skill" data-id="${esc(item.id)}"><strong>${esc(item.title)}</strong><small>${esc(CLINICAL_DOMAINS[item.type])} · ${!item.due||item.due<=now?'복습할 때':'다음 '+dstr(item.due)}</small></button>`).join('')}</div>
  <section><div class="card"><div class="section-title"><div><div class="eyebrow">${esc(CLINICAL_DOMAINS[s.type])}</div><h2>${esc(s.title)}</h2></div><button class="btn ghost sm" data-campus="edit-skill">체크리스트 편집</button></div>
  ${s.scenario?`<p>${esc(s.scenario)}</p>`:''}${s.partner?`<details><summary>상대역 지침</summary><p>${esc(s.partner)}</p></details>`:''}
  <p class="mut">출처 · ${esc(s.source||'미등록')}${rubricUrl}</p>${rubricProblem?`<p class="banner info">${esc(rubricProblem)}</p>`:''}
  <div class="checklist">${(s.steps||[]).map((step,i)=>`<label><input type="checkbox" data-skill-step="${i}" ${draft.checks.includes(i)?'checked':''}><span><small>${String(i+1).padStart(2,'0')}</small>${/^!\s/.test(step)?'<strong>안전 필수 · </strong>':''}${esc(step.replace(/^!\s+/,''))}</span></label>`).join('')}</div>
  <label class="field">연습 방식<select id="skill-evidence" data-practice="evidence">${practiceOptions(SKILL_EVIDENCE,draft.evidence)}</select></label>
  ${draft.evidence==='supervised'?`<label class="field">관찰 환경<select data-practice="setting">${practiceOptions({simulation:'모의 실습',clinical:'지도하 임상 실습'},draft.setting)}</select></label>`:''}
  ${observed?`<label class="field">관찰자가 수행 중 제공한 도움<select id="skill-assistance" data-practice="assistance">${practiceOptions(SKILL_ASSISTANCE,draft.assistance,true)}</select></label>`:''}
  <label class="field">${observed?'직접 본 행동과 관찰 피드백':'자기연습 메모'}<textarea id="skill-observation" data-practice="notes" rows="2" maxlength="3000" placeholder="실명이나 환자 식별정보 없이 행동만 기록">${esc(draft.notes)}</textarea></label>
  <label class="field">다음에 다시 확인할 행동<textarea id="skill-remediation" data-practice="remediation" rows="2" maxlength="1000">${esc(draft.remediation)}</textarea></label>
  ${previous?`<label><input type="checkbox" data-practice="followup" ${draft.followup?'checked':''}> 지난 연습에 이어 재평가${previous.remediation?' · '+esc(previous.remediation):''}</label>`:''}
  <label class="field">다음 복습<select id="skill-interval" data-practice="interval">${practiceOptions({1:'내일',3:'3일 뒤',7:'7일 뒤',14:'14일 뒤'},draft.interval)}</select></label>
  <p class="hint mut">관찰 피드백은 학습자가 기록합니다. 독립 수행 승인은 지도자의 평가 절차를 따르세요.</p>
  <div class="actions"><button class="btn pri" data-campus="record-skill" ${rubricProblem?'disabled':''}>수행 기록 저장</button><button class="btn" data-campus="skill-prompt">${icon('copy')}역할극 요청문 복사</button></div></div>
  <div class="card"><h2>수행 기록</h2>${history.length?history.slice(0,3).map(skillLogView).join(''):'<p>첫 연습을 기록하세요.</p>'}${history.length>3?`<details><summary>이전 기록 ${history.length-3}건</summary>${history.slice(3).map(skillLogView).join('')}</details>`:''}</div></section></div>`;
  return h+skillStartersView();
}

function savePracticeDraft(target){
  const s=campus().skills[selectedSkill],key=target.dataset.practice;
  if (!s||!['evidence','setting','assistance','notes','remediation','interval','followup'].includes(key)) return;
  const draft=s.draft||(s.draft=newSkillDraft());
  draft[key]=target.type==='checkbox'?target.checked:target.value;
  s.updatedAt=Date.now(); persistWorkspace();
}

async function recordSkillPractice(){
  const s=campus().skills[selectedSkill]; if (!s) return;
  const result=skillPracticeResult(s,{...newSkillDraft(),...s.draft});
  if (result.error) {toast(result.error,'err'); return;}
  (s.logs||(s.logs=[])).push(result.log);
  s.due=result.log.nextDue;s.draft=newSkillDraft();s.updatedAt=result.log.ts;
  render();
  await persistWorkspace();
  toast('연습 기록을 저장했어요.');
}
function newSkill(){const title=prompt('연습할 항목 (예: 복통 문진, 봉합, 심폐소생술)');if(!title?.trim())return;const raw=prompt('분류: CPX, OSCE, 설명 중 하나를 입력하세요.','CPX');if(raw===null)return;const type=/osce|술기/i.test(raw)?'osce':/설명|인계/.test(raw)?'communication':'cpx',id=uid('SKILL');campus().skills[id]={id,title:title.trim(),type,steps:skillTemplate(type),source:'',isTemplate:true,logs:[],createdAt:Date.now(),updatedAt:Date.now()};selectedSkill=id;persistWorkspace();render();}
function showEditor(type){const b=activeBlock(),s=campus().skills[selectedSkill];const el=document.createElement('dialog');el.className='campus-dialog';el.innerHTML=type==='block'?`<form method="dialog"><h2>블록 정보</h2><label class="field">블록 이름<input name="title" value="${esc(b.title)}" required></label><label class="field">학기<input name="semester" value="${esc(b.semester)}"></label><div class="actions"><button class="btn pri" value="save">저장</button><button class="btn ghost" value="cancel" formnovalidate>취소</button></div></form>`:`<form method="dialog"><h2>체크리스트 편집</h2><label class="field">항목 이름<input name="title" value="${esc(s.title)}" required></label><label class="field">평가표·교육자료 출처<input name="source" value="${esc(s.source||'')}" placeholder="예: 학교 OSCE 평가표 2027, p.12"></label><label class="field">관찰할 행동 (한 줄에 하나, 안전 필수 단계는 ! 로 시작)<textarea name="steps" rows="12" required>${esc(s.steps.join('\n'))}</textarea></label><p class="hint mut">실제 술기는 공식 교육자료와 지도자의 감독 아래 연습하세요.</p><div class="actions"><button class="btn pri" value="save">저장</button><button class="btn ghost" value="cancel" formnovalidate>취소</button></div></form>`;document.body.appendChild(el);el.addEventListener('close',()=>{if(el.returnValue==='save'){const f=new FormData(el.querySelector('form'));if(type==='block'){b.title=String(f.get('title')).trim();b.semester=String(f.get('semester')).trim();b.updatedAt=Date.now();}else{s.title=String(f.get('title')).trim();const source=String(f.get('source')).trim();if(s.source!==source)delete s.sourceUrl;s.source=source;s.steps=String(f.get('steps')).split('\n').map(x=>x.trim()).filter(Boolean);s.draft={checks:[],notes:''};s.isTemplate=false;s.updatedAt=Date.now();}persistWorkspace();render();}el.remove();});el.showModal();}
const baseCampusLoad=loadLocal;
loadLocal=async function(){await baseCampusLoad();if(session?.ids.some(id=>S.bank[id]?.block_id&&!S.bank[id].school_verified)){session=null;workspace().resume=null;await persistWorkspace();}for(const b of Object.values(campus().blocks)){for(const m of b.materials||[]){const file=await kvGet('asset:'+m.id);assetAvailability.set(m.id,file instanceof Blob);}}};
const baseCampusMerge=mergeBackup;
mergeBackup=function(b){
  const result=baseCampusMerge(b),w=campus(),incoming=b.meta?.workspace;
  for (const [id,block] of Object.entries(incoming?.blocks||{})) {
    if (!w.blocks[id]||(block.updatedAt||0)>(w.blocks[id].updatedAt||0)) w.blocks[id]=block;
  }
  for (const [id,skill] of Object.entries(incoming?.skills||{})) {
    if (skill&&typeof skill==='object') w.skills[id]=mergeSkillRecords(w.skills[id],skill);
  }
  return result;
};
const baseCampusPool=pool;
pool=function(f=setup){return baseCampusPool(f).filter(id=>!S.bank[id].block_id||!!S.bank[id].school_verified);};
const baseCampusStart=startSession;
startSession=function(ids,recallFirst=false){return baseCampusStart(ids.filter(id=>!S.bank[id]?.block_id||S.bank[id].school_verified),recallFirst);};
function saveExamInput(t){const b=activeBlock(),e=activeExam();if(!b||!e)return;if(t.dataset.exam)e[t.dataset.exam]=t.value;if(t.dataset.material){const m=e.materials[t.dataset.id]||(e.materials[t.dataset.id]={selected:false,range:''});m[t.dataset.material]=t.type==='checkbox'?t.checked:t.value;}if(t.id==='school-count')e.count=Math.max(1,Math.min(30,Number(t.value)||10));if(t.id==='school-style')e.style=t.value;b.updatedAt=Date.now();persistWorkspace();}
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.exam||t.dataset.material||t.id==='school-count')saveExamInput(t);
  if(t.dataset.practice&&t.tagName==='TEXTAREA')savePracticeDraft(t);
});
document.addEventListener('change',async e=>{const t=e.target;if(t.dataset.practice){savePracticeDraft(t);if(t.dataset.practice==='evidence')render();return;}if(t.id==='campus-files'){await addMaterials([...t.files]);return;}if(t.dataset.restore){await addMaterials([...t.files],t.dataset.restore);return;}if(t.id==='exam-select'){selectedExam=t.value;render();return;}if(t.dataset.material||t.dataset.exam||t.id==='school-style'){saveExamInput(t);if(t.type==='checkbox')render();}if(t.dataset.skillStep!=null){const s=campus().skills[selectedSkill];s.draft=s.draft||{checks:[],notes:''};s.draft.checks=[...app.querySelectorAll('[data-skill-step]:checked')].map(x=>+x.dataset.skillStep);s.updatedAt=Date.now();persistWorkspace();}});
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-campus]');if(!btn)return;const b=activeBlock(),ex=activeExam(),id=btn.dataset.id;switch(btn.dataset.campus){
 case'new-block':newBlock();break;
 case'select-block':selectedBlock=id;selectedExam='';render();break;
 case'edit-block':showEditor('block');break;
 case'new-exam':{const title=prompt('시험/범위 이름 (예: 중간시험, 신장 1–4강)');if(!title?.trim())break;const eid=uid('EXAM');b.exams.push({id:eid,title:title.trim(),date:'',instructions:'',materials:{},count:10,style:'mixed'});b.updatedAt=Date.now();selectedExam=eid;persistWorkspace();render();break;}
 case'download-material':{const m=b.materials.find(x=>x.id===id),file=await kvGet('asset:'+id);if(file instanceof Blob)saveBlob(file,m.name);else toast('이 브라우저에 원본이 없습니다. 파일 복원을 이용하세요.','err');break;}
 case'copy-prompt':await copy(schoolPrompt());break;
 case'download-pack':await downloadPack();break;
 case'import-questions':{try{const text=$('#school-import').value;if(!text.trim()){toast('AI가 반환한 JSON을 붙여넣으세요.');break;}const parsed=parseInput(text),raw=parsed.flatMap(x=>extractItems(x).items);if(!raw.length)throw new Error('items 배열에서 문항을 찾지 못했습니다.');const items=raw.map(q=>({...q,id:ex.id+'-'+makeId(normalizeItem(q)),block_id:b.id,exam_id:ex.id,school_verified:false,needs_review:true}));ex.source_reports=parsed.map(x=>x.batch_meta).filter(Boolean);b.updatedAt=Date.now();persistWorkspace();const rep=ingestData([{items}],'school:'+b.id+'/'+ex.id);await saveAll();render();$('#school-report').innerHTML=reportHTML(rep);toast('현재 시험에 문항을 가져왔어요. 원문 근거를 먼저 확인하세요.');}catch(err){$('#school-report').innerHTML=`<div class="banner bad">${esc(err.message)}</div>`;}break;}
 case'verify-question':{
    const q=S.bank[id];
    if(!q||q.block_id!==b?.id||q.exam_id!==ex?.id)break;
    if(q.school_verified){
      q.school_verified=false;q.needs_review=true;q.school_verified_at=null;
      delete q._schoolVerifiedRevision;
    }else{
      const missing=missingQualityEvidence(q);
      if(missing.length){toast('검토에 필요한 내용 · '+missing.join(' / '),'err');break;}
      q.school_verified=true;q.needs_review=false;q.school_verified_at=Date.now();
      q._schoolVerifiedRevision=itemRevision(q);
    }
    await save('bank');render();break;
 }
 case'study-exam':startSession(schoolItems(b.id,ex.id).filter(q=>q.school_verified&&!S.flags[q.id]).map(q=>q.id));break;
 case'new-skill':newSkill();break;
 case'select-skill':selectedSkill=id;render();break;
 case'edit-skill':showEditor('skill');break;
 case'skill-starter':addSkillStarter(id);break;
 case'record-skill':await recordSkillPractice();break;
 case'skill-prompt':{const s=campus().skills[selectedSkill];await copy(`의과대학 실기 연습: ${s.title}\n유형: ${CLINICAL_DOMAINS[s.type]}\n평가표 출처: ${s.source||'사용자 확인 필요'}\n체크리스트:\n${s.steps.map((v,i)=>`${i+1}. ${v}`).join('\n')}\n\nCPX라면 표준화 환자 역할로 시작하고 내가 묻는 정보만 단계적으로 답해 주세요. 술기라면 각 단계의 목적·안전 확인·누락을 구두로 점검해 주세요. 실제 손동작을 관찰하지 않았으므로 수행 숙련도를 인증하지 마세요. 평가표 밖의 상세 술기나 의학적 주장은 공식 자료로 확인하고 불확실성을 표시하세요. 내가 시작하기 전 정답과 체크리스트를 미리 설명하지 마세요.`);break;}
}});

async function clearCampusAssets(){try{const db=await(dbp||(dbp=idbOpen()));await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite'),store=tx.objectStore('kv'),r=store.openKeyCursor();r.onsuccess=()=>{const c=r.result;if(c){if(String(c.key).startsWith('asset:'))store.delete(c.key);c.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});assetAvailability.clear();}catch(e){throw new Error('자료 원본 삭제에 실패했습니다. 초기화를 중단합니다.');}}
