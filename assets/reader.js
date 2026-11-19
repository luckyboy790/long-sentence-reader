const DATA = sampleSentences.slice();

/* ================= 数据 ================= */
const TYPES = {
  attr:{name:'定语从句'}, adv:{name:'状语'}, noun:{name:'名词性从句'}, nonfin:{name:'非谓语'},
  coord:{name:'并列结构'}, appos:{name:'同位 / 插入'}, phrase:{name:'固定结构'}, passive:{name:'被动语态'}, comp:{name:'比较结构'}, ellipsis:{name:'省略'}
};

/* ================= 状态 ================= */
const volatileStore = new Map();
const storage = {
  getItem(key){try{return window.localStorage.getItem(key)}catch{return volatileStore.get(key) ?? null}},
  setItem(key,value){volatileStore.set(key,String(value));try{window.localStorage.setItem(key,value)}catch{}},
  removeItem(key){volatileStore.delete(key);try{window.localStorage.removeItem(key)}catch{}}
};
const LS = k => 'open-sentence-reader-' + k;
const builtinCount=DATA.length;
const records=storedEntries();
records.forEach((row,i)=>DATA.push(personalRecord(row,i+1)));
const recordKey=i=>DATA[i]?.ref ?? i;
const recordIndex=key=>typeof key==='string' && key.startsWith(entryPrefix)?DATA.findIndex(d=>d.ref===key):Number(key);
const phone = matchMedia('(max-width: 920px)');
const state = {
  idx: recordIndex(storage.getItem(LS('idx')) || 0),
  step: -1,
  mode: phone.matches ? 'plain' : 'steps',
  filter: 'all',
  expand: false,
  mastered: new Set(JSON.parse(storage.getItem(LS('mastered')) || '[]')),
  notes: JSON.parse(storage.getItem(LS('notes')) || '{}')
};
if (!Number.isInteger(state.idx) || state.idx < 0 || state.idx >= DATA.length) state.idx = 0;
if (storage.getItem(LS('dark')) === '1') document.body.classList.add('dark');

const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isLetter = c => /[A-Za-z]/.test(c);

/* 在 [from,to) 范围内定位子串（第 nth 次出现，单词按边界匹配） */
function locate(text, spec, from = 0, to = text.length) {
  if (!spec) return null;
  const [sub, nth] = Array.isArray(spec) ? spec : [spec, 0];
  const pat = (isLetter(sub[0]) ? '(?<![A-Za-z])' : '') +
              sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
              (isLetter(sub[sub.length - 1]) ? '(?![A-Za-z])' : '');
  const re = new RegExp(pat, 'g'), seg = text.slice(from, to);
  let m, c = 0;
  while ((m = re.exec(seg))) if (c++ === nth) return [from + m.index, from + m.index + sub.length];
  console.warn('未定位的片段', sub);
  return null;
}

/* 预计算每句的范围 */
DATA.forEach(d => {
  if (d.subj) {
  d.subjR = d.subj.map(s => locate(d.text, s)).filter(Boolean);
  d.predR = d.pred.map(s => locate(d.text, s)).filter(Boolean);
  d.trunkR = d.trunk.map(s => locate(d.text, s)).filter(Boolean);
  d.steps.forEach(st => {
    if (!d.edition) st.r=locate(d.text,st.span); else {const i=d.text.indexOf(st.span);st.r=i<0?null:[i,i+st.span.length];}
    st.headR = st.head && st.r ? (locate(d.text, st.head, st.r[0], st.r[1]) || locate(d.text, st.head)) : null;
    st.anchorR = st.anchor ? locate(d.text, st.anchor) : null;
  });
  }
  d.types = [...new Set(d.steps.map(s => s.type))];
});

/* ================= 渲染 ================= */
function renderSentence() {
  const d = DATA[state.idx], n = d.text.length;
  const cls = Array.from({length: n}, () => []);
  const stepAt = new Array(n).fill(-1);
  const add = (r, c) => { if (r) for (let i = r[0]; i < r[1]; i++) cls[i].push(c); };

  // 点击映射：取包含该字符的最短片段
  d.steps.forEach((st, i) => {
    if (!st.r) return;
    for (let k = st.r[0]; k < st.r[1]; k++) {
      const cur = stepAt[k];
      if (cur < 0 || (d.steps[cur].r[1] - d.steps[cur].r[0]) > (st.r[1] - st.r[0])) stepAt[k] = i;
    }
  });

  if (state.mode !== 'plain') {
    d.subjR.forEach(r => add(r, 'subj'));
    d.predR.forEach(r => add(r, 'pred'));
  }
  if (state.mode === 'trunk') d.trunkR.forEach(r => add(r, 'trunk'));
  if (state.mode === 'steps' && state.step >= 0) {
    const st = d.steps[state.step];
    add(st.r, 'hl'); add(st.r, 't-' + st.type);
    add(st.headR, 'head'); add(st.anchorR, 'anchor');
  }

  let html = '', i = 0;
  while (i < n) {
    const key = cls[i].join(' ') + '|' + stepAt[i];
    let j = i + 1;
    while (j < n && cls[j].join(' ') + '|' + stepAt[j] === key) j++;
    const c = cls[i].slice();
    if (stepAt[i] >= 0 && state.mode === 'steps') c.push('click');
    html += `<span class="${c.join(' ')}"${stepAt[i] >= 0 ? ` data-step="${stepAt[i]}"` : ''}>${esc(d.text.slice(i, j))}</span>`;
    i = j;
  }
  const el = $('sentence');
  el.className = 'sentence mode-' + state.mode;
  el.innerHTML = html;
}

function renderSteps() {
  const d = DATA[state.idx];
  const showSpec = spec => spec.map(s => Array.isArray(s) ? s[0] : s).join(' / ');
  $('core').innerHTML =
    `<div class="s"><small>主语核心</small><strong>${esc((d.subj ? showSpec(d.subj) : d.subject)||'待标注')}</strong></div>
     <div class="p"><small>谓语</small><strong>${esc((d.pred ? showSpec(d.pred) : d.predicate)||'待标注')}</strong></div>
     ${d.coreNote ? '<div style="flex-basis:100%;font-size:13px;line-height:1.7"><small>主句定位</small>'+d.coreNote+'</div>' : ''}`;
  const ol = $('steps');
  ol.classList.toggle('expand-all', state.expand);
  ol.innerHTML = d.steps.map((st, i) => {
    const anc = st.anchor ? (Array.isArray(st.anchor) ? st.anchor[0] : st.anchor) : st.anchorR ? d.text.slice(...st.anchorR) : '';
    return `<li class="step ${i === state.step ? 'active' : ''}" data-i="${i}">
      <button type="button" class="row step-toggle" aria-expanded="${state.expand || i === state.step}" aria-controls="step-body-${i}">
        <span class="num" style="background:var(--${st.type})">${i + 1}</span>
        <span class="lbl" style="color:var(--${st.type})">${st.label}</span>
        <span class="snip">${esc(st.span)}</span>
      </button>
      <div class="body" id="step-body-${i}">
        <div style="font-family:Georgia,serif;margin-bottom:4px">「${esc(st.span)}」</div>
        ${st.note}
        ${anc ? `<div class="relation">关联对象：<em>${esc(anc)}</em></div>` : ''}
      </div>
    </li>`;
  }).join('');
  if(d.personal && !d.steps.length)ol.innerHTML='<li class="subtle">此句尚无可展开的片段。点「校订解析」可标注结构并生成练习。</li>';
  $('prevStep').disabled = state.step < 0;
  $('nextStep').textContent = state.step >= d.steps.length - 1 ? '完成 · 去翻译 ✓' : (state.step < 0 ? '开始拆解 ↓' : '下一步 ↓');
  $('expandBtn').textContent = state.expand ? '收起' : '展开全部';
}

const presentTypes=new Set(DATA.flatMap(d=>d.types));
let paper = DATA[state.idx].group, year = DATA[state.idx].year;
let edition = DATA[state.idx].edition || '';
const groups=[...new Set(DATA.slice(0,builtinCount).map(d=>d.group))];
const examTrack=d=>d.personal ? PERSONAL : ['四级','六级'].includes(d.group) ? d.group : '考研';
const matchesGroup=(d,selected)=>d.personal ? selected===PERSONAL : !selected || (selected==='考研' ? examTrack(d)==='考研' : d.group===selected);
const groupLabel=g=>({'统考':'考研统考','英语一':'考研英语一','英语二':'考研英语二','考研':'考研全部'}[g] || g);

