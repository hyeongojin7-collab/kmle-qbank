// Dependency-free regression tests. UI interaction is checked separately in a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {dataset: {}, style: {setProperty() {}},
    classList: {toggle() {}, remove() {}}, addEventListener(type, fn) {(this.listeners ||= {})[type] ||= []; this.listeners[type].push(fn);}, querySelector: () => null, querySelectorAll: () => [],
    setAttribute() {}, removeAttribute() {}, innerHTML: '', textContent: '', value: ''});
  return nodes.get(selector);
};
const disk = new Map();
const context = vm.createContext({console, Blob, TextEncoder, Uint8Array, DataView,
  crypto: require('node:crypto').webcrypto, setTimeout: () => 0, clearTimeout() {}, setInterval() {},
  location: {hash: '', protocol: 'https:'}, window: {addEventListener() {}, scrollTo() {}},
  navigator: {}, document: {querySelector: node, querySelectorAll: () => [],
    addEventListener() {}, body: node('body'), documentElement: node('html')},
  localStorage: {getItem: k => disk.get(k) || null, setItem: (k, v) => disk.set(k, v)},
  confirm: () => true, prompt: () => null,
});
const run = code => vm.runInContext(code, context);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
new vm.Script(scripts.at(-1)[1]); // Bootstrap syntax, without executing network/storage.
run(scripts[0][1]);
run(fs.readFileSync(path.join(root, 'workspace.js'), 'utf8'));
run(fs.readFileSync(path.join(root, 'campus.js'), 'utf8'));
run(fs.readFileSync(path.join(root, 'rounds.js'), 'utf8'));
run(`
  const testStorage = new Map();
  kvGet = async k => testStorage.get(k);
  kvSet = async (k,v) => testStorage.set(k, JSON.parse(JSON.stringify(v)));
  const fixture = id => ({id,subject:'내과',system:'신장',stem:'UI fixture '+id,
    question:'Fixture',options:[{label:'A',text:'A'},{label:'B',text:'B'}],answer:'A',difficulty:3});
  S.bank={legacy:fixture('legacy'),pending:{...fixture('pending'),block_id:'b',school_verified:false},
    approved:{...fixture('approved'),block_id:'b',school_verified:true}};
`);

