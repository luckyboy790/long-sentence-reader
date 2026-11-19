function openPersonalPage(name,html){
  if(catalog.open)catalog.close();
  setTabs(null);screen(name,html);displayDialog();
}
let toastTimer;
function personalNotice(message){
  const box=$('personalToast');box.textContent=message;box.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,3200);
}
function syncPersonalRecords(){
  for(const row of storedEntries()){
    const idx=recordIndex(entryRef(row.text));
    if(idx<0)DATA.push(personalRecord(row,DATA.length-builtinCount+1));
    else DATA[idx]=personalRecord(row,DATA[idx].num);
  }
}
function savePersonal(row,form){
  try{localStorage.setItem(entryRef(row.text),JSON.stringify(row));}
  catch{form.querySelector('[role=alert]').textContent='当前浏览器无法保存。请检查本机存储空间或浏览器设置。';return false;}
  syncPersonalRecords();closeLearning();jumpReader(recordIndex(entryRef(row.text)));return true;
}
function personalList(){
  syncPersonalRecords();
  const rows=DATA.slice(builtinCount).map((d,j)=>({d,i:builtinCount+j})).sort((a,b)=>b.d.created-a.d.created);
  openPersonalPage('我的句库','<div class="learn-row"><button class="primary-act" id="newFromList">＋ 添加新句</button><span class="subtle">'+rows.length+' 句 · 保存在当前浏览器</span></div>'+
    (rows.length?'<ul class="saved-list">'+rows.map(({d,i})=>'<li><button class="source-link" data-act="origin" data-value="'+i+'"><strong>'+esc(d.section)+'</strong><span lang="en">'+esc(d.text)+'</span></button></li>').join('')+'</ul>':'<p>把你在外刊、课本或阅读题里遇到的长难句放在这里。</p>'));
  $('newFromList').onclick=personalAdd;
}
function personalAdd(){
  openPersonalPage('添加新长难句','<form class="personal-form" id="personalForm"><label>英文原句<textarea id="entryText" required lang="en" placeholder="粘贴你在别处看到的一句英文"></textarea></label><label>来源（选填）<input id="entrySource" placeholder="书名、文章标题或页码"></label><label>参考译文（选填）<textarea id="entryTrans" placeholder="可以稍后补充"></textarea></label><p role="alert"></p><div class="learn-row"><button type="submit" id="newAI" class="primary-act">AI 分析并精读</button><button type="button" class="secondary-act" id="backPersonal">我的句库</button></div></form>');
  offerTranslation($('entryTrans'),()=>$('entryText')?.value||'');
  $('backPersonal').onclick=personalList;
  $('personalForm').onsubmit=e=>{
    e.preventDefault();
    const text=$('entryText').value.trim().replace(/\s+/gu,' '), form=$('personalForm');
    if(!/[A-Za-z]/.test(text)){form.querySelector('[role=alert]').textContent='请粘贴含英文单词的原句。';return;}
    syncPersonalRecords();
    const key=personalKey(text),idx=DATA.findIndex(d=>personalKey(d.text)===key);
    if(idx>=0){closeLearning();jumpReader(idx);personalNotice('这句话已在'+(DATA[idx].personal?'我的句库':'示例句库')+'，已打开原句。');return;}
    const row={text,source:$('entrySource').value.trim(),trans:$('entryTrans').value.trim(),created:Date.now()};
    aiPage(row);
  };
}
function renderPersonalTools(d){
  $('personalTools').hidden=!d.personal;
  $('analysisStatus').textContent=d.personal?((d.section==='自定义原句'?'':d.section+' · ')+(d.verified?'已校订':d.ai?'AI 解析':'规则拆解草稿')):'';
  document.querySelector('.reading-tools .reader-label').textContent=d.personal?'自定义原句':'原创例句';
  $('addTranslation').hidden=!d.personal||!!d.trans;
  $('trans').hidden=!!d.personal&&!d.trans;
}
function personalEditor(d,focusTranslation=false){
  if(!d.personal)return;
  let row;
  try{row=JSON.parse(localStorage.getItem(d.ref));}catch{}
  if(!row){personalNotice('无法读取这句话，请重新打开句库。');return;}
  openPersonalPage('校订解析','<form id="analysisForm" class="personal-form"><blockquote lang="en">'+esc(row.text)+'</blockquote><p class="subtle">主语、谓语和结构片段均可从原句复制。重复出现的词可以选择位置。</p><label>主语<input id="editSubject"></label><label>谓语<input id="editPredicate"></label><div id="editSteps"></div><div><button type="button" id="moreStep">＋ 结构片段</button></div><label>参考译文<textarea id="editTrans"></textarea></label><p role="alert"></p><div class="learn-row"><button class="primary-act">保存校订</button><button type="button" class="secondary-act" id="cancelEdit">取消</button></div></form>');
  const ranges=[];
  function field(input,value,offset){
    input.value=value||'';
    const select=document.createElement('select');
    select.setAttribute('aria-label','片段在原句中的位置');input.after(select);
    function options(at){
      const part=input.value.trim(),found=[];
      if(part)for(let i=row.text.indexOf(part);i>=0;i=row.text.indexOf(part,i+part.length))found.push(i);
      select.replaceChildren(...found.map((start,i)=>new Option('第 '+(i+1)+' 处 · …'+row.text.slice(Math.max(0,start-12),start+part.length+12)+'…',start)));
      if(found.includes(at))select.value=String(at);
      select.hidden=found.length<=1;
      input.setCustomValidity(part && !found.length?'请复制与原句完全相同的片段。':'');
      if(!part)input.setCustomValidity('');
    }
    input.oninput=()=>options(-1);options(offset);
    return ()=>Number(select.value);
  }
  const subj=field($('editSubject'),row.subject,row.subjectAt);
  const pred=field($('editPredicate'),row.predicate,row.predicateAt);
  $('editTrans').value=row.trans||'';
  offerTranslation($('editTrans'),()=>row.text);
  function addStep(item={}){
    const el=document.createElement('fieldset');el.innerHTML='<legend>结构片段</legend><label>原文片段<input required lang="en"></label><label>结构类型<select class="type"></select></label><label>关联词或被修饰词（选填）<input class="anchor" lang="en"></label><label>讲解<textarea></textarea></label><div><button type="button">移除片段</button></div>';
    const input=el.querySelector('input'),sel=el.querySelector('.type'),note=el.querySelector('textarea');
    sel.replaceChildren(...Object.entries(TYPES).map(([k,v])=>new Option(v.name,k)));sel.value=item.type||'attr';note.value=item.note||'';
    const at=field(input,item.span,item.at);
    const anchor=el.querySelector('.anchor'),anchorAt=field(anchor,item.anchor,item.anchorAt);
    let confirmation;
    if(item.uncertainty){
      const label=document.createElement('label');confirmation=document.createElement('input');confirmation.type='checkbox';
      label.append(confirmation,document.createTextNode('已核对：'+item.uncertainty));el.append(label);
    }
    el.querySelector('button').onclick=()=>el.remove();$('editSteps').append(el);
    ranges.push(()=>el.isConnected?{span:input.value.trim(),at:at(),anchor:anchor.value.trim(),anchorAt:anchorAt(),type:sel.value,uncertainty:confirmation&&!confirmation.checked?item.uncertainty:'',label:sel.value===item.type?item.label:undefined,note:note.value.trim()}:null);
    return input;
  }
  for(const item of row.steps||[])addStep(item);
  $('moreStep').onclick=()=>addStep().focus();
  $('cancelEdit').onclick=closeLearning;
  $('analysisForm').onsubmit=e=>{
    e.preventDefault();
    const steps=ranges.map(read=>read()).filter(Boolean);
    if(steps.some(step=>!/[a-z]/i.test(step.span))){e.target.querySelector('[role=alert]').textContent='结构片段需包含英文单词。';return;}
    const result={...row,subject:$('editSubject').value.trim(),subjectAt:subj(),predicate:$('editPredicate').value.trim(),predicateAt:pred(),trans:$('editTrans').value.trim(),steps,verified:true};
    if(row.ai && (result.subject!==row.subject||result.predicate!==row.predicate||result.subjectAt!==row.subjectAt||result.predicateAt!==row.predicateAt)){
      delete result.trunk;delete result.summary;
    }
    if(row.ai && result.trans!==row.trans)result.userTrans=true;
    if(savePersonal(result,e.target))personalNotice('已保存校订。');
  };
  if(focusTranslation)$('editTrans').focus();
}
function initPersonalUI(){
  $('personalList').onclick=personalList;$('personalAdd').onclick=personalAdd;
  $('runAI').onclick=()=>{
    const row=storedEntries().find(r=>entryRef(r.text)===DATA[state.idx].ref);
    if(row)aiPage(row,true);
  };
  $('editAnalysis').onclick=()=>personalEditor(DATA[state.idx]);
  $('addTranslation').onclick=()=>personalEditor(DATA[state.idx],true);
  window.addEventListener('storage',e=>{if(e.key?.startsWith(entryPrefix)){syncPersonalRecords();renderAll();}});
}

