/* Independently sourced examples, not recordings from the simulated patient. */
(() => {
  'use strict';

  const examples = {
    'subcostal-cine': {
      type: 'video',
      heading: '심초음파 판독',
      modality: '다른 환자의 검상하 심초음파',
      file: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Pericardial_effusion%2C_%22swinging_heart%22_E00670_%28CardioNetworks_ECHOpedia%29.webm',
      source: 'https://commons.wikimedia.org/wiki/File:Pericardial_effusion,_%22swinging_heart%22_E00670_(CardioNetworks_ECHOpedia).webm',
      credit: 'CardioNetworks (Secretariat), AMC Echolab, The Netherlands · 2010',
      license: '3.0',
      prompt: '검상하 단면에서 심근 바깥의 공간과, 박동할 때 심장 전체가 움직이는 방향을 기술해 보세요.',
      access: '심장 바깥쪽 밝은 경계와 심근 사이로 넓고 어두운 공간이 보입니다. 박동하는 동안 심장 전체가 이 공간 안에서 위치를 옮깁니다.',
      observations: [
        ['위치', '심근 외측과 심낭 사이에 넓은 무에코 공간이 있습니다. 심실 내강과 구분해 보세요.'],
        ['움직임', '한 심장 주기를 반복해 보면 심장 전체가 심낭액 안에서 흔들립니다(swinging heart). 이는 국소 심실벽이 잠깐 안으로 들어가는 소견과 구별합니다.'],
        ['임상 판단', '이 영상은 큰 심낭삼출의 예입니다. 압전 여부는 혈압·관류, 우심실 자유벽의 이완기 초기 허탈, 호흡에 따른 혈류 변화 등 다른 근거와 함께 판단합니다.']
      ],
      reference: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5401877/'
    },
    'ecg-trace': {
      type: 'image',
      heading: '12유도 심전도 판독',
      modality: '다른 환자의 12유도 심전도',
      file: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Electrical_Alternans.JPG',
      source: 'https://commons.wikimedia.org/wiki/File:Electrical_Alternans.JPG',
      credit: 'James Heilman, MD · Wikimedia Commons',
      license: '3.0',
      prompt: '한 유도 안에서 연속된 QRS 네 개를 고르세요. 진폭의 규칙과 전체 심박수를 어떻게 기술하겠습니까?',
      access: '같은 유도에서 이웃한 QRS의 진폭이 한 박자마다 커졌다 작아지는 패턴이 반복됩니다. 박동은 빠르고 전반적인 전압은 낮습니다.',
      observations: [
        ['비교 지점', '같은 유도 안에서 연속 QRS를 짝지으면 큰 파형과 작은 파형이 번갈아 나타납니다. 서로 다른 유도의 높이를 비교할 때 생기는 차이와 구분합니다.'],
        ['판독', '빈맥과 저전압을 동반한 전기적 교대(electrical alternans)입니다. 큰 심낭삼출에서 심장 위치와 기록 전극에 대한 전기축이 박동마다 달라지며 이런 소견이 나타날 수 있습니다.'],
        ['임상 판단', '이 예시의 원 환자는 큰 심낭삼출이 있었습니다. 이 심전도만으로 압전의 혈역학적 중증도를 판정할 수 없습니다.']
      ],
      reference: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2878263/'
    },
    'rhythm-strip-b': {
      type: 'image',
      heading: '응급실의 다른 환자 · 12유도 심전도',
      modality: '다른 환자의 12유도 심전도와 긴 II유도 리듬 스트립',
      file: 'https://upload.wikimedia.org/wikipedia/commons/3/32/ECG_Atrial_Fibrillation.jpg',
      source: 'https://commons.wikimedia.org/wiki/File:ECG_Atrial_Fibrillation.jpg',
      credit: 'Ewingdo · Wikimedia Commons · 2020',
      license: '4.0',
      prompt: '긴 II유도에서 연속된 R–R 간격을 비교하세요. 각 QRS 앞에 같은 모양의 P파가 반복되는지 확인한 뒤, 리듬과 그 근거를 적어 보세요.',
      access: '긴 II유도에서 QRS 사이 간격이 불규칙하게 달라집니다. 같은 형태의 P파가 매 QRS 앞에서 일정하게 반복되지는 않습니다. QRS는 대체로 좁습니다.',
      observations: [
        ['간격', '여러 박자에 걸쳐 R–R 간격이 불규칙하고 반복되는 주기가 뚜렷하지 않습니다.'],
        ['심방 활동', 'QRS 앞마다 일정하게 나타나는 P파를 찾기 어렵습니다. 불규칙한 간격 하나만 보고 진단하지 말고 두 단서를 함께 확인하세요.'],
        ['판독', '심방세동에 빠른 심실 반응이 동반된 사례입니다. 제공자가 기록한 심박수는 분당 132회입니다. 환자의 관류 상태나 부정맥 발생 시점은 이 영상에서 알 수 없습니다.']
      ],
      reference: 'https://doi.org/10.1161/CIR.0000000000001193'
    }
  };

  function el(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function link(label, href) {
    const a = el('a', label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function button(label) {
    const control = el('button', label, 'btn');
    control.type = 'button';
    return control;
  }

  function addStyles() {
    if (document.getElementById('kmle-visual-styles')) return;
    const style = document.createElement('style');
    style.id = 'kmle-visual-styles';
    style.textContent = `
      .kmle-visual {margin:1rem 0;padding:1rem;border:1px solid var(--line,#d2d7db);border-radius:12px;line-height:1.55}
      .kmle-visual h3,.kmle-visual h4 {margin:.35rem 0;font-size:1rem}
      .kmle-visual p {margin:.5rem 0}.kmle-visual details {margin:.5rem 0}.kmle-visual summary {cursor:pointer}
      .kmle-visual .kv-display {display:block;max-width:100%;overflow:auto;background:#101216;border-radius:7px;margin:.6rem 0}
      .kmle-visual video,.kmle-visual img {display:block;width:100%;max-height:24rem;object-fit:contain}
      .kmle-visual .kv-zoom img {width:1400px;max-width:none;max-height:none}
      .kmle-visual .kv-display:focus-visible,.kmle-visual summary:focus-visible {outline:3px solid #176ac1;outline-offset:2px}
      .kmle-visual textarea {display:block;box-sizing:border-box;width:100%;margin:.4rem 0;padding:.65rem;font:inherit;border:1px solid var(--line,#d2d7db);border-radius:6px}
      .kmle-visual .kv-controls {display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin:.6rem 0}
      .kmle-visual .kv-credit {font-size:.8rem;color:var(--mut,#4b5563)}.kmle-visual a {text-decoration:underline}
      .kmle-visual .kv-feedback {border-inline-start:3px solid var(--acc,#005fc4);padding-inline-start:1rem;margin-top:.8rem}
      .kmle-visual [hidden] {display:none !important}
    `;
    document.head.append(style);
  }

  function entry(id) {
    return workspace().visualReadings?.[id] || {};
  }

  function record(id, changes) {
    const state = workspace();
    state.visualReadings ||= {};
    state.visualReadings[id] = {...entry(id), ...changes, updatedAt: Date.now()};
    persistWorkspace();
    return state.visualReadings[id];
  }

  function freeze(id, text, action) {
    const prior = entry(id);
    if (prior.revealedAt) return prior;
    const firstReading = text.trim().slice(0, 1600);
    return record(id, {
      revealedAt: Date.now(), lockedBy: action, firstReading, draft: '', omitted: !firstReading,
      mediaLoaded: !!prior.originalLoadedAt, descriptionUsed: !!prior.assistedAt,
      viewMode: prior.assistedAt ? 'observation-text' : prior.originalLoadedAt ? 'source-image' : 'unavailable'
    });
  }

  function mount(host, id) {
    const item = examples[id];
    if (!host || !item || host.dataset.visualReady === id) return;
    addStyles();
    host.replaceChildren();
    host.dataset.visualReady = id;
    const root = el('section', '', 'kmle-visual');
    root.setAttribute('aria-label', item.heading);
    host.append(root);
    root.append(el('h3', item.heading), el('p', item.prompt));

    const display = el('div', '', 'kv-display');
    const media = el(item.type === 'video' ? 'video' : 'img');
    const mediaControls = el('div', '', 'kv-controls');
    const status = el('p', '원자료 연결 중. 기다리는 동안 관찰 묘사를 선택할 수 있습니다.');
    status.setAttribute('role', 'status');
    const retry = button('원자료 다시 불러오기');
    retry.hidden = true;
    if (item.type === 'video') {
      media.controls = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.setAttribute('aria-label', item.modality + ' (약 1초 반복 영상, 소리 없음)');
    } else {
      media.alt = item.modality;
      display.tabIndex = 0;
      display.setAttribute('role', 'region');
      display.setAttribute('aria-label', '심전도. 확대한 뒤 방향키로 이동할 수 있습니다.');
      const zoom = button('파형 확대');
      zoom.setAttribute('aria-pressed', 'false');
      zoom.addEventListener('click', () => {
        const enlarged = display.classList.toggle('kv-zoom');
        zoom.setAttribute('aria-pressed', String(enlarged));
        zoom.textContent = enlarged ? '화면 너비로 보기' : '파형 확대';
      });
      mediaControls.append(zoom);
    }
    let slowTimer;
    function load() {
      clearTimeout(slowTimer);
      display.hidden = false;
      mediaControls.hidden = false;
      retry.hidden = true;
      status.textContent = '원자료 연결 중. 기다리는 동안 관찰 묘사를 선택할 수 있습니다.';
      slowTimer = setTimeout(() => {
        status.textContent = '원자료 연결이 지연되고 있습니다. 관찰 묘사를 이용하거나 다시 불러올 수 있습니다.';
        retry.hidden = false;
      }, 8000);
      media.src = item.file;
      if (item.type === 'video') media.load();
    }
    media.addEventListener(item.type === 'image' ? 'load' : 'loadeddata', () => {
      clearTimeout(slowTimer);
      status.textContent = '원자료를 불러왔습니다.';
      display.hidden = false;
      mediaControls.hidden = false;
      retry.hidden = true;
      if (host.isConnected && !entry(id).revealedAt && !entry(id).originalLoadedAt)
        record(id, {originalLoadedAt: Date.now()});
    });
    media.addEventListener('error', () => {
      clearTimeout(slowTimer);
      display.hidden = true;
      mediaControls.hidden = true;
      retry.hidden = false;
      status.textContent = '원자료를 불러오지 못했습니다. 다시 불러오거나 아래 관찰 묘사를 이용하세요.';
    });
    retry.addEventListener('click', load);
    display.append(media);

    const access = button('화면 대신 관찰 묘사 읽기');
    access.setAttribute('aria-expanded', 'false');
    const description = el('p');
    description.hidden = true;
    access.addEventListener('click', () => {
      description.hidden = !description.hidden;
      access.setAttribute('aria-expanded', String(!description.hidden));
      if (!description.hidden) {
        if (!entry(id).revealedAt && !entry(id).assistedAt) record(id, {assistedAt: Date.now()});
        description.textContent = item.access;
      }
    });

    const response = el('label', '내 첫 판독');
    const note = el('textarea');
    note.rows = 2;
    note.maxLength = 1600;
    note.value = entry(id).revealedAt ? entry(id).firstReading || '' : entry(id).draft || '';
    note.placeholder = '관찰 소견과 결론을 적어 보세요.';
    note.addEventListener('input', () => {
      if (!entry(id).revealedAt) record(id, {draft: note.value.slice(0, 1600)});
    });
    response.append(note);
    const readingStatus = el('p', '', 'hint');
    readingStatus.setAttribute('role', 'status');
    const controls = el('div', '', 'kv-controls');
    const reveal = button('첫 판독을 확정하고 참고 판독 보기');
    const attribution = button('첫 판독을 확정하고 출처 보기');
    const feedback = el('div', '', 'kv-feedback');
    const credits = el('p', '', 'kv-credit');
    feedback.hidden = true;
    credits.hidden = true;

    function showCapture() {
      const saved = entry(id);
      note.readOnly = !!saved.revealedAt;
      reveal.setAttribute('aria-expanded', String(!feedback.hidden));
      attribution.setAttribute('aria-expanded', String(!credits.hidden));
      if (!saved.revealedAt) {
        readingStatus.textContent = '참고 판독이나 출처를 열면 첫 판독이 확정됩니다. 비워 두면 미기록으로 남습니다.';
        return;
      }
      const kind = saved.viewMode === 'observation-text' ? '관찰 묘사 열람 후' :
        saved.viewMode === 'source-image' ? '원자료 로드 후 · 관찰 묘사 미열람' : '원자료 로드 확인 전';
      readingStatus.textContent = (saved.omitted ? '첫 판독 미기록' : '첫 판독 저장됨') + ' · ' + kind + '.';
      note.value = saved.firstReading || '';
      reveal.textContent = feedback.hidden ? '참고 판독 보기' : '참고 판독 접기';
      attribution.textContent = credits.hidden ? '자료 출처와 이용 조건' : '출처 접기';
    }

    function openFeedback() {
      freeze(id, note.value, 'reference');
      if (!feedback.hasChildNodes()) {
        feedback.append(el('h4', '참고 판독'));
        for (const [label, explanation] of item.observations) {
          const line = el('p');
          line.append(el('strong', label + ' '), document.createTextNode(explanation));
          feedback.append(line);
        }
        feedback.append(link('판독 근거', item.reference));
        if (id === 'subcostal-cine') {
          for (const [targetId, label] of [
            ['ecg-trace', '다른 환자 1 · 12유도 심전도'],
            ['rhythm-strip-b', '다른 환자 2 · 응급실 심전도']
          ]) {
            const another = button(label), target = el('div');
            another.addEventListener('click', () => {
              mount(target, targetId);
              another.hidden = true;
              const heading = target.querySelector('h3');
              heading.tabIndex = -1;
              heading.focus();
            });
            feedback.append(another, target);
          }
        }
      }
      feedback.hidden = !feedback.hidden;
      if (!feedback.hidden && !entry(id).referenceViewedAt) record(id, {referenceViewedAt: Date.now()});
      showCapture();
    }

    attribution.addEventListener('click', () => {
      freeze(id, note.value, 'source');
      if (!credits.hasChildNodes()) credits.append(document.createTextNode(item.credit + ' · '),
        link('원자료', item.source), document.createTextNode(' · '),
        link('CC BY-SA ' + item.license, 'https://creativecommons.org/licenses/by-sa/' + item.license + '/'),
        document.createTextNode(' · 제공처 원본을 그대로 표시합니다.'));
      credits.hidden = !credits.hidden;
      showCapture();
    });
    reveal.addEventListener('click', openFeedback);
    controls.append(reveal, attribution);
    root.append(display, mediaControls, status, retry, access, description, response, readingStatus, controls, feedback, credits);
    if (entry(id).referenceViewedAt) openFeedback();
    else showCapture();
    load();
  }

  function scan(parent = document) {
    if (parent.matches?.('[data-visual-practice]')) mount(parent, parent.dataset.visualPractice);
    parent.querySelectorAll('[data-visual-practice]').forEach(node => mount(node, node.dataset.visualPractice));
  }

  window.KMLEVisualPractice = Object.freeze({ mount, scan });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(), { once: true });
  } else {
    scan();
  }
})();
