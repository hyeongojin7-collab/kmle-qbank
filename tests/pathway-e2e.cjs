// Exercise real client scripts, rendered controls and delegated events with an isolated DOM and localStorage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

async function pathwayScenario() {
  const q = selector => document.querySelector(selector);
  const check = (truth, msg) => { if (!truth) throw new Error(msg); };
  async function until(condition, message) {
    for (let i = 0; i < 300; i++) {
      if (condition()) return;
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error(message);
  }
  function click(selector) {
    const node = q(selector);
    check(node && !node.disabled && node.getClientRects().length, 'Unavailable control ' + selector);
    node.click();
  }
  function enter(selector, value, type) {
    const node = q(selector);
    check(node && node.getClientRects().length, 'Unavailable input ' + selector);
    node.value = value;
    node.dispatchEvent(new Event(type, {bubbles:true}));
  }
  async function nav(route) {
    click('nav a[data-r="' + route + '"]');
    await until(() => location.hash === '#' + route && q('nav a[aria-current="page"]')?.dataset.r === route,
      'Route did not switch to ' + route);
  }
  const homeWritten = id => '[data-pathway="written"][data-id="' + id + '"]';
  const [index, seven, thirty] = (await (await fetch('data/bank.json')).json()).items
    .filter(it => it.objective_id === 'acute.postprocedure_hypotension').sort((a,b) => a.id.localeCompare(b.id));
  const original = 'Test learner: I would stay at the bedside and reassess the patient.';
  const revised = 'Test learner: after the choices I would call the response team.';
  const now = sessionStorage.getItem('time') || String(Date.now());
  sessionStorage.setItem('time', now);
  const setClock = when => { Date.now = () => when; };
  setClock(Number(now));
  await until(() => typeof uiReady !== 'undefined' && uiReady && S.bank[index.id], 'Published pathway did not load');
  function assertBlind(item) {
    check(q('#reasoning-draft') && !q('[data-first-pick]') && !q('[data-act="choose"]'), 'First response is not blind');
    const visible = q('#app').innerText;
    for (const cue of [item.question, item.model_handoff, ...item.initial_decisions.map(r => r.criterion), ...item.options.map(o => o.text)]) {
      check(!cue || !visible.includes(cue), 'An answer, criterion, or model handoff was shown early');
    }
  }
  function lockText(item, text) {
    assertBlind(item);
    enter('#reasoning-draft',text,'input');
    click('[data-w="pre-confidence"][data-value="2"]');
    click('[data-w="open-options"]:not([data-mode])');
    check(!q('[data-act="choose"]') && q('[data-lock-decisions]'), 'MCQ opened before decisions were committed');
  }
  function submitCase(item, wrongComponent, correctMcq, afterText) {
    for (const row of item.initial_decisions) {
      const selected = row.id === wrongComponent ? row.choices.find(c => c.id !== row.key).id : row.key;
      enter('[data-first-pick="' + row.id + '"]',selected,'change');
    }
    click('[data-lock-decisions]');
    check(!q('[data-first-pick]') && q('[data-act="choose"]'), 'MCQ and component choices are not separated');
    if (afterText) {
      const draft = q('#reasoning-draft');
      draft.closest('details').open = true;
      enter('#reasoning-draft',afterText,'input');
    }
    const answer = correctMcq ? item.answer : item.options.find(o => o.label !== item.answer).label;
    click('[data-act="choose"][data-l="' + answer + '"]');
    click('[data-act="conf"][data-c="2"]');
    click('[data-act="submit"]');
    check(q('[data-act="next"]') && !q('[data-act="submit"]'), 'Duplicate submission control remains');
    const record = S.attempts.at(-1);
    check(record.qid === item.id && record.correct === correctMcq, 'MCQ scoring differs from submission');
    const decisions = record.clinicalJudgment.decisions;
    check(decisions.length === 3 && decisions.every(r => r.correct === (r.id !== wrongComponent)), 'Incorrect component score');
    const displayed = q('#app').innerText;
    check(displayed.includes('필기 보기 전 초기 대응') && displayed.includes(correctMcq?'정답':'오답'), 'Separate score displays missing');
    check(wrongComponent == null || displayed.includes('교정 필요'), 'Missed component invisible');
    click('[data-act="next"]');
    return record;
  }
  if (!sessionStorage.getItem('frozen')) {
    await until(() => q(homeWritten(index.id)), 'New written index was not offered on Home');
    check(q('.pathway-lane .pri')?.dataset.id === index.id, 'Clean Home prioritizes something other than the written index');
    click(homeWritten(index.id));
    lockText(index,original);
    sessionStorage.setItem('frozen','1');
    location.reload();
    return;
  }
  await until(() => q('[data-lock-decisions]'), 'Reload failed to restore locked text and pending component choices');
  check(!q('[data-act="choose"]') && session.prediction.text === original, 'Reload changed the locked first response');
  const first = submitCase(index,'escalation',true,revised);
  check(first.prediction.text === original && first.reasoning === revised && first.clinicalJudgment.freshPresentation,
    'Post-choice entry replaced free-text prediction or lost first-presentation credit');
  await nav('dash');
  const referral = q('.pathway-lane .pri');
  check(referral?.dataset.pathway === 'handoff' && referral.dataset.id, 'Missed escalation did not route to a sourced handoff');
  const source = referral.dataset.id;
  check(source === writtenHandoffId(first), 'Referral is tied to a different response');
  click('.pathway-lane .pri');
  await until(() => location.hash === '#skills' && q('#app').innerText.includes('다시 연습할 이유'), 'Handoff recommendation did not open the observation');
  const handoff=campus().skills[selectedSkill].draft;
  check(handoff.handoffAttempt === source && handoff.handoffSource.qid === index.id &&
    handoff.handoffSource.stem === index.stem, 'Observation opened without the originating patient');
  check(!campus().skills[selectedSkill].logs.length, 'Opening a drill fabricated observed performance');

  setClock(Number(now) + 60000);
  await nav('notebook');
  click('[data-w="recall-one"][data-id="' + index.id + '"]');
  lockText(index,'A second attempt at the same patient.');
  const repeat = submitCase(index,null,true);
  check(!repeat.clinicalJudgment.freshPresentation && repeat.priorExposureAt != null, 'Retry counted as a new patient');
  await nav('dash');
  let lane = [...document.querySelectorAll('.pathway-lane')].find(n => n.innerText.includes('필기 · 선지 전 판단'));
  check(lane?.innerText.includes('도움 요청') && lane.innerText.includes('구조화 판단 1건'), 'Retry cleared a first-presentation gap or increased independent cases');
  const due = writtenPathwayPlan().next.dueAt;
  check(due >= first.ts + 7*86400000 && due <= repeat.ts + 7*86400000, 'Seven-day date does not track original history');
  await nav('review');
  setClock(due - 1);
  await nav('dash');
  check(!q(homeWritten(seven.id)) && !q(homeWritten(thirty.id)), 'Held-out patient offered before due time');
  await nav('browse');
  check(!q('[data-id="'+seven.id+'"]') && !q('#app').innerText.includes(seven.stem), 'Library exposed held-out case');
  setClock(due);
  await nav('dash');
  click(homeWritten(seven.id));
  lockText(seven,'A first response to a different patient.');
  const delayed = submitCase(seven,null,false);
  check(delayed.clinicalJudgment.freshPresentation && delayed.transferAssessment.targetDays === 7 &&
    delayed.transferAssessment.qid === seven.id, 'Delayed case lost its independent transfer attribution');
  await nav('dash');
  lane = [...document.querySelectorAll('.pathway-lane')].find(n => n.innerText.includes('필기 · 선지 전 판단'));
  check(lane?.innerText.includes('구조화 판단 2건') && !lane.innerText.includes('재평가할 항목'), 'Fresh correct action did not clear the specific component gap independently of MCQ');
  check(!q(homeWritten(thirty.id)), '30-day patient opened with the 7-day patient');
  check(S.attempts.length === 3 && writtenPathwayEvidence().reviewedText === 0, 'A revisit or self assessment fabricated evidence');
  return true;
}

// A small DOM adapter for the tags/selectors actually used in this route. It parses
// the live render output on each assignment; tests cannot click a nonexistent control.
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,v)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[v]);
class Element {
  constructor(tag,parent,attrs={}) {
    this.tagName=tag.toUpperCase();this.parent=parent;this.attrs=attrs;
    this.children=[];this.listeners=new Map();this.style={setProperty(){}};
    this.id=attrs.id||'';this.disabled='disabled' in attrs;this.open='open' in attrs;this.value=attrs.value||'';
    this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-'))
      .map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
    const classes=new Set((attrs.class||'').split(' ').filter(Boolean));
    this.classList={contains:c=>classes.has(c),remove:c=>classes.delete(c),toggle:(c,force)=>{
      if(force??!classes.has(c))classes.add(c);else classes.delete(c);
    }};
  }
  set innerHTML(markup) {
    const stack=[this];this.children=[];
    const voids=new Set(['br','hr','img','input','meta','link','source','wbr','path','line','circle','polyline','rect']);
    for(const token of markup.match(/<\/?[^>]+>|[^<]+/gs)||[]){
      if(token.startsWith('</')){const name=token.slice(2,-1).trim().toUpperCase();
        for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===name){stack.length=i;break;}continue;}
      const parent=stack.at(-1);
      if(!token.startsWith('<')){parent.children.push(decode(token));continue;}
      const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;
      const attrs={};for(const m of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1]]=decode(m[2]??m[3]??m[4]??'');
      const el=new Element(tag,parent,attrs);parent.children.push(el);
      if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(el);
    }
  }
  set textContent(value){this.children=[String(value)];}
  get innerText(){return this.children.filter(c=>this.tagName!=='DETAILS'||this.open||c.tagName==='SUMMARY').map(c=>typeof c==='string'?c:c.innerText).join(' ');}
  matches(selector){
    if(!selector)return false;
    if(selector.includes(','))return selector.split(',').some(s=>this.matches(s.trim()));
    const parts=selector.split(/\s+/);const end=parts.pop(),ancestor=parts.join(' ');
    if(ancestor&&!this.parent?.closest(ancestor))return false;
    const not=end.match(/:not\(([^)]+)\)/);if(not&&this.matches(not[1]))return false;
    const simple=end.replace(/:not\([^)]+\)/g,'');
    if(simple.includes(':'))return false;
    const tag=simple.match(/^[\w-]+/)?.[0],id=simple.match(/#([\w-]+)/)?.[1];
    if(tag&&this.tagName!==tag.toUpperCase()||id&&this.id!==id)return false;
    for(const m of simple.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
    for(const m of simple.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){
      if(!Object.hasOwn(this.attrs,m[1])||m[2]!=null&&this.attrs[m[1]]!==m[2])return false;
    }
    return true;
  }
  closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
  querySelectorAll(s){const matches=[];for(const child of this.children){if(typeof child==='string')continue;if(child.matches(s))matches.push(child);matches.push(...child.querySelectorAll(s));}return matches;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  setAttribute(k,v){this.attrs[k]=String(v);} removeAttribute(k){delete this.attrs[k];}
  getClientRects(){return this.closest('details:not([open])')&&!this.closest('details').open&&!this.closest('summary')?[]:[{}];}
  focus(){} scrollIntoView(){}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  dispatchEvent(event){event.target=this;for(let node=this;node;node=node.parent){for(const fn of node.listeners.get(event.type)||[])fn(event);}}
  click(){const event={type:'click',preventDefault(){this.cancelled=true;}};this.dispatchEvent(event);
    if(!event.cancelled&&this.tagName==='A'&&this.attrs.href?.startsWith('#'))this.closest('document').navigate(this.attrs.href);}
}
function memoryStore(){const store=new Map();return {setItem:(k,v)=>store.set(k,String(v)),getItem:k=>store.get(k)??null};}

async function runShippedScripts() {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const localStorage=memoryStore(),sessionStorage=memoryStore();let hash='#dash',success=false;
  for(let load=0;load<2;load++){
    const document=new Element('document',null);document.documentElement=document;
    document.innerHTML='<body>'+html.split('<body>')[1].split('<script>')[0]+'</body>';
    document.body=document.querySelector('body');document.getElementById=id=>document.querySelector('#'+id);
    const window=new Element('window',null);window.scrollTo=()=>{};
    const location={protocol:'http:',get hash(){return hash;},set hash(value){hash='#'+value.replace(/^#/,'');},reload(){this.reloading=true;}};
    document.navigate=value=>{location.hash=value;window.dispatchEvent({type:'hashchange'});};
    const fetch=async resource=>{
      const found=['data/bank.json','data/errata.json'].includes(resource);
      return {ok:found,json:async()=>JSON.parse(fs.readFileSync(path.join(root,resource),'utf8'))};
    };
    const context=vm.createContext({document,window,location,navigator:{},localStorage,sessionStorage,fetch,
      setTimeout,clearTimeout,setInterval(){},console,confirm:()=>true,Blob,
      Event:class {constructor(type){this.type=type;}},crypto:require('node:crypto').webcrypto});
    for(const match of html.matchAll(/<script(?:\s+src="([^"]+)")?>([\s\S]*?)<\/script>/g)){
      const filename=match[1]?.split('?')[0];const code=filename?fs.readFileSync(path.join(root,filename),'utf8'):match[2];
      vm.runInContext(code,context,{filename:filename||'index.html'});
    }
    success=await vm.runInContext('('+pathwayScenario.toString()+')()',context);
    if(!location.reloading)break;
    await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(success,true,'The route did not reach delayed reassessment');
  console.log('PASS: shipped Home → blind written patient → separate decisions/MCQ → linked receiver drill → retry → new seven-day patient');
}

runShippedScripts().catch(error=>{console.error(error);process.exitCode=1;});