(async () => {
  assert.equal(run('JSON.stringify(pool({...FILTER0,mode:"new"}).sort())'), '["legacy"]');
  assert.equal(run('JSON.stringify(pool({...FILTER0,track:"school",mode:"new"}))'), '["approved"]');
  assert.equal(run('JSON.stringify(pool({...FILTER0,track:"all",mode:"new"}).sort())'), '["approved","legacy"]');
  run('S.flags.approved={reason:"flagged"}');
  assert.equal(run('pool({...FILTER0,track:"school"}).length'), 0);
  run('S.flags={}');
  console.log('PASS: KMLE/school scope, source review gate, flagged question exclusion');

  run(`workspace().notes.legacy={rule:'newer local',updatedAt:20};
    mergeBackup({bank:{imported:fixture('imported')},attempts:[],meta:{workspace:{
      notes:{legacy:{rule:'older backup',updatedAt:10}},bookmarks:{legacy:{value:true,updatedAt:20}},
      blocks:{b:{id:'b',title:'Block',exams:[],materials:[],updatedAt:20}},
      skills:{s:{id:'s',title:'Skill',steps:['one'],logs:[],updatedAt:20}}}}});`);
  assert.equal(run('workspace().notes.legacy.rule'), 'newer local');
  assert.equal(run('isBookmarked("legacy")'), true);
  assert.equal(run('campus().blocks.b.title'), 'Block');
  assert.equal(run('campus().skills.s.title'), 'Skill');
  assert.equal(run('S.bank.imported.id'), 'imported');
  console.log('PASS: legacy backup import and workspace merge without overwriting newer notes');

  await run(`saveAll()`);
  await run(`workspace().notes.legacy={rule:'journal survives reload',updatedAt:30};
    workspace().resume={ids:['legacy'],i:0,choice:'B',conf:3,ans:{},done:false};persistWorkspace()`);
  // Emulate a stale IndexedDB metadata record after interruption.
  run(`testStorage.get('meta').workspace=null;S.meta={batches:[],deleted:[]};session=null;`);
  await run('loadLocal()');
  assert.equal(run('session.choice'), 'B');
  assert.equal(run('session.conf'), 3);
  assert.equal(run('workspace().notes.legacy.rule'), 'journal survives reload');
  assert.equal(run('S.bank.legacy.id'), 'legacy');
  run(`const qaAttempt={qid:'legacy',choice:'B',correct:false,conf:3,ts:Date.now(),ms:1000};
    session.ans.legacy=qaAttempt;persistSession();`);
  await run('loadLocal()');
  await run('loadLocal()');
  assert.equal(run('S.attempts.filter(a=>a.qid==="legacy").length'), 1);
  assert.equal(run('S.srs.legacy.due>qaAttempt.ts'), true);
  console.log('PASS: interrupted session restoration and exactly-once answer recovery');

  run(`selectedBlock='b';selectedExam='e';campus().blocks.b={id:'b',title:'Scope test',semester:'Year 2',
    materials:[{id:'m',name:'lecture.txt'},{id:'excluded',name:'excluded.txt'}],
    exams:[{id:'e',title:'Exam',materials:{m:{selected:true,range:'p.12–40'}},count:7,style:'past',instructions:'Scope constraint'}]};`);
  const prompt = run('schoolPrompt()');
  assert.ok(prompt.includes('p.12–40') && prompt.includes('문항 수: 7'));
  assert.ok(prompt.includes('lecture.txt') && !prompt.includes('excluded.txt'));
  assert.ok(prompt.includes('Scope constraint') && prompt.includes('source_refs'));
  console.log('PASS: exact selected source range, exclusions, question count and source schema');

  run(`const roundAction=(op,i)=>app.listeners.click.forEach(fn=>fn({target:{closest:sel=>sel==='[data-round]'?{dataset:{round:op,index:i}}:null}}));
    session=null;go('rounds');`);
  assert.ok(!run('vRounds()').includes('13 mm'));
  run("roundAction('inspect',4);roundAction('act',0);");
  assert.ok(run('vRounds()').includes('13 mm') && run('vRounds()').includes('94까지'));
  run("roundAction('act',1);roundAction('finish');roundAction('switch',1);roundAction('act',2);roundAction('finish');");
  assert.ok(run('ROUNDS.every(c=>roundDraft(c).done)'));
  assert.ok(run('roundCoaching(ROUNDS[0],roundDraft(ROUNDS[0]))').includes('94까지'));
  await run('loadLocal()');
  assert.equal(run('roundIndex'),1);
  assert.ok(run('roundDraft(ROUNDS[1]).done'));
  run("startSession(['legacy'],true)");
  assert.ok(!run('vQuestion()').includes('data-act="choose"'));
  run('session.optionsOpened=true;session.reasoning="initial prediction";session.choice="B";session.conf=2');
  assert.ok(run('vQuestion()').includes('data-act="choose"'));
  await run('submit()');
  assert.ok(run('weaknessPacket(S.attempts,false)').includes('initial prediction'));
  console.log('PASS: branching encounters, persistent progress, cue-free review and reasoning export');

  assert.equal(run('crc32(new TextEncoder().encode("123456789"))'), 0xcbf43926);
  const zip = await run(`zipFiles([{name:'materials/01/강의.txt',blob:new Blob(['source bytes'])},
    {name:'manifest.json',blob:new Blob(['{"version":1}'])}])`);
  const bytes = Buffer.from(await zip.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), 2);
  const zipPath = path.join(require('node:os').tmpdir(), 'qbank-regression.zip');
  fs.writeFileSync(zipPath, bytes);
  require('node:child_process').execFileSync('python3', ['-c',
    'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read("materials/01/강의.txt")==b"source bytes"; assert len(z.namelist())==2', zipPath]);
  fs.unlinkSync(zipPath);
  console.log('PASS: ZIP CRC, UTF-8 filenames, directory entries and independent extraction');
})().catch(error => { console.error(error); process.exitCode = 1; });
