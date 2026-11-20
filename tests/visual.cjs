const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Drive the production DOM event handlers, including asynchronous media states.
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.events = {};
    this.dataset = {};
    this.attrs = {};
    this.hidden = false;
    this.isConnected = true;
    this.text = '';
    this.value = '';
    this.classList = {toggle: () => true};
  }
  set textContent(text) { this.text = text; this.children = []; }
  get textContent() { return this.text + this.children.map(x => x.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = v; }
  replaceChildren(...nodes) { this.children = nodes; this.text = ''; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(name, cb) { (this.events[name] ||= []).push(cb); }
  dispatch(name) { for (const fn of this.events[name] || []) fn(); }
  hasChildNodes() { return this.children.length > 0; }
  walk() { return [this, ...this.children.flatMap(x => x.walk())]; }
  querySelector(tag) { return this.walk().find(el => el.tag === tag); }
  load() {}
  focus() {}
}
const source = fs.readFileSync(path.join(__dirname, '..', 'visual-practice.js'), 'utf8');
assert.match(source, /\.kmle-visual \[hidden\]\s*\{\s*display:\s*none\s*!important/);
function boot(state) {
  const head = new Element('head');
  const doc = {readyState:'loading', head, createElement:t=>new Element(t), addEventListener() {},
    getElementById:id=>head.walk().find(x=>x.id===id),
    createTextNode:t=>{const e=new Element('#text');e.textContent=t;return e;}};
  const timers = new Map();
  let sequence = 0;
  const context = vm.createContext({document:doc,window:{},workspace:()=>state,persistWorkspace(){},
    setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  return {slow:()=>[...timers.values()].forEach(fn=>fn()), mount:id=>{
    const host=new Element('div');
    context.window.KMLEVisualPractice.mount(host,id);
    return host;
  }};
}
const btn = (host, part) => {
  const found = host.walk().find(n=>n.tag==='button' && n.textContent.includes(part));
  assert.ok(found, part);
  return found;
};
const type = (host,text) => {const input=host.querySelector('textarea');input.value=text;input.dispatch('input');};
const links = host => host.walk().filter(x=>x.tag==='a').map(x=>x.href);
const id='rhythm-strip-b';
const state={};
let env=boot(state), view=env.mount(id);
assert.equal(links(view).length,0);
assert.doesNotMatch(view.textContent,/심방세동|132회|Ewingdo|CC BY/);
assert.match(view.querySelector('img').src,/upload\.wikimedia\.org\/wikipedia\/commons\/3\/32\/ECG_Atrial_Fibrillation\.jpg$/);
view.querySelector('img').dispatch('load');
type(view,'RR 간격이 불규칙하다.');
env=boot(state); view=env.mount(id);
assert.equal(view.querySelector('textarea').value,'RR 간격이 불규칙하다.');
btn(view,'참고 판독 보기').dispatch('click');
assert.equal(state.visualReadings[id].viewMode,'source-image');
assert.equal(state.visualReadings[id].omitted,false);
assert.equal(view.querySelector('textarea').readOnly,true);
assert.ok(links(view).includes('https://doi.org/10.1161/CIR.0000000000001193'));
const original=state.visualReadings[id].firstReading;
btn(view,'접기').dispatch('click'); type(view,'after seeing feedback');
btn(view,'참고 판독 보기').dispatch('click');
assert.equal(state.visualReadings[id].firstReading,original);
assert.equal(boot(state).mount(id).querySelector('textarea').value,original);

const slowState={}, slowEnv=boot(slowState), echo=slowEnv.mount('subcostal-cine');
slowEnv.slow();
assert.match(echo.textContent,/연결이 지연/);
echo.querySelector('video').dispatch('error');
assert.match(echo.textContent,/불러오지 못했습니다/);
assert.equal(links(echo).length,0);
assert.equal(echo.walk().find(n=>n.className==='kv-display').hidden,true);
assert.equal(echo.walk().find(n=>n.className==='kv-controls').hidden,true);
btn(echo,'다시 불러오기').dispatch('click');
assert.equal(echo.walk().find(n=>n.className==='kv-display').hidden,false);
assert.equal(echo.walk().find(n=>n.className==='kv-controls').hidden,false);
assert.equal(btn(echo,'다시 불러오기').hidden,true);
btn(echo,'관찰 묘사').dispatch('click');type(echo,'넓은 무에코 공간');
const assistedAt=slowState.visualReadings['subcostal-cine'].assistedAt;
view=boot(slowState).mount('subcostal-cine');
view.querySelector('video').dispatch('loadeddata');
btn(view,'참고 판독 보기').dispatch('click');
assert.equal(slowState.visualReadings['subcostal-cine'].viewMode,'observation-text');
assert.equal(slowState.visualReadings['subcostal-cine'].mediaLoaded,true);
assert.equal(slowState.visualReadings['subcostal-cine'].assistedAt,assistedAt);
btn(view,'다른 환자 2').dispatch('click');
assert.ok(view.walk().some(n=>n.tag==='img' && n.src.includes('ECG_Atrial_Fibrillation')));
assert.doesNotMatch(view.textContent,/심방세동/);
btn(view,'다른 환자 1').dispatch('click');
assert.ok(view.walk().some(n=>n.tag==='img' && n.src.includes('Electrical_Alternans')));

for (const [mediaId, license] of [['ecg-trace','3.0'],['subcostal-cine','3.0'],[id,'4.0']]) {
  const other={}, trial=boot(other).mount(mediaId);
  btn(trial,'출처 보기').dispatch('click');
  assert.ok(links(trial).includes('https://creativecommons.org/licenses/by-sa/'+license+'/'));
  assert.ok(links(trial).some(url=>url.startsWith('https://commons.wikimedia.org/wiki/File:')));
  assert.equal(other.visualReadings[mediaId].lockedBy,'source');
  assert.equal(other.visualReadings[mediaId].viewMode,'unavailable');
  assert.equal(other.visualReadings[mediaId].omitted,true);
  assert.equal(trial.querySelector('textarea').readOnly,true);
  trial.querySelector(mediaId==='subcostal-cine'?'video':'img').dispatch(mediaId==='subcostal-cine'?'loadeddata':'load');
  btn(trial,'관찰 묘사').dispatch('click');
  assert.equal(other.visualReadings[mediaId].mediaLoaded,false);
  assert.ok(!other.visualReadings[mediaId].assistedAt);
}
console.log('PASS: three blind visuals, source licenses, frozen first reading, assistance, omitted, retry and reload');
