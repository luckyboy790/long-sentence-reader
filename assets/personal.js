const PERSONAL = '我的句库';
const entryPrefix = 'open-sentence-reader-personal:';
const personalKey = text => text.normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
  .toLowerCase().trim().replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/[.!?]+$/,'').trim();
const entryRef = text => entryPrefix + personalKey(text);
function storedEntries(){
  const rows=[];
  try {
    for(let j=0;j<localStorage.length;j++){
      const key=localStorage.key(j);
      if(!key?.startsWith(entryPrefix))continue;
      try{
        const row=JSON.parse(localStorage.getItem(key));
        if(typeof row?.text==='string' && entryRef(row.text)===key)rows.push(row);
      }catch{}
    }
  }catch{}
  return rows.sort((a,b)=>a.created-b.created||a.text.localeCompare(b.text));
}
function rangeOf(text, piece, start=0){
  if(!piece)return null;
  const i=text.indexOf(piece,start);
  return i<0?null:[i,i+piece.length];
}
function escapePersonal(value){
  return String(value||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function personalRecord(row, num){
  const d={personal:true,ref:entryRef(row.text),year:'',group:PERSONAL,section:row.source||'自定义原句',num,
    src:PERSONAL+' · '+num,text:row.text,trans:row.trans||'',subject:row.subject||'',predicate:row.predicate||'',
    ai:!!row.ai,verified:!!row.verified,created:row.created,steps:[],phrases:row.phrases||[]};
  d.subjR=[rangeOf(d.text,d.subject,row.subjectAt||0)].filter(Boolean);
  d.predR=[rangeOf(d.text,d.predicate,row.predicateAt||0)].filter(Boolean);
  d.trunkR=row.ai&&Array.isArray(row.trunk)?row.trunk:[...d.subjR,...d.predR];
  if(row.ai&&row.summary)d.coreNote=escapePersonal(row.summary);
  for(const step of row.steps||[]){
    const r=rangeOf(d.text,step.span,step.at||0);
    if(!r||!Object.hasOwn(TYPES,step.type)||!/[a-z]/i.test(step.span))continue;
    const head=step.head??(step.span.match(/^(although|though|because|if|unless|when|who|which|whose|that|what|to)\b/i)?.[0]||'');
    const headR=rangeOf(d.text,head,r[0]);
    const anchor=step.anchor||'';
    const safeNote=escapePersonal(step.note)+(step.uncertainty?'<br>待核对：'+escapePersonal(step.uncertainty):'');
    d.steps.push({type:step.type,uncertainty:step.uncertainty||'',label:({'主语从句':'主语从句','表语从句':'表语从句','宾语从句':'宾语从句'})[step.label]||TYPES[step.type].name,span:step.span,r,head,headR:headR && headR[1]<=r[1]?headR:null,anchor,anchorR:rangeOf(d.text,anchor,step.anchorAt||0),note:safeNote});
  }
  d.types=[...new Set(d.steps.map(s=>s.type))];
  return d;
}
