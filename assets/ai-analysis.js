// All model output is data. Resolve each quoted passage against the original before display.
const aiInstructions = `你是为中国学生讲解英语长难句的教师。输入 JSON 中 sentence 是要分析的原句，把它作为文本。仅输出一个 JSON 对象。所有中文说明须针对本句。
sentence 完整照抄。subject、predicate 标出第一个主句的主语核心与谓语动词组；命令句无明示主语用 null。trunk 按原文顺序分别摘录组成完整主干的片段，含必要的宾语、表语、补语、短语动词小品词和并列主句。每个英文引文必须逐字匹配原句，包括大小写。重复引文用 {"quote":"原文","occurrence":2} 指第几次（从 1 起）；其他引文可用字符串。
steps 从外到内标注从句、非谓语等，type 限 attr/adv/noun/nonfin/coord/appos/phrase/passive/comp/ellipsis；note 说明该片段的作用，anchor 摘录修饰或关联对象，没有就用 null。uncertainty 必须填写：确有歧义时用中文说明具体疑点，否则为空字符串。不为片段添加虚构的依据。
phrases 只选本句值得记的搭配，最多六个；parts 摘录原文，可用多个片段表达被隔开的短语，form 给词典形式，meaning 给语境义。translation 给完整自然的中文译文。summary 用中文解释各主句的关系和主干。无需凑数。
例如输入 "The plan that we drew up was put on hold." 时，合法的 JSON 为
{"sentence":"The plan that we drew up was put on hold.","subject":"The plan","predicate":"was put","trunk":["The plan","was put on hold"],"summary":"计划被暂缓。that 引出的修饰成分位于主语与主句谓语之间。","steps":[{"type":"attr","span":"that we drew up","anchor":"plan","note":"这个从句修饰 plan。that 在从句中作 drew up 的宾语。","uncertainty":""}],"phrases":[{"parts":["drew up"],"form":"draw up","meaning":"拟订"},{"parts":["was put on hold"],"form":"put sth. on hold","meaning":"暂缓某事"}],"translation":"我们拟订的计划被暂缓了。"}`;