function options(select, values, current, allLabel) {
  select.replaceChildren(new Option(allLabel, ''), ...values.map(v => new Option(select.id==='paper'?groupLabel(v):v,v)));
  select.value = current;
}
function years() {
  $('year').parentElement.hidden=paper===PERSONAL;
  const values = [...new Set(DATA.filter(d=>matchesGroup(d,paper)&&d.year).map(d=>d.year))].sort().reverse();
  if (!values.includes(year)) year='';
  options($('year'),values,year,'全部年份'); editions();
}
function editions() {
  const pool=DATA.filter(d=>d.edition&&matchesGroup(d,paper)&&(!year||d.year===year)).sort((a,b)=>b.month-a.month||a.setno-b.setno);
  const values=[...new Set(pool.map(d=>d.edition))]; $('editionRow').hidden=!values.length;
  if(!values.includes(edition)) edition='';
  options($('edition'),values,edition,'全部月份与套卷');
}
$('edition').onchange=()=>{drawSession=null;edition=$('edition').value;applyFilters();};
function visible() {
  return DATA.map((d,i)=>({d,i})).filter(({d,i})=>matchesGroup(d,paper)&&(!year||year===d.year)&&(!edition||edition===d.edition)&&
    (state.filter==='all'||(state.filter==='todo' ? !state.mastered.has(recordKey(i)) : d.types.includes(state.filter))))
    .sort((a,b)=>Number(b.d.year)-Number(a.d.year)||groups.indexOf(a.d.group)-groups.indexOf(b.d.group)||(b.d.month||0)-(a.d.month||0)||(a.d.setno||0)-(b.d.setno||0)||a.d.num-b.d.num);
}
function applyFilters(){
  const items=visible();
  if (items.length && !items.some(x=>x.i===state.idx)) goSentence(items[0].i);
  else renderAll();
}
function moveSentence(delta) {
  if (drawSession) { moveDraw(delta); return; }
  const items=visible(), pos=items.findIndex(x=>x.i===state.idx);
  if(pos>=0 && items[pos+delta]) goSentence(items[pos+delta].i);
}
options($('paper'),['考研',...groups,PERSONAL],paper,'全部类别'); years();
$('paper').onchange=()=>{drawSession=null;paper=$('paper').value;edition='';years();applyFilters();};
$('year').onchange=()=>{drawSession=null;year=$('year').value;edition='';editions();applyFilters();};
function renderSide() {
  const f = $('filters');
  const chips = [['all', '全部'], ['todo', '未掌握'], ...Object.entries(TYPES).filter(([key])=>presentTypes.has(key)).map(([k, v]) => [k, v.name])];
  f.innerHTML = chips.map(([k, v]) => `<button class="chip ${state.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('');
  const items = visible();
  document.querySelector('main').hidden=!items.length;
  $('noMatches').hidden=!!items.length;
  $('matches').textContent='当前筛选 · '+items.length+' 句';
  $('list').innerHTML = items.length ? items.map(({d, i}) => `
    <button class="item ${i === state.idx ? 'active' : ''} ${state.mastered.has(recordKey(i)) ? 'done' : ''}" data-i="${i}">
      <span class="no">${state.mastered.has(recordKey(i)) ? '✓' : String(d.num).padStart(2, '0')}</span>
      <span><div class="meta">${d.src}</div><div class="preview">${esc(d.text)}</div></span>
    </button>`).join('') : '<div class="empty">没有符合条件的句子</div>';
  const pct = state.mastered.size / DATA.length * 100;
  $('bar').style.width = pct + '%';
  $('progTxt').textContent = `已掌握 ${state.mastered.size} / ${DATA.length} 句`;
}

function renderMeta() {
  const d = DATA[state.idx];
  renderPersonalTools(d);
  $('srcBadge').textContent = d.src; const link=$('originalPaper');link.parentElement.hidden=!d.url;
  if(d.url)link.href=d.url;else link.removeAttribute('href');
  $('sharedNote').textContent=d.paperNote||'';
  for (const btn of $('examTracks').querySelectorAll('button')) btn.setAttribute('aria-pressed',String(btn.dataset.track===examTrack(d)));
  $('tags').innerHTML = d.types.map(t => `<span class="tag" style="color:var(--${t});background:var(--${t}-bg)">${TYPES[t].name}</span>`).join('');
  const done = state.mastered.has(recordKey(state.idx));
  $('doneBtn').textContent = done ? '★ 已掌握' : '☆ 标记掌握';
  $('doneBtn').classList.toggle('on', done);
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
  $('transTxt').textContent = d.trans;
  $('myTrans').value = state.notes[recordKey(state.idx)] || '';
  renderPhraseList();
  const items=visible(), pos=items.findIndex(x=>x.i===state.idx);
  $('prevS').disabled=pos<=0; $('nextS').disabled=pos<0 || pos===items.length-1;
  if (phone.matches) updatePhone(d, done, items.length);
  syncDrawNav();
}

function renderAll() { renderSide(); renderMeta(); renderSteps(); renderSentence(); }
function refresh() { renderSteps(); renderSentence(); }

/* ================= 交互 ================= */
function goSentence(i) {
  if (i < 0 || i >= DATA.length) return;
  if (!openingDraw) drawSession=null;
  state.idx = i; state.step = -1; state.expand = false;
  $('trans').classList.remove('show');
  if (phone.matches) choosePanel('grammar');
  window.speechSynthesis?.cancel();
  storage.setItem(LS('idx'),recordKey(i));storage.setItem(LS('last-'+examTrack(DATA[i])),i);
  renderAll();
  if (!$('catalogSheet').open) window.scrollTo({top: 0, behavior: 'instant'});
}
function setStep(i) {
  const max = DATA[state.idx].steps.length - 1;
  if (i > max) { if (phone.matches) choosePanel('translation'); $('myTrans').focus(); return; }
  state.step = Math.max(-1, i);
  if (state.mode !== 'steps') state.mode = 'steps', renderMeta();
  refresh();
  const act = document.querySelector('.step.active');
  act && act.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
function setMode(m) { state.mode = m; renderMeta(); renderSentence(); }
function toggleDone() {
  state.mastered.has(recordKey(state.idx)) ? state.mastered.delete(recordKey(state.idx)) : state.mastered.add(recordKey(state.idx));
  storage.setItem(LS('mastered'), JSON.stringify([...state.mastered]));
  applyFilters();
}
function speak() {
  if (!('speechSynthesis' in window)) return alert('当前浏览器不支持朗读');
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(DATA[state.idx].text);
  u.lang = 'en-US'; u.rate = 0.85;
  const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('en'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

$('list').addEventListener('click', e => { const b = e.target.closest('.item'); if (b) { if ($('catalogSheet').open) $('catalogSheet').close(); goSentence(+b.dataset.i); } });
$('filters').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { drawSession=null; state.filter = b.dataset.f; applyFilters(); } });
$('steps').addEventListener('click', e => { const li = e.target.closest('.step'); if (li) {
  const keyboard = e.detail === 0;
  const index = +li.dataset.i;
  setStep(index === state.step ? -1 : index);
  if (keyboard) $('steps').querySelector('[data-i="'+index+'"] button')?.focus({preventScroll:true});
} });
$('sentence').addEventListener('click', e => { const s = e.target.closest('[data-step]'); if (s && state.mode === 'steps') {
    if (phone.matches) openPiece(+s.dataset.step);
    else setStep(+s.dataset.step);
  } });
$('modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
$('prevStep').onclick = () => setStep(state.step - 1);
$('nextStep').onclick = () => setStep(state.step + 1);
$('expandBtn').onclick = () => { state.expand = !state.expand; renderSteps(); };
$('prevS').onclick = () => moveSentence(-1);
$('nextS').onclick = () => moveSentence(1);
$('revealBtn').onclick = () => { $('trans').classList.toggle('show'); syncReveal(); };
$('trans').addEventListener('dblclick', () => { if (!phone.matches) { $('trans').classList.remove('show'); syncReveal(); } });
$('doneBtn').onclick = toggleDone;
$('speakBtn').onclick = speak;
$('myTrans').addEventListener('input', e => {
  state.notes[recordKey(state.idx)] = e.target.value;
  storage.setItem(LS('notes'), JSON.stringify(state.notes));
});
$('darkBtn').onclick = () => {
  const on = document.body.classList.toggle('dark');
  storage.setItem(LS('dark'), on ? '1' : '0');
};
$('resetBtn').onclick = () => {
  if (!confirm('确定清空掌握进度和自己的译文吗？')) return;
  state.mastered.clear(); state.notes = {};
  storage.removeItem(LS('mastered')); storage.removeItem(LS('notes'));
  renderAll();
};

document.addEventListener('keydown', e => {
  if (['TEXTAREA','SELECT','INPUT'].includes(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
  if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('main').hidden || (e.target.closest('button') && e.key===' ')) return;
  const k = e.key.toLowerCase();
  const map = {
    arrowleft: () => moveSentence(-1),
    arrowright: () => moveSentence(1),
    arrowdown: () => setStep(state.step + 1),
    ' ': () => setStep(state.step + 1),
    arrowup: () => setStep(state.step - 1),
    t: () => { if (phone.matches) choosePanel('translation'); $('revealBtn').click(); },
    m: toggleDone,
    s: speak,
    '1': () => setMode('steps'), '2': () => setMode('trunk'), '3': () => setMode('plain')
  };
  if (map[k]) { e.preventDefault(); map[k](); }
});

const totalByPaper = new Map();
for (const d of DATA) {
  const key = d.year + d.group + d.edition;
  totalByPaper.set(key, (totalByPaper.get(key) || 0) + 1);
}
let panel = 'grammar';
let sizeIndex = [0,1,2].includes(Number(storage.getItem(LS('font')))) ? Number(storage.getItem(LS('font'))) : 0;
const sizes = [22,25,28];
const catalog = $('catalogSheet'), sheet = $('studySheet'), aside = $('catalogBody');
const homeSlot = document.createComment('原目录位置');
aside.before(homeSlot);
function choosePanel(name) {
  panel = name;
  document.body.dataset.panel = name;
  for (const button of document.querySelectorAll('.study-tabs button')) {
    const active = button.dataset.panel === name;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
function syncReveal() {
  const on = $('trans').classList.contains('show');
  $('revealBtn').textContent = phone.matches ? (on ? '收起参考译文' : '查看参考译文') : '对照参考译文 (T)';
  $('revealBtn').setAttribute('aria-expanded',String(on));
  $('transTxt').setAttribute('aria-hidden', String(!on));
}
function applyFont() {
  document.documentElement.style.setProperty('--phone-font',sizes[sizeIndex]+'px');
  $('fontSizeBtn').setAttribute('aria-label','调整原句字号，当前 '+sizes[sizeIndex]+' 像素');
}
function updatePhone(d, done, count) {
  $('paperTitle').textContent = d.personal ? PERSONAL : d.edition ? d.year+' 年 '+d.month+' 月 · '+d.group+'第 '+d.setno+' 套' : d.year+' 年 · '+groupLabel(d.group);
  $('paperSource').textContent = d.section;
  const total=d.personal ? DATA.length-builtinCount : totalByPaper.get(d.year+d.group+d.edition);
  $('folioNum').textContent=String(d.num).padStart(2,'0');
  $('folioTotal').textContent=' / '+total;
  $('mobileDone').classList.toggle('done-on',done);
  $('mobileDone').setAttribute('aria-pressed',String(done));
  $('mobileDone').querySelector('span').textContent=done?'已掌握':'标记掌握';
  $('mobilePrev').disabled=$('prevS').disabled;
  $('mobileNext').disabled=$('nextS').disabled;
  $('phoneDock').hidden=!count;
  $('readingHint').textContent={plain:'先试着找出主句的谓语，再切换到「只看主干」。',trunk:'深色部分为主干，淡色部分保留原句语境。',steps:'点击带标记的片段，查看它在句中的作用。'}[state.mode];
  for(const b of document.querySelectorAll('#modeSeg button')) b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));
  const phraseTab=document.querySelector('.study-tabs [data-panel="phrases"]');
  phraseTab.hidden=false;
  if (phraseTab.hidden && panel==='phrases') choosePanel('grammar');
  $('filterSummary').textContent='语法与掌握状态 · '+($('filters').querySelector('.on')?.textContent||'全部');
  if(d.personal)$('readingHint').textContent=d.verified?'可点标记片段查看讲解。':d.ai?'点标记片段查看 AI 讲解。':'规则拆解草稿，可在「校订解析」中修改。';
  syncReveal();
}
function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('sheet-open');
}
function pieceInfo(i) {
  state.step=i;
  refresh();
  const d=DATA[state.idx], st=d.steps[i];
  $('studyHeading').textContent=st.label;
  $('piece').textContent=st.span;
  $('pieceNote').innerHTML=st.note;
  const linked=st.anchorR ? d.text.slice(...st.anchorR) : '';
  $('pieceAnchor').hidden=!linked;
  $('pieceAnchor').textContent=linked ? '关联词　'+linked : '';
  $('pieceCount').textContent=(i+1)+' / '+d.steps.length;
  $('pieceBack').disabled=i===0;
  $('pieceNext').disabled=i===d.steps.length-1;
  sheet.querySelector('.sheet-reading').scrollTop=0;
}
function openPiece(i) {pieceInfo(i);showDialog(sheet);}
function configureLayout() {
  for (const modal of [catalog,sheet]) if(modal.open) modal.close();
  if(phone.matches) catalog.append(aside); else homeSlot.after(aside);
  $('filterDisclosure').open=!phone.matches;
  document.body.classList.remove('sheet-open','editing');
  choosePanel(panel);
  syncReveal();
}
$('openCatalog').onclick=()=>{
  showDialog(catalog);
  const active=$('list').querySelector('.active');
  if(active) $('list').scrollTop+=active.getBoundingClientRect().top-$('list').getBoundingClientRect().top-8;
};
for(const button of document.querySelectorAll('[data-close]')) button.onclick=()=>$(button.dataset.close).close();
for(const dialog of [catalog,sheet]){
  dialog.addEventListener('close',()=>document.body.classList.toggle('sheet-open',!!document.querySelector('dialog[open]')));
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientY<rect.top || event.clientY>rect.bottom || event.clientX<rect.left || event.clientX>rect.right) dialog.close();
  });
}
$('pieceBack').onclick=()=>pieceInfo(state.step-1);
$('pieceNext').onclick=()=>pieceInfo(state.step+1);
$('mobilePrev').onclick=()=>moveSentence(-1);
$('mobileNext').onclick=()=>moveSentence(1);
$('mobileDone').onclick=toggleDone;
$('mobileSpeak').onclick=speak;
$('fontSizeBtn').onclick=()=>{sizeIndex=(sizeIndex+1)%sizes.length;storage.setItem(LS('font'),sizeIndex);applyFont();};
document.querySelector('.study-tabs').onclick=e=>{const b=e.target.closest('button');if(b) choosePanel(b.dataset.panel);};
let dockTimer;
let pointerHeld = false;
function restoreDock() {
  clearTimeout(dockTimer);
  if (!pointerHeld && document.activeElement !== $('myTrans')) {
    dockTimer = setTimeout(() => document.body.classList.remove('editing'), 180);
  }
}
document.addEventListener('pointerdown', () => {pointerHeld = true;}, true);
for (const name of ['pointerup','pointercancel']) {
  document.addEventListener(name, () => {pointerHeld = false; restoreDock();}, true);
}
$('myTrans').addEventListener('focus', () => {
  clearTimeout(dockTimer);
  document.body.classList.add('editing');
});
$('myTrans').addEventListener('blur', restoreDock);
const themeLabel=()=>{$('darkBtn').textContent=document.body.classList.contains('dark')?'切换浅色':'切换深色';};
$('darkBtn').addEventListener('click',themeLabel);
phone.addEventListener('change',()=>{configureLayout();renderAll();});
/* Each row is an original transfer exercise. Correct answers are shuffled for display. */
const exerciseRows = `
relative|The map that Nina drew is on the wall.|that Nina drew 修饰什么？|the map|Nina|the wall|把从句暂时移开，主句是 The map is on the wall。再问“哪张地图”，答案就是 Nina 画的那张。
relative|The instrument on which the estimate depends is being repaired.|on which 中的 which 指代什么？|the instrument|the estimate|the repair|还原成 the estimate depends on the instrument，介词 on 的宾语就清楚了。
omitRelative|The figures we checked yesterday tell a different story.|we checked yesterday 前可以补回什么？|that|when|whose|把 figures 放回 checked 后，得到 we checked the figures。缺的是宾语，所以关系代词可以省略。
omitRelative|The flat Maya rented faces the river.|哪个动词是主句谓语？|faces|rented|两个动词都是|Maya rented 修饰 flat，rented 的宾语位置留给了 flat。主干是 The flat faces the river。
nonrestrict|The last bus, which leaves at nine, stops here.|去掉两逗号之间的内容后，主句是什么？|The last bus stops here.|The last bus leaves at nine.|The last bus leaves here.|which 从句补充末班车的发车时间，stops 才是主句谓语。
content|The team discovered that the sensor was faulty.|that 后面整段作什么成分？|discovered 的宾语|sensor 的定语|team 的同位语|问“团队发现了什么”，答案是 the sensor was faulty 这一整件事。
content|We cannot tell whether the letter arrived.|若把从句替换成一个代词，最接近哪种结构？|We cannot tell that.（我们无法判断那件事。）|We cannot arrive there.|The letter cannot tell.|whether 从句整体作 tell 的宾语，表达“信是否到了”这个待判断的问题。
predClause|The puzzle is why the signal stopped.|why the signal stopped 在句中作什么？|表语|时间状语|主语|系动词 is 后的从句说明 puzzle 的具体内容，主语是 The puzzle。
adverb|Because the river had risen, the road was closed.|哪一部分说明封路的原因？|Because the river had risen|the road was closed|the road|先读主句“路封了”，再用 because 从句补上原因。
time|As the doors opened, the crowd fell silent.|这里的 as 最适合译为什么？|当……时|正如……所说|尽管|开门和人群安静下来同时发生。as 从句交代主句动作发生的时间。
condition|Unless demand falls, the extra train will keep running.|什么条件下加班车会继续运行？|需求没有下降|需求已经下降|列车已经停运|unless demand falls 等于 if demand does not fall，先展开否定再接主句。
result|The path was so narrow that the cart could barely pass.|that 从句说明什么？|路窄造成的结果|修路的目的|cart 的特征|so 与 narrow 相连，that 引出程度造成的后果：车几乎过不去。
concession|Although the sample was small, the pattern was clear.|主句最终肯定了什么？|规律很清楚|样本很大|规律尚未出现|although 从句先承认样本小，主句给出在这一限制下仍成立的判断。
place|Seeds thrive where the soil drains well.|where 从句回答哪个问题？|种子在哪儿长得好|种子为何被收走|哪一种种子|where 后面是一整个从句，交代 thrive 发生的地点。
manner|Leave the samples as you found them.|as you found them 限定什么？|留下样品的方式或状态|样品的数量|发现样品的人|as 表示“照……的样子”，即让样品维持发现时的状态。
infinitive|The volunteers hope to reopen the hall in May.|哪个部分是主句谓语？|hope|to reopen|in May|hope 随主语变化，to reopen 是不定式，说明志愿者希望做什么。
infinitive|We need a shelf to hold the samples.|to hold the samples 紧跟在哪个词后，说明它的用途？|shelf|We|samples|先读 We need a shelf，再补上“用来放样品的”，得到 shelf 的用途。
purpose|To avoid glare, the artist covered the window.|盖住窗户的目的是什么？|避免眩光|说明已经出现眩光|遮住艺术家|把 To avoid 展开为 In order to avoid 即可读出目的。主句动作是 covered。
reasonInf|Lina was relieved to hear the news.|to hear the news 与 relieved 是什么关系？|说明感到宽慰的原因|说明听消息的目的|修饰 news 的来源|先有“听说这个消息”，才有“感到宽慰”。不定式补充情绪产生的原因。
subjectComp|The painting is believed to date from 1840.|谁或什么可以充当 date from 1840 的逻辑主语？|the painting|相信这个说法的人|1840|还原成 People believe that the painting dates from 1840，便能看出 date 的主语。
participle|Turning the handle, Ada released the latch.|谁在转动把手？|Ada|the latch|the handle|分词短语没有另立主语。把它接回主句主语，得到 Ada turned the handle。
partAttr|The letters stored upstairs survived the flood.|stored upstairs 表示什么？|信被存放在楼上|信主动存放别的东西|洪水发生在楼上|stored 修饰 letters，可展开为 that were stored upstairs。主句谓语是 survived。
partAttr|Students working in pairs finished sooner.|working in pairs 修饰谁？|Students|pairs|sooner|相当于 students who were working in pairs。finished 才是主句谓语。
passiveIng|The bridge being repaired carries little traffic this week.|being repaired 表明哪层意思？|桥正在被维修|桥已经修完|桥正在维修别的设施|being 与过去分词组合，兼有进行和被动两层意思。carries 是主句谓语。
resultIng|The dam broke, flooding the lower fields.|flooding the lower fields 表示什么？|决堤后的结果|田地发生在决堤之前的动作|大坝的用途|先发生 The dam broke，随后的分词短语写它引起的后果。
formalIt|It is difficult to predict the exact cost.|真正被评价为 difficult 的是什么？|to predict the exact cost|it 这个物体|the exact cost 本身|it 占据主语位置，可还原成 To predict the exact cost is difficult。
coord|The team collected and archived every sample.|哪两项共用同一个主语和宾语？|collected 与 archived|team 与 sample|collected 与 sample|把省去的成分补回，就是 The team collected every sample and archived every sample。
coord|The ticket covers transport, lunch and entry to the museum.|三个并列项共同充当什么？|covers 的宾语|三个分句的主语|修饰 museum 的定语|问“票价包含什么”，transport、lunch 和 entry to the museum 依次回答这个问题。
imperative|Press the switch and the room will light up.|前半句与后半句有什么关系？|按下开关就会产生后面的结果|两个动作都发生在昨天|后半句给开关下定义|可改写成 If you press the switch, the room will light up。
apposition|Mina, the youngest of the three guides, knew the route.|the youngest of the three guides 指谁？|Mina|the route|三位向导全体|中间的名词短语给 Mina 补一个身份。去掉它，Mina knew the route 仍完整。
insertion|The second route, the guide warned, was still unsafe.|去掉插入成分后，主句是哪一句？|The second route was still unsafe.|The guide was still unsafe.|The second route warned the guide.|the guide warned 交代说话者，把它暂时移开即可连起 route 和 was。
comparison|The new tray holds twice as many cups as the old one.|如果旧托盘装 6 个杯子，新托盘装多少？|12 个|8 个|18 个|twice as many … as … 指数量为对方的两倍，直接用 6 乘 2。
compareClause|The road is steeper than it looks from here.|than 从句提供什么？|比较的基准|上坡的目的|路的所属关系|实际坡度与“从这里看起来的坡度”作比较，steeper 是比较级。
ellipsis|When ready, the bread can be removed from the oven.|When ready 最自然的完整形式是什么？|When the bread is ready|When the oven is removed|When someone readies the oven|状语从句与主句主语一致，the bread 和 be 可以一起省去。
phrase|The smell of chalk brings to mind my first classroom.|brings to mind 后面接的是什么？|被想起的事物|想事情的人|某物的产地|bring something to mind 表示“使人想起某事”。这里被唤起的是对第一间教室的回忆。
beTo|The two teams are to meet on Friday.|are to meet 在这里表达什么？|按安排将会面|正好正在会面|已经结束会面|be to do 可表示正式安排，这里安排的时间是 Friday。
doubleObj|The guide gave each visitor a map.|哪一项是接受者？|each visitor|a map|the guide|可改写为 gave a map to each visitor。map 是被给予的东西。
nominal|The closure of the tunnel delayed deliveries.|若将 closure 改写成动词，哪种理解最贴近？|The tunnel was closed.|The tunnel closed the deliveries.|The deliveries opened the tunnel.|closure 把关闭这件事名词化；of the tunnel 说明被关闭的对象。
pointAs|The witness pointed to the loose wire as the cause.|哪一项被认作起因？|the loose wire|the witness|the act of pointing|point to A as B 表示指出 A 是 B，这里的 A 是 the loose wire。
source|In the committee report, the chair calls for a trial.|句首短语交代什么？|这一主张出现的出处|试验的具体结果|委员会的成员人数|in the committee report 把 calls for a trial 这个说法放到具体出处中。
`.trim().split('\n').map(row=>row.split('|'));
function exerciseFamily(s) {
  if (s.label === "目的不定式") return "purpose";
  if (s.label === "让步状语从句") return "concession";
  const l=s.label, t=s.type, w=s.span.trim().toLowerCase();
  if(t==='passive') return 'passive'; if(l==='动名词作主语')return 'gerundSubject'; if(l==='介词短语')return 'prep'; if(l==='主语从句')return 'subjClause';
  if(l==='结构解析') return ({'in which':'relative','but':'coord','in her new book':'source','says coyle':'insertion','as':'adverb','while':'concession'})[w] || 'phrase';
  if(t==='attr') return l.includes('非限制')?'nonrestrict':l.includes('省略')?'omitRelative':'relative';
  if(t==='nonfin'){ if (/^to\s/i.test(w)) return 'infinitive';
    if(l.includes('形式主语')) return 'formalIt';
    if(l.includes('目的')) return 'purpose';
    if(l.includes('原因')) return 'reasonInf';
    if(l.includes('主语补足')) return 'subjectComp';
    if(l.includes('被动进行')) return 'passiveIng';
    if(l.includes('结果')) return 'resultIng';
    if(l.includes('分词')&&l.includes('定语')) return 'partAttr';
    return l.includes('不定式')?'infinitive':'participle';
  }
  if(t==='adv'){
    if(l.includes('结果')) return 'result';
    if(l.includes('条件') || /^(if|unless|provided)\b/.test(w)) return 'condition';
    if(l.includes('地点') || /^where\b/.test(w)) return 'place';
    if(l.includes('方式')) return 'manner';
    if(/^(although|though|even though)\b/.test(w)) return 'concession';
    if(l.includes('时间') || /^(when|after|before|once|until)\b/.test(w)) return 'time';
    if(/^than\b/.test(w)) return 'compareClause';
    return 'adverb';
  }
  if(t==='coord') return l.includes('祈使')?'imperative':'coord';
  if(t==='appos') return l.includes('插入')?'insertion':'apposition';
  if(t==='noun') return l.includes('表语')?'predClause':'content';
  if(t==='comp') return l.includes('倍数')?'comparison':'compareClause';
  if(t==='ellipsis') return 'ellipsis';
  if(l.includes('双宾')) return 'doubleObj';
  if(l.includes('名词化')) return 'nominal';
  if(l.includes('be to')) return 'beTo';
  if(l.includes('point to')) return 'pointAs';
  return 'phrase';
}

const learning = $('learningDialog'), content = $('learnContent');
const permute = values => {
  const out = values.slice();
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]];}
  return out;
};
function readStudy(key, fallback) {
  try {return JSON.parse(storage.getItem(LS(key)) || 'null') ?? fallback;} catch{return fallback;}
}
const yearValues=[...new Set(DATA.slice(0,builtinCount).map(d=>+d.year))].sort((a,b)=>b-a);
const defaultDraw={group:'',when:'all',year:yearValues[0],end:yearValues[0]};
let criteria={...defaultDraw,...readStudy('drawFilters',{})}, drawSession=null, openingDraw=false;
let modeTab='draw', saved=readStudy('savedPhrases',[]), tokens=[], selected=[], pendingEnd=false, pickedGloss='';
if(!Array.isArray(saved)) saved=[];
saved=saved.map(p=>({...p,i:recordIndex(p.i)})).filter(p=>DATA[p.i]);
let drill=null, review=null, listLimit=32;
function action(label,act,value='',cls='secondary-act',extra=''){
  return '<button class="'+cls+'" data-act="'+act+'" data-value="'+esc(String(value))+'" '+extra+'>'+esc(label)+'</button>';
}
function title(text){$('learnHeading').textContent=text;}
function screen(name,html){
  title(name);content.innerHTML=html;content.scrollTop=0;
}
function displayDialog() {
  if(!learning.open) {showDialog(learning);$('learnHeading').tabIndex=-1;$('learnHeading').focus({preventScroll:true});}
}
function closeLearning(){if(learning.open) learning.close();}
$('learnClose').onclick=closeLearning;
learning.addEventListener('close',()=>document.body.classList.toggle('sheet-open',!!document.querySelector('dialog[open]')));
learning.addEventListener('click',e=>{
  if(e.target!==learning)return;
  const b=learning.getBoundingClientRect();
  if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom) closeLearning();
});
function setTabs(active){
  const names={draw:'随机抽句',drill:'专项练习',vocab:'词组本',review:'已掌握'};
  $('learnTabs').hidden=!active;
  $('learnTabs').innerHTML=active?Object.entries(names).map(([k,v])=>action(v,'tab',k,'','aria-pressed="'+(k===active)+'"')).join(''):'';
}
function openHub(tab=modeTab){
  modeTab=tab;review=null;listLimit=32;setTabs(tab);
  if(tab==='draw') drawForm();else if(tab==='drill') drillHome();else if(tab==='vocab') vocabPage();else reviewHome();
  displayDialog();
}
$('learnTabs').onclick=e=>{const b=e.target.closest('[data-act=tab]');if(b){openHub(b.dataset.value);$('learnTabs').querySelector('[aria-pressed=true]').focus({preventScroll:true});}};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-open]');
  if(!b)return;
  if(b.dataset.open==='pick') openPicker();else openHub(b.dataset.open==='hub'?modeTab:b.dataset.open);
});
const drawGroups=[[PERSONAL,PERSONAL],['','全部例句'],['考研','考研全部'],...groups.map(g=>[g,groupLabel(g)])];
const drawTimes=[['all','不限'],['through','及以前'],['from','及以后'],['exact','仅此年'],['range','年份区间']];
function matchDraw(d){
  if(d.personal)return criteria.group===PERSONAL;
  if(!matchesGroup(d,criteria.group))return false;
  const y=+d.year, a=+criteria.year, b=+criteria.end;
  return {all:true,through:y<=a,from:y>=a,exact:y===a,range:y>=a && y<=b}[criteria.when] || false;
}
function drawPool(){const seen=new Set(),ids=[];DATA.forEach((d,i)=>{if(matchDraw(d)&&!seen.has(d.text)){ids.push(i);seen.add(d.text);}});return ids;}
function scopeText(){
  if(criteria.group===PERSONAL)return PERSONAL;
  const y=criteria.year;
  const yearsText={all:'全部年份',through:y+' 年及以前',from:y+' 年及以后',exact:y+' 年',range:y+'–'+criteria.end+' 年'};
  return (groupLabel(criteria.group)||'全部题库')+' · '+yearsText[criteria.when];
}
function drawForm(){
  const options=(values,k)=>values.map(([v,text])=>action(text,'criterion',k+'|'+v,'','aria-pressed="'+(criteria[k]===v)+'"')).join('');
  const chooseYear=(k,title)=>'<label>'+title+'<select data-year="'+k+'">'+yearValues.map(y=>'<option '+(y===+criteria[k]?'selected':'')+'>'+y+'</option>').join('')+'</select></label>';
  const personal=criteria.group===PERSONAL;
  const when=personal?'all':criteria.when, count=drawPool().length;
  screen('学习手册','<fieldset><legend>从哪里抽句？</legend><div class="segment-set">'+options(drawGroups,'group')+'</div></fieldset>'+
    (personal?'':'<fieldset><legend>年份范围</legend><div class="segment-set">'+options(drawTimes,'when')+'</div></fieldset>')+
    (when!=='all'?'<div class="year-pair">'+chooseYear('year',when==='range'?'起始年份':'所选年份')+(when==='range'?chooseYear('end','结束年份'):'')+'</div>':'')+
    '<p class="subtle">'+(when==='range'&&criteria.year>criteria.end?'起始年份晚于结束年份，请调整。':count?'可抽 '+count+' 句'+'。同一轮抽完前不会重复。':'这个范围还没有句子。')+'</p>'+
    action('随机抽一句','draw','','primary-act wide',count?'':'disabled'));
}
function saveCriteria(){storage.setItem(LS('drawFilters'),JSON.stringify(criteria));drawForm();}
function freshDeck(pool,avoid){
  const deck=permute(pool);
  if(deck.length>1&&deck[deck.length-1]===avoid) [deck[0],deck[deck.length-1]]=[deck[deck.length-1],deck[0]];
  return deck;
}
function jumpReader(i){
  const d=DATA[i];paper=d.group;year=d.year;edition=d.edition||'';state.filter='all';$('paper').value=paper;years();
  goSentence(i);
}
function moveDraw(delta) {
  const r=drawSession;
  if(!r || (delta<0 && r.at===0)) return;
  if(delta>0 && r.at===r.history.length-1){
    if(!r.deck.length){r.deck=freshDeck(r.pool,r.history[r.at]);r.round++;}
    r.history.push(r.deck.pop());
  }
  r.at+=delta;
  openingDraw=true;
  try{jumpReader(r.history[r.at]);}finally{openingDraw=false;}
}
function launchDraw(){
  const pool=drawPool();if(!pool.length)return;
  const key=JSON.stringify(criteria);
  if(!drawSession||drawSession.key!==key) drawSession={key,pool,deck:freshDeck(pool,state.idx),history:[],at:-1,round:1,label:scopeText()};
  closeLearning();moveDraw(1);
}
function syncDrawNav(){
  const r=drawSession;
  $('drawRibbon').hidden=!r;
  if(r) $('drawScope').textContent='随机精读 · '+r.label+' · '+(r.at%r.pool.length+1)+' / '+r.pool.length;
  const nextLabel=r?(r.at<r.history.length-1?'下一抽':'再抽一句'):'下一句';
  $('prevS').textContent=r?'← 上一抽':'← 上一句';$('nextS').textContent=nextLabel+' →';
  $('mobilePrev').lastChild.textContent=r?'上一抽':'上一句';$('mobileNext').firstChild.textContent=nextLabel;
  if(r){$('prevS').disabled=$('mobilePrev').disabled=r.at<=0;$('nextS').disabled=$('mobileNext').disabled=false;}
}
$('endDraw').onclick=()=>{drawSession=null;renderMeta();};
function phraseId(i,word){return recordKey(i)+'|'+word.trim().toLocaleLowerCase().replace(/\s+/g,' ');}
function keepPhrases(){storage.setItem(LS('savedPhrases'),JSON.stringify(saved.map(p=>({...p,i:recordKey(p.i)}))));}

function putPhrase(i,word,gloss){
  const key=phraseId(i,word), old=saved.find(p=>p.key===key);
  if(old) old.gloss=gloss;else saved.unshift({key,i,word,gloss});
  keepPhrases();renderPhraseList();
}
function forgetPhrase(key){saved=saved.filter(p=>p.key!==key);keepPhrases();renderPhraseList();}
function renderPhraseList(){
  const i=state.idx, d=DATA[i];
  const rows=d.phrases.map(([word,gloss])=>({word,gloss}));
  $('phraseCount').textContent='本句预设 '+rows.length+' 组';
  for(const item of saved.filter(p=>p.i===i)) if(!rows.some(row=>phraseId(i,row.word)===item.key)) rows.push(item);
  $('phrases').innerHTML=rows.length?rows.map(({word,gloss})=>{
    const item=saved.find(p=>p.key===phraseId(i,word));
    return '<li class="phrase-item"><div><b lang="en">'+esc(word)+'</b><small>'+esc(item?.gloss||gloss||'已选自本句')+'</small></div><button class="fav-act" data-word="'+esc(word)+'" data-gloss="'+esc(gloss)+'" aria-label="'+(item?'取消收藏':'收藏')+' '+esc(word)+'" aria-pressed="'+!!item+'">'+(item?'★':'☆')+'</button></li>';
  }).join(''):'<li class="subtle">可以从原句中任选想记住的词组。</li>';
}
$('phrases').onclick=e=>{
  const b=e.target.closest('.fav-act');if(!b)return;
  const key=phraseId(state.idx,b.dataset.word);
  if(saved.some(p=>p.key===key)) forgetPhrase(key);else putPhrase(state.idx,b.dataset.word,b.dataset.gloss);
  const replacement=[...$('phrases').querySelectorAll('.fav-act')].find(el=>el.dataset.word===b.dataset.word);replacement?.focus({preventScroll:true});
};
function wordTokens(text){return [...text.matchAll(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)].map(m=>({start:m.index,end:m.index+m[0].length,word:m[0]}));}
function selectionInfo(){
  if(!selected.length)return '';
  const [a,b]=selected;
  return DATA[state.idx].text.slice(tokens[a].start,tokens[b].end);
}
function pickerSelection(syncGloss=true){
  const word=selectionInfo(), key=phraseId(state.idx,word), match=saved.find(p=>p.key===key);
  for(const btn of content.querySelectorAll('[data-act=token]'))btn.setAttribute('aria-pressed',String(!!selected.length && +btn.dataset.value>=selected[0] && +btn.dataset.value<=selected[1]));
  $('chosenWords').textContent=word||'尚未选词';
  $('pickHint').textContent=pendingEnd?'已选起点，再点终点，或直接收藏这个词。':'点起点，再点终点。单词也可以单独收藏。';
  if(syncGloss){
    const rec=(DATA[state.idx].phrases||[]).find(([w])=>phraseId(state.idx,w)===key);
    pickedGloss=match?.gloss||rec?.[1]||'';$('pickGloss').value=pickedGloss;
  }
  $('keepPick').disabled=!word;
  $('keepPick').textContent=match?'保存笔记':'收藏所选词组';
}
function openPicker(){
  const d=DATA[state.idx], selection=window.getSelection();tokens=wordTokens(d.text);selected=[];pendingEnd=false;
  if(selection?.rangeCount && !selection.isCollapsed && $('sentence').contains(selection.anchorNode) && $('sentence').contains(selection.focusNode)){
    const range=selection.getRangeAt(0), pre=range.cloneRange();pre.selectNodeContents($('sentence'));pre.setEnd(range.startContainer,range.startOffset);
    const start=pre.toString().length, end=start+range.toString().length;
    const parts=tokens.map((t,j)=>t.end>start&&t.start<end?j:-1).filter(j=>j>=0);
    if(parts.length)selected=[parts[0],parts.at(-1)];
  }
  let flow='',pos=0;
  tokens.forEach((t,j)=>{
    flow+=esc(d.text.slice(pos,t.start))+action(t.word,'token',j,'','aria-pressed="false"');pos=t.end;
  });flow+=esc(d.text.slice(pos));
  setTabs(null);screen('自选词组','<p id="pickHint" class="subtle"></p><div class="word-flow" lang="en">'+flow+'</div><p class="selection-preview" id="chosenWords" aria-live="polite" lang="en"></p><label class="pick-gloss">释义或笔记（选填）<input id="pickGloss" maxlength="500" autocomplete="off"></label><div class="learn-row"><button class="primary-act" id="keepPick" data-act="keep">收藏所选词组</button>'+action('打开词组本','tab','vocab')+'</div><p class="subtle" id="pickStatus" role="status"></p>');pickerSelection();displayDialog();
}
function vocabPage(limit=listLimit){
  const rows=saved.slice(0,limit);
  screen('学习手册','<h3>收藏词组 · '+saved.length+'</h3>'+(saved.length?'<ul class="saved-list">'+rows.map((p,j)=>'<li><div class="saved-phrase" lang="en">'+esc(p.word)+'</div>'+(p.gloss?'<p>'+esc(p.gloss)+'</p>':'')+'<div class="subtle">'+DATA[p.i].src+'</div><div class="learn-row">'+action('回到原句','origin',p.i,'text-act')+action('编辑笔记','edit',j,'text-act')+action('移除','forget',j,'text-act')+'</div></li>').join('')+'</ul>':'<p class="empty-note">在「重点词组」中点星号收藏，也可以点「从原句选词」添加自己的词组。</p>')+(saved.length>limit?action('显示更多词组','moreVocab'):''));
}
const markers={
  although:['because','unless'],though:['if','when'],if:['although','because'],unless:['while','because'],
  while:['because','unless'],as:['unless','after'],when:['unless','that'],where:['unless','which'],
  which:['whose','what'],who:['which','whose'],whose:['whom','that'],whom:['whose','what'],that:['whether','whose'],
  and:['but','nor'],but:['and','or'],or:['yet','and'],than:['that','then'],to:['for','by'],
  in:['at','of'],on:['for','with'],because:['unless','although'],whether:['where','whose']
};
function makeSourceQuestion(d,st){
  const rr=st.r||[d.text.indexOf(st.span),d.text.indexOf(st.span)+st.span.length];
  const within=wordTokens(d.text.slice(rr[0],rr[1]));
  const first=within[0];
  const head=st.headR && st.headR[0]>=rr[0] && st.headR[1]<=rr[1] ? st.headR : null;
  let gap=markers[first?.word.toLowerCase()]||!head?[rr[0]+first.start,rr[0]+first.end]:head;
  let answer=d.text.slice(...gap);
  const options=markers[answer.toLowerCase()] || [...new Set(wordTokens(d.text).map(t=>t.word.toLowerCase()))].filter(w=>w!==answer.toLowerCase()&&w.length>=3).sort((a,b)=>Math.abs(a.length-answer.length)-Math.abs(b.length-answer.length));
  const titleCase=answer[0]===answer[0].toUpperCase();
  const alternatives=options.slice(0,2).map(w=>titleCase?w[0].toUpperCase()+w.slice(1):w);
  return {lead:d.personal?'原句还原':'原句还原',prompt:'结合全句，选出原文空缺处的词。',quote:esc(d.text.slice(0,gap[0]))+'<mark>　？　</mark>'+esc(d.text.slice(gap[1])),answer,options:permute([answer,...alternatives]),note:st.note};
}
const structuralRoles={passive:'说明主语承受某个动作，结合助动词识别时态',gerundSubject:'由动名词短语指称一项活动，整个短语占据主语位置',prep:'用介词及其宾语补充说明时间、地点或其他背景',subjClause:'用一个从句整体充当主语，再对它作出判断',
  relative:'引入一层修饰，帮助读者识别或了解前面的对象',omitRelative:'关系词留空，前面的名词补进从句里可充当宾语',nonrestrict:'在已经确定的对象后补充额外说明',
  content:'把一个完整命题作为动词或名词所涉及的内容',predClause:'放在系动词后，说明主语的具体内容',
  adverb:'给另一个动作或判断补充原因、时间等背景',time:'交代主句动作发生的时间',condition:'限定主句判断成立所需的条件',result:'交代前面所说的程度或情况造成的结果',
  concession:'先承认一个事实，再转向仍然成立的判断',place:'补充动作或状态发生的地点',manner:'补充动作进行的方式',
  infinitive:'用不定式引出一个动作，补充前面词语的意思',purpose:'交代做前面那件事想达到的目的',reasonInf:'交代产生这种感受的原因',subjectComp:'补充说明主语被认为或被发现具有的动作或状态',
  participle:'用分词补充动作或状态，与句中其他成分相联系',partAttr:'用分词短语修饰名词，说明它的动作或状态',passiveIng:'表示某事正在发生，所描述的对象承受这个动作',resultIng:'用分词短语交代前面事件带来的结果',formalIt:'用 it 先占主语位置，具体内容在后面补出',
  coord:'把两个或更多处在同一层次的成分连起来',imperative:'前一部分提出动作，后一部分给出这样做的结果',
  apposition:'换一种说法解释前面提到的对象或内容',insertion:'暂时打断主线，补上一句说明，随后接回原句',
  comparison:'以一个数量为基准，说明另一个数量是它的几倍',compareClause:'给前面的比较提供参照对象或标准',ellipsis:'借用上下文补出省去的成分，再理解整个结构',
  phrase:'把几个词合起来，当作一个搭配理解',beTo:'通过 be 与不定式构成的结构表达安排、要求或预期',doubleObj:'在动词后同时交代接受者和被给予的事物',nominal:'用名词来表达一个动作或过程',pointAs:'把 A 指认为 B，用后项说明前项的身份或作用',source:'交代观点出现的出处'
};
function makeRoleQuestion(d,st){
  const family=exerciseFamily(st);
  let answer=structuralRoles[family];
  if(st.span.toLowerCase()==='as' && st.label==='结构解析')answer='引出原因，说明主句判断的依据';
  // For relative clauses with explicit, manually mapped antecedents, ask for the actual connection.
  if(d.subj && st.type==='attr' && st.anchorR){
    const noun=d.text.slice(...st.anchorR);
    const others=[...new Set(d.steps.flatMap(s=>s.anchorR?[d.text.slice(...s.anchorR)]:[]).concat(d.subjR.map(r=>d.text.slice(...r))))].filter(v=>v.toLowerCase()!==noun.toLowerCase());
    if(others.length>=2)return {lead:d.personal?'结构辨析':'结构辨析',prompt:'高亮的从句在这里修饰哪个词？',quote:markSpan(d,st),answer:noun,options:permute([noun,...others.slice(0,2)]),note:st.note};
  }
  const clusters={relative:'attr',nonrestrict:'attr',omitRelative:'attr',partAttr:'attr',content:'noun',predClause:'noun',adverb:'adv',time:'adv',condition:'adv',concession:'adv',manner:'adv',place:'adv',purpose:'adv',reasonInf:'adv',result:'adv',resultIng:'adv',apposition:'appos',insertion:'appos',comparison:'comp',compareClause:'comp'};
  const distractors=['condition','doubleObj','comparison','relative','coord','formalIt','apposition'].filter(k=>k!==family && (clusters[k]||k)!==(clusters[family]||family));
  const options=permute([answer,...permute(distractors).slice(0,2).map(k=>structuralRoles[k])]);
  return {lead:d.personal?'结构辨析':'结构辨析',prompt:'联系整句看，高亮部分在这里起什么作用？',quote:markSpan(d,st),answer,options,note:st.note};
}
function markSpan(d,st){
  const [a,b]=st.r;
  return esc(d.text.slice(0,a))+'<mark>'+esc(d.text.slice(a,b))+'</mark>'+esc(d.text.slice(b));
}

function transferQuestions(step) {
  const family=exerciseFamily(step), rows=permute(exerciseRows.filter(r=>r[0]===family)).slice(0,2);
  return rows.map(([,quote,prompt,answer,b,c,note])=>({lead:'同类迁移 · 原创练习',quote:esc(quote),prompt,answer,options:permute([answer,b,c]),note:esc(note)}));
}
function drillHome(){
  drill=null;setTabs('drill');
  const d=DATA[state.idx];
  if(d.personal && !d.steps.length){screen('本句专项攻克','<p>在「校订解析」中添加一个结构片段，即可练习这个知识点。</p>'+action('校订解析','personalEdit'));displayDialog();return;}
  screen('本句专项攻克','<p class="subtle">'+d.src+'</p><h3>想练哪个知识点？</h3><ul class="saved-list">'+d.steps.map((st,i)=>st.uncertainty?'<li><strong>'+esc(st.span)+'</strong><p>待核对：'+esc(st.uncertainty)+'</p></li>':'<li><button class="source-link" data-act="startDrill" data-value="'+i+'"><strong>'+esc(st.label)+'</strong><span lang="en">'+esc(st.span)+'</span></button></li>').join('')+'</ul>');
  displayDialog();
}
function startDrill(k){
  setTabs(null);
  const d=DATA[state.idx],st=d.steps[k];
  if(!st||st.uncertainty){drillHome();return;}
  drill={step:k,questions:[makeRoleQuestion(d,st),makeSourceQuestion(d,st),...transferQuestions(st)],at:0,answers:[]};drillPage();
}
function drillPage(){
  const {questions,at,answers,step}=drill, q=questions[at], picked=answers[at], st=DATA[state.idx].steps[step];
  screen('专项攻克 · '+st.label,'<div class="subtle">第 '+(at+1)+' / '+questions.length+' 题 · '+q.lead+'</div><div class="learn-quote" lang="en">'+q.quote+'</div><h3>'+esc(q.prompt)+'</h3><div class="choice-list">'+q.options.map((w,j)=>{
    const showed=picked!==undefined, correct=showed&&w===q.answer, wrong=showed&&j===picked&&!correct;
    return action((correct?'✓ ':wrong?'× ':'')+w,'answer',j,'answer-btn'+(correct?' correct':wrong?' wrong':''),showed?'disabled':'');
  }).join('')+'</div>'+(picked===undefined?'':'<div class="feedback" role="status"><strong>'+(q.options[picked]===q.answer?'答对了':'正确答案是 '+esc(q.answer))+'</strong><p>'+q.note+'</p></div>'+
    action(at===questions.length-1?'查看本轮结果':'下一题','nextQ','','primary-act'))+' '+action('更换知识点','drillHome','','text-act'));
}
function drillResult(){
  const wrong=drill.questions.filter((q,i)=>q.options[drill.answers[i]]!==q.answer);
  screen('专项练习结果','<h3>答对 '+(drill.questions.length-wrong.length)+' / '+drill.questions.length+' 题</h3><p>'+esc(DATA[state.idx].steps[drill.step].label)+'</p><div class="learn-row">'+(wrong.length?action('重练错题','retry','','primary-act'):'')+action('练本句其他知识点','drillHome')+action('回到精读','close')+'</div>');
}
function masteredIds(){
  return [...state.mastered].map(recordIndex).filter(i=>Number.isInteger(i)&&DATA[i]).reverse();
}
function reviewHome(){
  const ids=masteredIds();
  screen('学习手册','<h3>已掌握的句子 · '+ids.length+'</h3>'+(ids.length?'<p class="subtle">复习时先看英文，想好主干和句意，再翻开参考答案。</p>'+action('开始复习','reviewStart','','primary-act')+'<ul class="saved-list">'+ids.slice(0,listLimit).map(i=>'<li><button class="source-link" data-act="reviewAt" data-value="'+i+'"><strong>'+DATA[i].src+'</strong><span lang="en">'+esc(DATA[i].text)+'</span></button></li>').join('')+'</ul>'+(ids.length>listLimit?action('显示更多句子','moreReview'):''):'<p class="empty-note">精读时点「标记掌握」，就能在这里找到原句并重新自测。</p>'));
}
function startReview(i){
  const ids=masteredIds(), start=ids.indexOf(i);
  if(!ids.length){reviewHome();return;}
  const order=start>0?[...ids.slice(start),...ids.slice(0,start)]:ids;
  review={order,at:0,again:0,shown:false};setTabs(null);reviewCard();
}
function reviewCard(){
  const r=review,i=r.order[r.at],d=DATA[i];
  const core=rs=>rs.map(range=>d.text.slice(...range)).join(' / ');
  screen('已掌握复习','<div class="subtle">第 '+(r.at+1)+' / '+r.order.length+' 句 · '+d.src+'</div><div class="learn-quote" lang="en">'+esc(d.text)+'</div>'+
  (r.shown?'<div class="review-key"><p><b>主语核心</b>　'+esc(core(d.subjR))+'<br><b>谓语</b>　'+esc(core(d.predR))+'</p><p>'+esc(d.trans||state.notes[recordKey(i)]||'尚未填写译文')+'</p></div><div class="learn-row">'+action('还需再练','grade','again')+action('记得，下一句','grade','ok','primary-act')+'</div><p class="subtle">选「还需再练」会把这句移回未掌握。</p>':'<p>这句话的主语和谓语是什么？试着说出整句意思。</p>'+action('看主干和译文','flip','','primary-act'))+
  '<div class="learn-row">'+action('回原句精读','origin',i,'text-act')+action('返回已掌握列表','tab','review','text-act')+'</div>');
}
function gradeReview(again){
  if(!review||!review.shown)return;
  if(again){state.mastered.delete(recordKey(review.order[review.at]));storage.setItem(LS('mastered'),JSON.stringify([...state.mastered]));applyFilters();review.again++;}
  review.at++;review.shown=false;
  if(review.at<review.order.length){reviewCard();return;}
  screen('本轮复习完成','<h3>复习了 '+review.order.length+' 句</h3><p>仍记得 '+(review.order.length-review.again)+' 句，移回未掌握 '+review.again+' 句。</p>'+action('返回已掌握列表','tab','review','primary-act'));
  review=null;
}
content.addEventListener('change',e=>{
  const k=e.target.dataset.year;
  if(k){criteria[k]=Number(e.target.value);saveCriteria();content.querySelector('[data-year="'+k+'"]')?.focus({preventScroll:true});}
});
content.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const a=b.dataset.act,v=b.dataset.value,n=Number(v);
  switch(a){
    case 'personalEdit':personalEditor(DATA[state.idx]);break;
    case 'tab':openHub(v);break;
    case 'criterion':{
      const [k,value]=v.split('|');criteria[k]=value;saveCriteria();
      [...content.querySelectorAll('[data-act=criterion]')].find(btn=>btn.dataset.value===v)?.focus({preventScroll:true});break;
    }
    case 'draw':launchDraw();break;
    case 'token':{
      if(!pendingEnd){selected=[n,n];pendingEnd=true;}else{selected=[Math.min(selected[0],n),Math.max(selected[0],n)];pendingEnd=false;}
      $('pickStatus').textContent='';pickerSelection();break;
    }
    case 'keep':{
      const w=selectionInfo();if(!w)break;
      putPhrase(state.idx,w,$('pickGloss').value.trim());pendingEnd=false;pickerSelection(false);$('pickStatus').textContent='已保存到词组本。';break;
    }
    case 'edit':{
      const p=saved[n];
      screen('词组笔记','<div class="learn-quote" lang="en">'+esc(p.word)+'</div><label class="pick-gloss">释义或笔记<input id="editGloss" maxlength="500" value="'+esc(p.gloss)+'"></label>'+action('保存笔记','saveEdit',n,'primary-act')+' '+action('返回词组本','tab','vocab'));setTabs(null);break;
    }
    case 'saveEdit':{const p=saved[n];putPhrase(p.i,p.word,$('editGloss').value.trim());openHub('vocab');break;}
    case 'forget':forgetPhrase(saved[n].key);vocabPage();break;
    case 'moreVocab':{const offset=content.scrollTop;listLimit+=32;vocabPage();content.scrollTop=offset;break;}
    case 'origin':closeLearning();jumpReader(n);break;
    case 'drillHome':drillHome();break;
    case 'startDrill':startDrill(n);break;
    case 'answer':{
      if(drill.answers[drill.at]!==undefined)break;drill.answers[drill.at]=n;drillPage();content.querySelector('[data-act=nextQ]')?.focus({preventScroll:true});break;
    }
    case 'nextQ':if(drill.at+1<drill.questions.length){drill.at++;drillPage();}else drillResult();break;
    case 'retry':drill.questions=drill.questions.filter((q,i)=>q.options[drill.answers[i]]!==q.answer).map(q=>({...q,options:permute(q.options)}));drill.at=0;drill.answers=[];drillPage();break;
    case 'moreReview':{const offset=content.scrollTop;listLimit+=32;reviewHome();content.scrollTop=offset;break;}
    case 'reviewStart':startReview();break;
    case 'reviewAt':startReview(n);break;
    case 'flip':review.shown=true;reviewCard();break;
    case 'grade':gradeReview(v==='again');break;
    case 'close':closeLearning();break;
  }
});

$('examTracks').onclick=event=>{
  const btn=event.target.closest('button[data-track]');
  if(!btn)return;
  const track=btn.dataset.track;
  if(examTrack(DATA[state.idx])===track && visible().length) return;
  storage.setItem(LS('last-'+examTrack(DATA[state.idx])),state.idx);
  const value=storage.getItem(LS('last-'+track)), remembered=value===null ? -1:Number(value);
  const i=Number.isInteger(remembered)&&DATA[remembered]&&examTrack(DATA[remembered])===track ? remembered : DATA.findIndex(s=>examTrack(s)===track);
  if(i>=0)jumpReader(i);
};
initPersonalUI();
configureLayout();applyFont();themeLabel();

renderAll();