async function offerTranslation(textarea,english){
  if(!globalThis.Translator?.availability || !globalThis.Translator.create)return;
  const languages={sourceLanguage:'en',targetLanguage:'zh'};
  let availability;
  try{availability=await Translator.availability(languages);}catch{return;}
  if(!textarea.isConnected||availability==='unavailable')return;
  const button=document.createElement('button'),status=document.createElement('span');
  button.type='button';button.className='text-act';button.textContent=availability==='downloadable'?'下载语言包并翻译':'用浏览器生成参考译文';
  status.className='subtle';status.setAttribute('role','status');textarea.closest('label').after(button,status);
  button.onclick=async()=>{
    const source=english().trim(),initial=textarea.value;
    if(!source){status.textContent='请先输入英文原句。';return;}
    if(initial.trim()&&!confirm('用新生成的译文替换当前参考译文？'))return;
    let engine;
    try{
      button.disabled=true;status.textContent='正在准备翻译…';
      engine=await Translator.create({...languages,monitor(m){m.addEventListener('downloadprogress',e=>status.textContent='正在准备语言包 · '+Math.round(e.loaded*100)+'%');}});
      const translated=await engine.translate(source);
      if(textarea.isConnected&&source===english().trim()&&textarea.value===initial){textarea.value=translated;status.textContent='已生成译文草稿，可修改后保存。';}
    }catch{status.textContent='本次翻译未完成。可重试或自行填写参考译文。';}
    finally{engine?.destroy?.();button.disabled=false;}
  };
}