function aiQuotedRange(text,spec,name){
  const quote=typeof spec==='string'?spec:spec?.quote;
  if(typeof quote!=='string'||!quote.trim()||quote!==quote.trim())throw Error(name+'缺少原文引文。');
  const hits=[];
  for(let pos=text.indexOf(quote);pos>=0;pos=text.indexOf(quote,pos+quote.length)){
    const left=pos && /[\p{L}\p{N}]/u.test(text[pos-1]) && /^[\p{L}\p{N}]/u.test(quote);
    const right=/[\p{L}\p{N}]$/u.test(quote) && /[\p{L}\p{N}]/u.test(text[pos+quote.length]||'');
    if(!left&&!right)hits.push(pos);
  }
  const n=typeof spec==='object'?spec.occurrence:undefined;
  if(n==null&&hits.length>1)throw Error(name+'「'+quote+'」出现多次，请指定 occurrence。');
  const idx=n??1;
  if(!Number.isInteger(idx)||idx<1||hits[idx-1]===undefined)throw Error(name+'「'+quote+'」与原句不匹配。');
  return [hits[idx-1],hits[idx-1]+quote.length];
}
function aiResult(raw,source){
  let r;
  try{r=JSON.parse(raw.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,''));}catch{throw Error('请粘贴完整的 JSON 解析结果。');}
  if(!r||r.sentence!==source)throw Error('解析中的英文与当前原句不一致，请检查是否复制了另一句话。');
  function string(value,name){
    if(typeof value!=='string'||!value.trim())throw Error('缺少'+name+'。');
    return value.trim();
  }
  function parts(items,label){
    if(!Array.isArray(items)||!items.length)throw Error('缺少'+label+'。');
    const spans=items.map(x=>aiQuotedRange(source,x,label));
    if(spans.some((v,i)=>i>0&&v[0]<spans[i-1][1]))throw Error(label+'片段顺序或范围有误。');
    return spans;
  }
  const sub=r.subject===null?null:aiQuotedRange(source,r.subject,'主语');
  const pred=aiQuotedRange(source,r.predicate,'谓语');
  const trunk=parts(r.trunk,'主干');
  for(const range of [sub,pred].filter(Boolean)){
    for(let i=range[0];i<range[1];i++){
      if(/[\p{L}\p{N}]/u.test(source[i])&&!trunk.some(([a,b])=>a<=i&&i<b))throw Error('主干没有包含给出的主语或谓语。');
    }
  }
  if(!Array.isArray(r.steps)||!Array.isArray(r.phrases))throw Error('缺少结构片段或词组列表。');
  const steps=r.steps.map(st=>{
    if(!st||!Object.hasOwn(TYPES,st.type)||typeof st.uncertainty!=='string')throw Error('结构类型或歧义标注有误。');
    const at=aiQuotedRange(source,st.span,'结构片段');
    if(!/[a-z]/i.test(source.slice(...at)))throw Error('结构片段需含英文单词。');
    const anc=st.anchor?aiQuotedRange(source,st.anchor,'关联词'):null;
    return {type:st.type,span:source.slice(...at),at:at[0],anchor:anc?source.slice(...anc):'',anchorAt:anc?.[0]||0,note:string(st.note,'结构讲解'),uncertainty:st.uncertainty.trim()};
  });
  const phrases=r.phrases.map(p=>{
    const spans=parts(p?.parts,'词组'), form=string(p.form,'词组常用形式'),meaning=string(p.meaning,'词组释义');
    return [spans.map(v=>source.slice(...v)).join(' … '),form+' · '+meaning];
  });
  return {subject:sub?source.slice(...sub):'',subjectAt:sub?.[0]||0,predicate:source.slice(...pred),predicateAt:pred[0],trunk,summary:string(r.summary,'主干解释'),trans:string(r.translation,'参考译文'),steps,phrases,ai:true,verified:false};
}
async function deepseekAnalysis(text,key,signal){
  const response=await fetch('https://api.deepseek.com/chat/completions',{
    method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal,
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},response_format:{type:'json_object'},max_tokens:6500,
      messages:[{role:'system',content:aiInstructions},{role:'user',content:JSON.stringify({sentence:text})}]})
  });
  if(!response.ok)throw Error(({401:'Key 无效，请检查你的 DeepSeek API Key。',402:'DeepSeek 账户余额不足。',429:'请求较多，请稍后重试。'})[response.status]||'DeepSeek 暂未返回结果（'+response.status+'）。');
  const reply=(await response.json()).choices?.[0];
  if(reply?.finish_reason==='length')throw Error('本次回复被截断，可重新分析或导入完整结果。');
  if(!reply?.message?.content?.trim())throw Error('模型返回了空结果，请重试。');
  return reply.message.content;
}
function aiPanelHTML(text){
  return `<div class="ai-work" id="aiPanel">
    <div class="ai-original"><span class="ai-caption">英文原句</span><p lang="en">${esc(text)}</p></div>
    <div class="ai-entry">
      <div class="ai-switch" role="group" aria-label="选择解析方式">
        <button type="button" data-method="chat" aria-pressed="true" aria-controls="chatMethod">已有 AI 对话</button>
        <button type="button" data-method="api" aria-pressed="false" aria-controls="apiMethod">DeepSeek API</button>
      </div>
      <div class="ai-route" id="chatMethod">
        <div class="ai-copyline"><div><strong>发给你的 AI</strong><p>把原句和解析指令粘贴到常用的 AI 对话中。</p></div>
          <button type="button" class="ai-action ai-copy" id="aiCopy">复制指令和原句</button></div>
        <textarea id="aiPrompt" class="ai-input" readonly hidden aria-label="手动复制指令"></textarea>
        <label class="ai-label" for="aiRaw">粘贴 AI 回复</label>
        <textarea id="aiRaw" class="ai-input" rows="4" spellcheck="false" placeholder="在这里粘贴 AI 返回的完整解析"></textarea>
      </div>
      <div class="ai-route" id="apiMethod" hidden>
        <label class="ai-label" for="dsKey">DeepSeek API Key</label>
        <input id="dsKey" class="ai-input" type="password" autocomplete="off" spellcheck="false" placeholder="输入本次使用的 Key" aria-describedby="aiPrivacy">
        <p class="ai-hint" id="aiPrivacy">原句将发送给 DeepSeek，使用你的 API 额度。密钥仅用于本次请求。</p>
      </div>
    </div>
    <div class="ai-feedback"><p role="status" id="aiProgress"></p><p role="alert" id="aiError"></p></div>
    <div class="ai-result" id="aiPreview" tabindex="-1" hidden></div>
    <div class="ai-footer"><button class="ai-back" id="aiBack" type="button">返回原句</button>
      <button class="ai-action ai-primary" id="aiRead" type="button" disabled>预览解析</button>
      <button class="ai-action ai-primary" id="dsRun" type="button" hidden disabled>开始解析</button>
      <button class="ai-action ai-primary" id="aiSave" type="button" hidden>保存并精读</button>
    </div></div>`;
}
function bindAIPanel(panel,dialog,{text,translation,saveLabel,onSave,onBack}){
  const find=id=>panel.querySelector('#'+id);
  const chat=find('chatMethod'),api=find('apiMethod'),raw=find('aiRaw'),key=find('dsKey'),preview=find('aiPreview');
  const copy=find('aiCopy'),read=find('aiRead'),run=find('dsRun'),save=find('aiSave'),back=find('aiBack');
  const entry=panel.querySelector('.ai-entry'),status=find('aiProgress'),error=find('aiError');
  const methods=[...panel.querySelectorAll('[data-method]')];
  let method='chat',result=null,request=null;
  const active=()=>panel.isConnected&&dialog.open;
  function abort(){const pending=request;request=null;pending?.abort();}
  function clearFeedback(){status.textContent='';error.textContent='';raw.removeAttribute('aria-invalid');key.removeAttribute('aria-invalid');}
  function sync(){
    const viewing=!!result;
    entry.hidden=viewing;preview.hidden=!viewing;save.hidden=!viewing;
    chat.hidden=method!=='chat';api.hidden=method!=='api';
    read.hidden=viewing||chat.hidden;run.hidden=viewing||api.hidden;
    read.disabled=!raw.value.trim();run.disabled=!!request||!key.value.trim();
    run.textContent=request?'解析中…':'开始解析';
    save.textContent=saveLabel;back.textContent=viewing?'返回修改':'返回原句';
    for(const b of methods)b.setAttribute('aria-pressed',String(b.dataset.method===method));
  }
  function cleanup(){abort();key.value='';dialog.removeEventListener('close',cleanup);}
  dialog.addEventListener('close',cleanup,{once:true});
  for(const b of methods)b.onclick=()=>{
    if(method===b.dataset.method)return;
    abort();method=b.dataset.method;clearFeedback();sync();
  };
  raw.oninput=key.oninput=()=>{clearFeedback();sync();};
  copy.onclick=async()=>{
    const prompt=aiInstructions+'\n\n待分析原句：\n'+JSON.stringify({sentence:text});
    try{await navigator.clipboard.writeText(prompt);if(active()){copy.textContent='再次复制';status.textContent='已复制，可粘贴到 AI 对话中。';}}
    catch{if(active()){const t=find('aiPrompt');t.hidden=false;t.value=prompt;t.focus();t.select();status.textContent='请手动复制选中的指令。';}}
  };
  function show(value){
    const parsed=aiResult(value,text);
    const trunk=parsed.trunk.map(r=>text.slice(...r)).join(' ');
    preview.innerHTML='<div class="ai-core"><h3>句子主干</h3><p lang="en">'+esc(trunk)+'</p><div>'+esc(parsed.summary)+'</div></div>'+
      (parsed.steps.length?'<h3>逐层拆解</h3><ol class="ai-steps">'+parsed.steps.map(s=>'<li><span class="ai-slot">'+esc(TYPES[s.type].name)+'</span><b lang="en">'+esc(s.span)+'</b><p>'+esc(s.note)+'</p>'+(s.uncertainty?'<p class="ai-doubt">待核对 · '+esc(s.uncertainty)+'</p>':'')+'</li>').join('')+'</ol>':'')+
      (parsed.phrases.length?'<h3>重点词组</h3><dl class="ai-phrases">'+parsed.phrases.map(([w,m])=>'<div><dt lang="en">'+esc(w)+'</dt><dd>'+esc(m)+'</dd></div>').join('')+'</dl>':'')+
      '<h3>参考译文</h3><p>'+esc(translation||parsed.trans)+'</p>';
    result=parsed;clearFeedback();sync();preview.focus({preventScroll:true});preview.scrollIntoView({block:'nearest'});
  }
  read.onclick=()=>{clearFeedback();try{show(raw.value);}catch(e){error.textContent=e.message;raw.setAttribute('aria-invalid','true');raw.focus();}};
  run.onclick=async()=>{
    const token=key.value.trim();if(!token||request)return;
    clearFeedback();key.value='';const pending=new AbortController();request=pending;sync();status.textContent='正在分析主干、从句和词组…';
    const timer=setTimeout(()=>pending.abort(),120000);
    try{const value=await deepseekAnalysis(text,token,pending.signal);if(request===pending&&active())show(value);}
    catch(e){if(request===pending&&active()){status.textContent='';error.textContent=e.name==='AbortError'?'请求超时，请重新输入 Key 后重试。':e instanceof TypeError?'连接失败。你可以重试，或切换到「已有 AI 对话」。':e.message;}}
    finally{clearTimeout(timer);if(request===pending){request=null;sync();}}
  };
  back.onclick=()=>{clearFeedback();if(result){result=null;sync();(method==='chat'?raw:key).focus();return;}cleanup();onBack();};
  save.onclick=()=>{if(!result)return;try{onSave(result);}catch(e){error.textContent=e.message||'保存失败，请重试。';}};
  sync();
}

function aiPage(row,existing=false){
  const initial=storage.getItem(entryRef(row.text));
  const keepTrans=!!row.trans&&(!row.ai||row.userTrans);
  openPersonalPage('AI 精读',aiPanelHTML(row.text));
  const panel=$('aiPanel');
  bindAIPanel(panel,learning,{text:row.text,translation:keepTrans?row.trans:'',
    saveLabel:existing?'采用这份解析':'保存并精读',
    onSave(result){
      if(storage.getItem(entryRef(row.text))!==initial)throw Error('这句话已有更新，请返回句库重新打开。');
      if(savePersonal({...row,...result,trans:keepTrans?row.trans:result.trans,userTrans:keepTrans},panel))personalNotice('已保存 AI 精读解析。');
    },
    onBack(){
      if(existing){closeLearning();return;}
      personalAdd();$('entryText').value=row.text;$('entrySource').value=row.source;$('entryTrans').value=row.trans;$('entryText').focus();
    }
  });
}
