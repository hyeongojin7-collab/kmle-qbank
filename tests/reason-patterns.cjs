const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({listeners:{}, Date, console});
const run = code => vm.runInContext(code, context);
run(`
  const NOTE_TYPES = {reasoning:'추론', insight:'통찰'};
  const S = {bank:{}, attempts:[]}, w = {notes:{}};
  const workspace = () => w, esc = t => String(t).replaceAll('<','&lt;');
  const itemRevision = item => item.rev, isStudyEligible = item => !item.flagged;
  const isCurrentAttempt = a => S.bank[a.qid] && (!a.revision || a.revision === S.bank[a.qid].rev);
  const document = { addEventListener:(type, fn) => {listeners[type] = fn;} };
  let started;
  function startSession(ids, recall) { started = {ids, recall}; }
  function updateNote(el) {
    Object.assign(w.notes[el.dataset.id], {[el.dataset.note]:el.value, updatedAt:Date.now()});
  }
  function mergeBackup(b) {
    for (const [id,n] of Object.entries(b.meta.workspace.notes))
      if (!w.notes[id] || n.updatedAt > w.notes[id].updatedAt) w.notes[id] = n;
    return 7;
  }
  function pick(id, kind) { updateNote({dataset:{id,note:'kind'},value:kind}); }
  function add(id, stem) { S.bank[id] = {id,stem,rev:'v1',topic:'<환자> '+id}; }
  function attempt(id, ts) { S.attempts.push({qid:id, ts, revision:'v1'}); }
`);
run(fs.readFileSync(path.join(__dirname, '..', 'reason-patterns.js'), 'utf8'));
const count = () => run("recurringReasonGroups()[0]?.ids.length || 0");

run("add('a','case A');add('b','case B');add('copy','case  A');add('view','case C');pick('view','evidence');attempt('view',1)");
run("attempt('a',1);pick('a','evidence');attempt('a',2);pick('a','evidence');attempt('copy',4);pick('copy','evidence')");
assert.equal(count(), 0);
run("attempt('b',3);pick('b','evidence')");
assert.equal(count(), 2);
assert.ok(run("reasoningPatternsPanel()").includes('&lt;환자'));
run("listeners.click({target:{closest:()=>({dataset:{reasonReplay:'evidence'}})}})");
assert.equal(run("started.ids.length"), 2);
assert.equal(run("started.recall"), true);
run("pick('b','');");
assert.equal(count(), 0);
run("pick('b','insight');");
assert.equal(count(), 0);
run("w.notes.b={kind:'evidence',updatedAt:4};");
assert.equal(count(), 2);
run("S.bank.b._history={v0:{}};");
assert.equal(count(), 0);
run("pick('b','evidence');S.bank.b.rev='v2';");
assert.equal(count(), 0);
const incomingNote = {reasonPicks:{'v1:3':{kind:'reasoning',updatedAt:35}},updatedAt:0};
context.backup = {meta:{workspace:{notes:{a:incomingNote}}}};
const merge = run("mergeBackup(backup)");
assert.equal(merge, 7);
assert.ok(run("w.notes.a.reasonPicks['v1:2'] && w.notes.a.reasonPicks['v1:3']"));
console.log('PASS: explicit learner attributions, distinct case repeats, targeted recall, version and backup handling');
