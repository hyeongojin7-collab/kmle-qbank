const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const events = [];
const area = {addEventListener(){}};
const preview = {};
const form = {
  elements:{namedItem:()=>area},
  querySelector:selector=>selector==='[data-edition-preview]'?preview:{addEventListener(){}},
  addEventListener(){},
};
const dialog = {addEventListener(){},querySelector:()=>form,showModal:()=>events.push('opened')};
const node = {addEventListener(){}};
const context = vm.createContext({
  document:{querySelector:()=>node,querySelectorAll:()=>[],addEventListener(){},createElement:()=>dialog,body:{appendChild(){}}},
  location:{hash:''},window:{addEventListener(){}}, URL, console,
  markAnswerExposure:id=>events.push('exposed '+id),
});
const run = script=>vm.runInContext(script,context);
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
run(`
  const first={id:'q',stem:'Before',question:'What next?',options:[{label:'A',text:'wait'},{label:'B',text:'act'}],answer:'B',
    option_analysis:{A:{trap:'explanation A'},B:{why_best:'explanation B'}},
    source_refs:[{file:'Handbook',section:'§4'}]};
  ingestData([{items:[first]}],'manual');
  const revised={stem:'After <img>',options:[{label:'A',text:'observe'},{label:'B',text:'act'}],
    source_refs:[{file:'<reference>',url:'https://example.org/official',section:'§2'},{file:'unsafe',url:'javascript:alert(1)'}]};
  const correction={id:'q',reason:'clarify <criteria>',revision:2,before_revision:itemRevision(S.bank.q),
    before_fields:Object.fromEntries(Object.keys(revised).map(k=>[k,errataFieldFingerprint(S.bank.q[k])])),changes:revised};
  applyErrata({schema:'kmle-content-errata',items:[correction]});
  reviewEdition('q');
`);
assert.deepEqual(events,['opened','exposed q']);
assert.match(preview.innerHTML,/clarify &lt;criteria&gt;/);
assert.match(preview.innerHTML,/After &lt;img&gt;/);
assert.match(preview.innerHTML,/이전 보기 · wait/);
assert.match(preview.innerHTML,/이전 정답 B/);
assert.match(preview.innerHTML,/href="https:\/\/example.org\/official"/);
assert.doesNotMatch(preview.innerHTML,/href="javascript:|<reference>|<img>/);
assert.match(area.value,/source_refs/);
assert.equal(run('isStudyEligible(S.bank.q)'),false);
assert.equal(run('S.attempts.length'),0);
console.log('PASS: editorial preview shows the source and exact revision, safely renders both editions, and records exposure without a score');
