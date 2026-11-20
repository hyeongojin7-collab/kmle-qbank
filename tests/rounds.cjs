const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const handlers = {};
const state = {preferences: {}};
let serial = 0;
const context = vm.createContext({
  workspace: () => state,
  persistWorkspace() {}, render() {}, esc: String, pageHeading: () => '', dstr: String,
  uid: () => 'attempt-' + (++serial),
  app: {addEventListener(type, fn) { handlers[type] = fn; }, querySelector: () => null},
  window: {scrollTo() {}, KMLEVisualPractice: {}}
});
const run = code => vm.runInContext(code, context);
run(fs.readFileSync(path.join(__dirname, '..', 'rounds.js'), 'utf8'));
const act = (action, index) => handlers.click({target: {closest: () => ({dataset: {round: action, index}})}});
const write = (field, value) => handlers.input({target: {dataset: {roundField: field}, value}});
const screen = () => run('vRounds()');

assert.equal(run('ROUNDS.length >= 3'), true);
assert.doesNotMatch(screen(), /13 mm|data-round="act"/);
act('inspect', 4);
assert.match(screen(), /13 mm/);
write('hypothesis', 'Plan written without choices');
act('options');
write('hypothesis', 'Edited after options');
act('act', 0);
act('act', 1);
write('followup', 'Reassessment before the debrief');
write('handoff', 'Handoff before the debrief');
act('finish');
act('finish');
const caseId = run('ROUNDS[0].id');
const records = () => Object.values(state.roundAttempts);
assert.equal(records().length, 1);
assert.equal(records()[0].firstPlan, 'Plan written without choices');
assert.equal(records()[0].hypothesis, records()[0].firstPlan);
assert.deepEqual(Array.from(records()[0].actions), [0, 1]);
assert.match(screen(), /첫 선택 후 계획을 수정함/);
assert.match(screen(), /선지 전 계획·재평가·전달 기록/);
assert.match(screen(), /subcostal-cine/);
act('retry');
assert.equal(state.rounds[caseId].done, false);
assert.doesNotMatch(screen(), /Plan written without choices|Handoff before the debrief/);
act('options');
act('act', 1);
act('finish');
assert.equal(records().length, 2);
assert.match(screen(), /일부 수행 근거 미기록/);
assert.match(screen(), /이전 시도 1회/);
assert.match(screen(), /Handoff before the debrief/);
assert.equal(records()[1].firstPlan, '');
act('switch', 2);
assert.doesNotMatch(screen(), /후복막 출혈/);
act('inspect', 0);
assert.match(screen(), /오른쪽 옆구리/);
act('options');
act('act', 0);
act('finish');
assert.match(screen(), /data-round="switch" data-index="0">다른 환자/);

// A legacy completed session did not timestamp when the options were first shown.
state.rounds['clinic-return'] = {seen: [], actions: [2], hypothesis: 'Old note',
  followup: '', handoff: 'Old handoff', done: true, updatedAt: 12345};
act('switch', 1);
act('retry');
const legacy = records().find(a => a.caseId === 'clinic-return');
assert.equal(legacy.finishedAt, 12345);
assert.equal(legacy.handoff, 'Old handoff');
assert.equal(legacy.firstPlan, undefined);
assert.equal(state.rounds['clinic-return'].done, false);
console.log('PASS: case transfer, first independent plan, action order, debrief, and legacy retry history');
