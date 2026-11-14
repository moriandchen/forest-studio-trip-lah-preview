const seed = {
  version: 4,
  mode: 'Before Trip',
  lastBackup: '',
  trip: { city:'Bangkok', country:'Thailand', start:'2026-12-12', end:'2026-12-16' },
  stay: { name:'Grande Centre Point', address:'Bangkok, Thailand', checkin:'15:00', checkout:'12:00', booking:'GCP-2719' },
  budget: 3000,
  fundLedger: { transactions: [] },
  packing:[
    {id:'p1',name:'Passport',done:true},{id:'p2',name:'Wallet',done:true},{id:'p3',name:'Phone',done:true},{id:'p4',name:'Power bank',done:true},
    {id:'p5',name:'Charging cable',done:true},{id:'p6',name:'Travel adapter',done:true},{id:'p7',name:'Concert ticket',done:true},{id:'p8',name:'Hotel booking',done:true},
    {id:'p9',name:'Travel insurance',done:true},{id:'p10',name:'Medicine',done:true},{id:'p11',name:'Clothes',done:true},{id:'p12',name:'Toiletries',done:true},
    {id:'p13',name:'Umbrella',done:false},{id:'p14',name:'Extra tote bag',done:false},{id:'p15',name:'Snacks',done:false},{id:'p16',name:'Sunglasses',done:false}
  ],
  expenses:[
    {id:'e1',name:'Airport train',amount:45},{id:'e2',name:'Lunch',amount:62},{id:'e3',name:'Coffee',amount:18},{id:'e4',name:'Shopping',amount:717}
  ],
  places:[
    {id:'l1',icon:'🌸',name:'Impact Arena',category:'Must go',note:'Event'},
    {id:'l2',icon:'🛍️',name:'Siam Paragon',category:'Shopping',note:''},
    {id:'l3',icon:'☕',name:'Coffee stop',category:'Food',note:'Saved nearby'},
    {id:'l4',icon:'🍜',name:'Dinner place',category:'Food',note:''},
    {id:'l5',icon:'🛍️',name:'CentralWorld',category:'Shopping',note:''},
    {id:'l6',icon:'📷',name:'Photo spot',category:'All',note:'Saved'},
    {id:'l7',icon:'🌿',name:'Park walk',category:'All',note:'Maybe'},
    {id:'l8',icon:'🎁',name:'Souvenir shop',category:'Shopping',note:''}
  ],
  plans:[
    {id:'d1',date:'2026-12-12',time:'09:30',title:'✈ Flight to Bangkok',meta:'KUL → BKK'},
    {id:'d2',date:'2026-12-12',time:'14:00',title:'🏨 Check-in',meta:'Drop luggage first'},
    {id:'d3',date:'2026-12-12',time:'17:30',title:'📍 Siam',meta:'Dinner + quick walk'},
    {id:'d4',date:'2026-12-12',time:'20:00',title:'🌸 PP KRIT CONCERT',meta:'Ticket ready ✓'},
    {id:'d5',date:'2026-12-13',time:'10:30',title:'☕ Slow morning',meta:'Coffee nearby'},
    {id:'d6',date:'2026-12-13',time:'14:00',title:'🛍️ CentralWorld',meta:'Shopping'}
  ],
  tickets:[
    {id:'t1',type:'FLIGHT',title:'KUL → BKK',date:'2026-12-12',time:'09:30',place:'KLIA',seat:'14A',code:'FLIGHT-QL7A9',qr:''},
    {id:'t2',type:'EVENT',title:'PP KRIT CONCERT 🌸',date:'2026-12-12',time:'20:00',place:'Impact Arena',seat:'A12',code:'PPKRIT-A12-2719',qr:''},
    {id:'t3',type:'RETURN',title:'BKK → KUL',date:'2026-12-16',time:'18:45',place:'Bangkok',seat:'18F',code:'RETURN-N5K2P',qr:''}
  ],
  gohome:[
    {id:'g1',name:'Passport',done:false},{id:'g2',name:'Wallet',done:false},{id:'g3',name:'Phone',done:false},{id:'g4',name:'Charger',done:false},
    {id:'g5',name:'Power bank',done:false},{id:'g6',name:'All luggage',done:false},{id:'g7',name:'Purchases',done:false},{id:'g8',name:'Hotel room checked',done:false},{id:'g9',name:'Bathroom / wardrobe checked',done:false},{id:'g10',name:'Hotel safe checked',done:false},{id:'g11',name:'Keys / room cards returned',done:false},{id:'g12',name:'Airport transport',done:false}
  ]
};

// Trip Lah! owns a separate browser-storage namespace. One-time, non-destructive
// migration copies this preview's prior local payload into the new namespace.
const LEGACY_TRIP_LS='travelLahV1';
const LS='tripLahV1';
if(!localStorage.getItem(LS)&&localStorage.getItem(LEGACY_TRIP_LS)){
  localStorage.setItem(LS,localStorage.getItem(LEGACY_TRIP_LS));
}
const OLD_KEYS=[];
const RECOVERY_LS='tripLahV1Recovery';
const CLOUD_SESSION_LS='tripLahCloudSessionV1';
const CLOUD_META_LS='tripLahCloudMetaV1';
const SUPABASE_URL='https://kxehariqixdqmtyeezrb.supabase.co';
const SUPABASE_KEY='sb_publishable_-fTWxWaGAINGBQAePgh72A_CFr86NU7';
const HAD_LOCAL_AT_START=!!localStorage.getItem(LS);
let cloudSession=loadCloudSession();
let cloudMeta=loadCloudMeta();
let cloudRemoteSnapshot=null;
let cloudSyncTimer=null;
let data = load();
let activePlaceFilter='All';
let selectedTodayDate='';
let pendingTicketQr='';

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function uid(prefix){ return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`; }
function normalizeData(saved){
  const base=clone(seed);
  const normalizeLegacy=(source)=>{
    if(!source || ![2,3,4,5].includes(Number(source.version))) return clone(base);
    const merged={...base,...source,version:4};
    merged.trip={...base.trip,...(source.trip||{})};
    merged.stay={...base.stay,...(source.stay||{})};
    merged.fundLedger={transactions:Array.isArray(source.fundLedger?.transactions)?source.fundLedger.transactions:[]};
    for(const key of ['packing','expenses','places','plans','tickets','gohome']) if(!Array.isArray(merged[key])) merged[key]=clone(base[key]);
    if(!('lastBackup' in merged)) merged.lastBackup='';
    return merged;
  };
  if(saved && Number(saved.version)===5 && Array.isArray(saved.trips) && saved.trips.length){
    const merged={...normalizeLegacy(saved),...saved,version:5};
    merged.trips=saved.trips.map((t,i)=>({
      id:t.id||('trip_'+i),name:t.name||t.snapshot?.trip?.city||'My Trip',
      destination:t.destination||t.snapshot?.trip?.country||'',
      start:t.start||t.snapshot?.trip?.start||'',end:t.end||t.snapshot?.trip?.end||'',
      baseCurrency:t.baseCurrency||t.snapshot?.baseCurrency||'MYR',
      budget:Number(t.budget??t.snapshot?.budget??0),status:t.status||'planning',
      members:Array.isArray(t.members)?t.members:[{id:'owner',name:'You',role:'owner'}],
      currencies:Array.isArray(t.currencies)&&t.currencies.length?t.currencies:['MYR'],
      createdAt:t.createdAt||new Date().toISOString(),
      snapshot:normalizeLegacy(t.snapshot||merged)
    }));
    if(!merged.trips.some(t=>t.id===merged.activeTripId)) merged.activeTripId=merged.trips[0].id;
    const active=merged.trips.find(t=>t.id===merged.activeTripId);
    if(active){
      return {...normalizeLegacy(active.snapshot),...merged,
        trips:merged.trips,activeTripId:active.id,
        trip:{...normalizeLegacy(active.snapshot).trip},
        members:clone(active.members),currencies:clone(active.currencies),baseCurrency:active.baseCurrency};
    }
    return merged;
  }
  const legacy=normalizeLegacy(saved),id='trip_legacy',baseCurrency='MYR';
  const record={
    id,name:legacy.trip.city||'My Trip',destination:legacy.trip.country||'',
    start:legacy.trip.start||'',end:legacy.trip.end||'',baseCurrency,budget:Number(legacy.budget||0),
    status:'planning',members:[{id:'owner',name:'You',role:'owner'}],
    currencies:['MYR','THB','SGD','USD'],createdAt:new Date().toISOString(),snapshot:clone(legacy)
  };
  return {...legacy,version:5,trips:[record],activeTripId:id,members:clone(record.members),currencies:clone(record.currencies),baseCurrency};
}
function load(){
  try{
    const current=JSON.parse(localStorage.getItem(LS));
    if(current)return normalizeData(current);
    for(const key of OLD_KEYS){
      const old=JSON.parse(localStorage.getItem(key));
      if(old){const migrated=normalizeData(old);localStorage.setItem(LS,JSON.stringify(migrated));return migrated;}
    }
    return normalizeData(seed);
  }catch{return normalizeData(seed)}
}
function currentSnapshot(){const snap=clone(data);delete snap.trips;delete snap.activeTripId;return snap}
function syncActiveTripSnapshot(){
  if(!Array.isArray(data.trips))data.trips=[];
  const record=data.trips.find(t=>t.id===data.activeTripId);if(!record)return;
  record.name=data.trip.city||record.name||'My Trip';record.destination=data.trip.country||'';
  record.start=data.trip.start||'';record.end=data.trip.end||'';
  record.baseCurrency=data.baseCurrency||'MYR';record.budget=Number(data.budget||0);
  record.members=clone(Array.isArray(data.members)?data.members:[]);
  record.currencies=clone(Array.isArray(data.currencies)?data.currencies:['MYR']);
  record.snapshot=currentSnapshot();
}
function save(){
  data.version=5;syncActiveTripSnapshot();localStorage.setItem(LS,JSON.stringify(data));
  if(cloudSession){cloudMeta.dirty=true;saveCloudMeta();scheduleCloudSync();}
  render();
}
function qs(s){return document.querySelector(s)}
function qsa(s){return [...document.querySelectorAll(s)]}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){const t=qs('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1500)}
function localISO(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
function parseDate(s){return new Date(`${s}T00:00:00`)}
function fmtDate(s,opt={day:'numeric',month:'short',year:'numeric'}){if(!s)return '—';return parseDate(s).toLocaleDateString('en-GB',opt)}
function fmtRange(start,end){
  if(!start||!end)return 'Dates not set';
  const a=parseDate(start),b=parseDate(end),sameMonth=a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();
  if(sameMonth)return `${a.getDate()}–${b.getDate()} ${a.toLocaleDateString('en-GB',{month:'short'})} ${a.getFullYear()}`;
  return `${fmtDate(start,{day:'numeric',month:'short'})} – ${fmtDate(end,{day:'numeric',month:'short',year:'numeric'})}`;
}
function daysBetween(a,b){return Math.ceil((parseDate(b)-parseDate(a))/86400000)}
function greeting(){const h=new Date().getHours();return h<12?'Good morning, CEO.':h<18?'Good afternoon, CEO.':'Good evening, CEO.'}
function tripPhase(){
  const now=localISO();
  if(now<data.trip.start)return 'before';
  if(now>data.trip.end)return 'after';
  if(now===data.trip.end)return 'lastday';
  return 'travel';
}
function addDays(iso,delta){const d=parseDate(iso);d.setDate(d.getDate()+delta);return localISO(d)}
function nextTicket(){
  const now=localISO(), nowTime=new Date().toTimeString().slice(0,5);
  return data.tickets.slice().sort((a,b)=>(a.date+(a.time||'99:99')).localeCompare(b.date+(b.time||'99:99'))).find(t=>t.date>now || (t.date===now && (t.time||'23:59')>=nowTime)) || null;
}

function showView(id){
  qsa('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  qsa('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.open===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
qsa('[data-open]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.open)));
qsa('.back').forEach(b=>b.addEventListener('click',()=>showView('home')));
qsa('.dialogClose').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));

function tripDayFor(date){
  if(!data.trip.start||!data.trip.end||date<data.trip.start||date>data.trip.end)return null;
  return daysBetween(data.trip.start,date)+1;
}
function effectiveTodayDate(){
  const now=localISO();
  if(selectedTodayDate && selectedTodayDate>=data.trip.start && selectedTodayDate<=data.trip.end)return selectedTodayDate;
  if(now>=data.trip.start && now<=data.trip.end)return now;
  const dates=[...new Set(data.plans.map(p=>p.date))].filter(d=>d>=data.trip.start&&d<=data.trip.end).sort();
  if(now<data.trip.start)return dates[0]||data.trip.start;
  return data.trip.end;
}
function shiftSelectedDay(delta){
  const current=effectiveTodayDate();
  const candidate=addDays(current,delta);
  if(candidate<data.trip.start||candidate>data.trip.end)return;
  selectedTodayDate=candidate;renderToday();
}
function plansFor(date){return data.plans.filter(p=>p.date===date).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'))}
function nextPlan(){
  const now=localISO();
  const nowTime=new Date().toTimeString().slice(0,5);
  return data.plans.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).find(p=>p.date>now || (p.date===now && (p.time||'23:59')>=nowTime)) || null;
}
function renderTimeline(target, items){
  const now=localISO(), nowTime=new Date().toTimeString().slice(0,5), next=nextPlan();
  qs(target).innerHTML=items.map(p=>{
    const isPast=p.date<now || (p.date===now && p.time && p.time<nowTime);
    const isNext=next && p.id===next.id;
    return `<div class="timeline-item ${isPast?'is-past':''} ${isNext?'is-next':''}"><span class="time">${esc(p.time||'—')}</span><span class="dot"></span><div><b>${esc(p.title)}${isNext?'<em class="next-tag">NEXT</em>':''}</b><small>${esc(p.meta||'')}</small></div><button class="row-delete" data-plan-delete="${p.id}" aria-label="Delete">×</button></div>`;
  }).join('');
  qsa(`${target} [data-plan-delete]`).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();data.plans=data.plans.filter(p=>p.id!==b.dataset.planDelete);save();toast('Plan removed')}));
}
function renderPhaseAction(){
  const phase=tripPhase(), box=qs('#phaseAction');
  let open='packing',label='BEFORE TRIP',title='Finish packing',meta='';
  const packed=data.packing.filter(x=>x.done).length, packLeft=Math.max(0,data.packing.length-packed);
  if(phase==='before'){
    if(packLeft){open='packing';title='Finish packing';meta=`${packLeft} item${packLeft===1?'':'s'} left`;}
    else {open='tickets';title='Travel wallet ready';meta=`${data.tickets.length} ticket${data.tickets.length===1?'':'s'} saved`;}
  }else if(phase==='travel'){
    label='ON TRIP';open='tickets';const t=nextTicket();title=t?'Open next ticket':'Open travel wallet';meta=t?`${fmtDate(t.date,{day:'numeric',month:'short'})}${t.time?' · '+t.time:''}`:`${data.tickets.length} tickets ready`;
  }else if(phase==='lastday'){
    label='GO HOME';open='gohome';const left=data.gohome.filter(x=>!x.done).length;title='Final room check';meta=left?`${left} checks left`:'All checks complete ✓';
  }else{
    label='TRIP COMPLETE';open='more';title='Save your trip backup';meta=data.lastBackup?'Backup ready':'Keep a copy before clearing browser data';
  }
  box.dataset.open=open;qs('#phaseActionLabel').textContent=label;qs('#phaseActionTitle').textContent=title;qs('#phaseActionMeta').textContent=meta;
}
function renderTrip(){
  qs('#greeting').textContent=greeting();
  qs('#tripCity').textContent=data.trip.city||'My Trip';
  qs('#tripDates').textContent=fmtRange(data.trip.start,data.trip.end);
  qs('#goHomeTitle').textContent=`Before leaving ${data.trip.city||'your trip'}`;
  const now=localISO(),count=daysBetween(now,data.trip.start),day=tripDayFor(now),phase=tripPhase();
  qs('#phaseStatus').textContent={before:'● PREP',travel:'● ON TRIP',lastday:'● GO HOME',after:'● COMPLETE'}[phase];
  const countdown=qs('#countdown');
  if(data.mode==='Travel Mode'){
    countdown.innerHTML=`<span>${day?`DAY ${day}`:'TRIP'}</span><small>${esc(data.trip.city)}</small>`;
  }else if(count>0){countdown.innerHTML=`<span>${count}</span><small>days to go</small>`}
  else if(now<=data.trip.end){countdown.innerHTML=`<span>${day?`DAY ${day}`:'TODAY'}</span><small>${esc(data.trip.city)}</small>`}
  else{countdown.innerHTML=`<span>✓</span><small>trip complete</small>`}

  const next=nextPlan();
  if(next){qs('#nextTitle').textContent=next.title;qs('#nextMeta').textContent=`${fmtDate(next.date,{day:'numeric',month:'short'})}${next.time?' · '+next.time:''}${next.meta?' · '+next.meta:''}`}
  else{qs('#nextTitle').textContent='No upcoming plans';qs('#nextMeta').textContent='Add your next stop when ready.'}
  renderPhaseAction();
}
function renderToday(){
  selectedTodayDate=effectiveTodayDate();
  const items=plansFor(selectedTodayDate), now=localISO(), nowTime=new Date().toTimeString().slice(0,5);
  let previewItems=items;
  if(selectedTodayDate===now){const upcoming=items.filter(p=>!p.time||p.time>=nowTime);previewItems=upcoming.length?upcoming:items.slice(-1);}
  renderTimeline('#todayPreview',previewItems);
  renderTimeline('#todayFull',items);
  qs('#todayEmpty').classList.toggle('hidden',items.length>0);
  const day=tripDayFor(selectedTodayDate);
  qs('#todayCityDay').textContent=`${data.trip.city||'Trip'} · ${day?`Day ${day}`:'Preview'}`;
  qs('#todayDateText').textContent=parseDate(selectedTodayDate).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
  qs('#todayBadge').textContent=selectedTodayDate===now?'TODAY':selectedTodayDate>now?'UPCOMING':'PAST';
  qs('#todayHomeTitle').textContent=selectedTodayDate===now?'Today':now<data.trip.start?'First travel day':'Travel day';
  qs('#prevDayBtn').disabled=selectedTodayDate<=data.trip.start;
  qs('#nextDayBtn').disabled=selectedTodayDate>=data.trip.end;
}
function renderPacking(){
  const done=data.packing.filter(x=>x.done).length,total=data.packing.length;
  qs('#packDone').textContent=done;qs('#packLeft').textContent=total-done;qs('#packingSmall').textContent=`${done} / ${total}`;
  qs('#packingList').innerHTML=data.packing.map(x=>`<div class="check-item ${x.done?'checked':''}"><input type="checkbox" data-pack="${x.id}" ${x.done?'checked':''}><label>${esc(x.name)}</label><button class="row-delete" data-pack-delete="${x.id}" aria-label="Delete">×</button></div>`).join('');
  qsa('[data-pack]').forEach(c=>c.addEventListener('change',()=>{const item=data.packing.find(x=>x.id===c.dataset.pack);if(item)item.done=c.checked;save()}));
  qsa('[data-pack-delete]').forEach(b=>b.addEventListener('click',()=>{data.packing=data.packing.filter(x=>x.id!==b.dataset.packDelete);save();toast('Packing item removed')}));
  const pct=total?Math.round(done/total*100):0;qs('#prepProgressText').textContent=pct+'%';qs('#prepProgressBar').style.width=pct+'%';
}
function moneyLabel(amount,code='MYR',digits=2){
  const symbols={MYR:'RM',THB:'฿',SGD:'S$',USD:'$',JPY:'¥',TWD:'NT$',EUR:'€',GBP:'£'};
  return `${symbols[code]||code+' '}${Number(amount||0).toFixed(code==='JPY'?0:digits)}`;
}
function fundBalances(){
  const balances={};
  (data.fundLedger?.transactions||[]).forEach(t=>{
    if(t.status==='void')return;
    const code=t.currency||data.baseCurrency||'MYR';
    balances[code]=(balances[code]||0)+(t.direction==='in'?1:-1)*Number(t.amount||0);
  });
  return balances;
}
function renderFundLedger(){
  if(!data.fundLedger||!Array.isArray(data.fundLedger.transactions))data.fundLedger={transactions:[]};
  const balances=fundBalances(),codes=[...new Set([...(data.currencies||[data.baseCurrency||'MYR']),...Object.keys(balances)])],base=data.baseCurrency||'MYR';
  const converted=data.fundLedger.transactions.filter(t=>t.status!=='void'&&(Number.isFinite(Number(t.baseAmount))||(t.currency||base)===base)).reduce((n,t)=>n+(t.direction==='in'?1:-1)*(Number.isFinite(Number(t.baseAmount))?Number(t.baseAmount):Number(t.amount||0)),0);
  const unconverted=data.fundLedger.transactions.filter(t=>t.status!=='void'&&(t.currency||base)!==base&&!Number.isFinite(Number(t.baseAmount))).length;
  qs('#fundBalances').innerHTML=codes.map(code=>`<div class="fund-balance"><span>${esc(code)}</span><b>${moneyLabel(balances[code]||0,code)}</b></div>`).join('')+`<div class="fund-balance"><span>Converted total · ${esc(base)}</span><b>${moneyLabel(converted,base)}</b></div>`+(unconverted?`<small>${unconverted} older foreign-currency transaction(s) need an exchange rate before inclusion in the converted total.</small>`:'');
  const list=data.fundLedger.transactions.slice().reverse();
  qs('#fundTransactions').innerHTML=list.map(t=>{const member=(data.members||[]).find(m=>m.id===t.memberId),voided=t.status==='void';return `<div class="fund-transaction ${voided?'is-void':''}"><div><b>${t.type==='refund'?'↩':t.direction==='in'?'＋':'－'} ${esc(t.title|| (t.type==='refund'?'Fund refund':t.direction==='in'?'Contribution':'Fund expense'))} ${voided?'<span class="fund-void-tag">VOID</span>':''}</b><small>${esc(t.date||'')} · ${esc(member?.name||'Unassigned')}${t.note?' · '+esc(t.note):''}${voided&&t.voidReason?' · Void: '+esc(t.voidReason):''}</small>${Number.isFinite(Number(t.baseAmount))&&(t.currency||base)!==base?`<small>≈ ${moneyLabel(t.baseAmount,base)} · rate ${Number(t.fxRate).toFixed(6)}</small>`:''}</div><div class="fund-transaction-side"><strong class="${t.direction==='in'?'fund-in':'fund-out'}">${t.direction==='in'?'+':'−'}${moneyLabel(t.amount,t.currency)}</strong>${voided?`<button type="button" class="fund-edit-btn" data-fund-restore="${esc(t.id)}">Restore</button>`:`<button type="button" class="fund-edit-btn" data-fund-edit="${esc(t.id)}">Edit</button>${t.direction==='out'&&t.type!=='refund'?`<button type="button" class="fund-refund-btn" data-fund-refund="${esc(t.id)}">Refund</button>`:''}<button type="button" class="fund-void-btn" data-fund-void="${esc(t.id)}">Void</button>`}</div></div>`}).join('');
  qs('#fundTransactions').querySelectorAll('[data-fund-edit]').forEach(btn=>btn.addEventListener('click',()=>editFundTransaction(btn.dataset.fundEdit)));
  qs('#fundTransactions').querySelectorAll('[data-fund-void]').forEach(btn=>btn.addEventListener('click',()=>voidFundTransaction(btn.dataset.fundVoid)));
  qs('#fundTransactions').querySelectorAll('[data-fund-refund]').forEach(btn=>btn.addEventListener('click',()=>refundFundTransaction(btn.dataset.fundRefund)));
  qs('#fundTransactions').querySelectorAll('[data-fund-restore]').forEach(btn=>btn.addEventListener('click',()=>restoreFundTransaction(btn.dataset.fundRestore)));
  qs('#fundEmpty').classList.toggle('hidden',list.length>0);
}
function refundFundTransaction(id){
  const original=(data.fundLedger?.transactions||[]).find(t=>t.id===id);
  if(!original||original.direction!=='out'||original.type==='refund'||original.status==='void')return;
  const refunded=(data.fundLedger.transactions||[]).filter(t=>t.type==='refund'&&t.refundOf===id&&t.status!=='void').reduce((n,t)=>n+Number(t.amount||0),0);
  const outstanding=Math.max(0,Number(original.amount||0)-refunded);
  if(outstanding<=0.000001)return toast('This expense has already been fully refunded');
  simpleForm('Record fund refund',[
    {label:'Refund amount · max '+moneyLabel(outstanding,original.currency),name:'amount',type:'number',required:true,placeholder:String(outstanding)},
    {label:'Reason',name:'reason',required:true,placeholder:'Merchant refund / cancelled booking'},
    {label:'Date',name:'date',type:'date',value:localISO()},
    {label:'Note',name:'note',placeholder:'Optional'}
  ],form=>{
    const amount=Number(form.amount);
    if(!(amount>0)||amount>outstanding+0.000001){toast('Refund must be above zero and no more than the remaining amount');return}
    if(!confirm('Record this refund back into the shared fund? The original expense will remain in history.'))return;
    const now=new Date().toISOString();
    data.fundLedger.transactions.push({id:uid('fund_'),direction:'in',type:'refund',title:'Refund: '+(original.title||'Fund expense'),amount,currency:original.currency||data.baseCurrency||'MYR',date:form.date,memberId:original.memberId||'',note:[form.reason.trim(),form.note].filter(Boolean).join(' · '),refundOf:original.id,fxRate:original.fxRate??((original.currency||data.baseCurrency||'MYR')===(data.baseCurrency||'MYR')?1:undefined),baseAmount:Number.isFinite(Number(original.fxRate))?Number((amount*Number(original.fxRate)).toFixed(2)):((original.currency||data.baseCurrency||'MYR')===(data.baseCurrency||'MYR')?amount:undefined),baseCurrency:data.baseCurrency||'MYR',createdAt:now,audit:[{action:'refund',at:now,originalTransactionId:original.id,reason:form.reason.trim()}]});
    save();toast('Refund recorded · original expense retained');
  });
}
function voidFundTransaction(id){
  const tx=(data.fundLedger?.transactions||[]).find(t=>t.id===id);if(!tx||tx.status==='void')return;
  if(tx.direction==='out'&&(data.fundLedger.transactions||[]).some(t=>t.type==='refund'&&t.refundOf===id&&t.status!=='void'))return toast('Void linked refund entries before voiding this expense');
  simpleForm('Void fund transaction',[{label:'Reason for voiding',name:'reason',required:true,placeholder:'Wrong member / duplicate entry'}],form=>{
    if(!confirm('Void this transaction? It will remain in history but will no longer affect the balance.'))return;
    tx.status='void';tx.voidedAt=new Date().toISOString();tx.voidReason=form.reason.trim();
    tx.audit=Array.isArray(tx.audit)?tx.audit:[];tx.audit.push({action:'void',at:tx.voidedAt,reason:tx.voidReason});
    save();toast('Transaction voided · history retained');
  });
}
function restoreFundTransaction(id){
  const tx=(data.fundLedger?.transactions||[]).find(t=>t.id===id);if(!tx||tx.status!=='void')return;
  if(!confirm('Restore this transaction and include it in the fund balance again?'))return;
  tx.audit=Array.isArray(tx.audit)?tx.audit:[];tx.audit.push({action:'restore',at:new Date().toISOString(),reason:'Restored by user'});
  tx.status='active';tx.restoredAt=new Date().toISOString();save();toast('Transaction restored');
}
function editFundTransaction(id){
  const tx=(data.fundLedger?.transactions||[]).find(t=>t.id===id);if(!tx)return;
  const members=(data.members||[]),currentMember=members.find(m=>m.id===tx.memberId);
  const memberNames=[...new Set(members.map(m=>m.name))];
  const currencies=[...new Set([tx.currency||data.baseCurrency||'MYR',data.baseCurrency||'MYR',...(data.currencies||[])])];
  simpleForm('Edit fund transaction',[
    {label:'Description',name:'title',value:tx.title||'',required:true},
    {label:'Amount',name:'amount',type:'number',value:tx.amount,required:true},
    {label:'Currency',name:'currency',type:'select',value:tx.currency||data.baseCurrency||'MYR',options:currencies},
    {label:`Exchange rate · 1 unit of selected currency = ? ${data.baseCurrency||'MYR'}`,name:'fxRate',type:'number',value:String(tx.fxRate??(tx.currency===(data.baseCurrency||'MYR')?1:'')),required:true,placeholder:'Enter 1 for base currency'},
    {label:tx.direction==='in'?'Contributed by':'Recorded for',name:'memberName',type:'select',value:currentMember?.name||memberNames[0],options:memberNames},
    {label:'Date',name:'date',type:'date',value:tx.date||localISO()},
    {label:'Note',name:'note',value:tx.note||'',placeholder:'Optional'}
  ],form=>{
    const amount=Number(form.amount),fxRate=Number(form.fxRate);if(!(amount>0)){toast('Enter a valid amount');return}if(!(fxRate>0)){toast('Enter a valid exchange rate');return}
    const refunded=(data.fundLedger.transactions||[]).filter(t=>t.type==='refund'&&t.refundOf===id&&t.status!=='void').reduce((n,t)=>n+Number(t.amount||0),0);
    if(tx.direction==='out'&&amount+0.000001<refunded){toast('Amount cannot be lower than refunds already recorded');return}
    const member=members.find(m=>m.name===form.memberName);
    tx.audit=Array.isArray(tx.audit)?tx.audit:[];tx.audit.push({action:'edit',at:new Date().toISOString(),before:{title:tx.title,amount:tx.amount,currency:tx.currency,date:tx.date,memberId:tx.memberId,note:tx.note}});
    const baseCurrency=data.baseCurrency||'MYR';Object.assign(tx,{title:form.title.trim(),amount,currency:form.currency,fxRate,baseAmount:Number((amount*fxRate).toFixed(2)),baseCurrency,date:form.date,memberId:member?.id||'',note:form.note||''});
    save();toast('Fund transaction updated · edit recorded');
  });
}
function addFundTransaction(direction){
  const members=(data.members||[]).map(m=>m.name);
  if(!members.length)return toast('Add a traveller first');
  const defaultCurrency=data.baseCurrency||'MYR';
  simpleForm(direction==='in'?'Add to shared fund':'Record shared-fund expense',[
    {label:'Description',name:'title',required:true,placeholder:direction==='in'?'Trip fund contribution':'Dinner / transport'},
    {label:'Amount',name:'amount',type:'number',required:true,placeholder:'100'},
    {label:'Currency',name:'currency',type:'select',value:defaultCurrency,options:[...new Set([defaultCurrency,...(data.currencies||[])])]},
    {label:`Exchange rate · 1 unit of selected currency = ? ${data.baseCurrency||'MYR'}`,name:'fxRate',type:'number',required:true,placeholder:'Enter 1 for base currency'},
    {label:direction==='in'?'Contributed by':'Recorded for',name:'memberName',type:'select',value:members[0],options:members},
    {label:'Date',name:'date',type:'date',value:localISO()},
    {label:'Note',name:'note',placeholder:'Optional'}
  ],f=>{
    const amount=Number(f.amount),fxRate=Number(f.fxRate);if(!(amount>0)){toast('Enter a valid amount');return}if(!(fxRate>0)){toast('Enter a valid exchange rate');return}
    const member=(data.members||[]).find(m=>m.name===f.memberName),baseCurrency=data.baseCurrency||'MYR';
    data.fundLedger.transactions.push({id:uid('fund_'),direction,type:direction==='in'?'contribution':'expense',title:f.title.trim(),amount,currency:f.currency,fxRate,baseAmount:Number((amount*fxRate).toFixed(2)),baseCurrency,date:f.date,memberId:member?.id||'',note:f.note||'',createdAt:new Date().toISOString()});
    save();toast(direction==='in'?'Contribution recorded':'Fund expense recorded');
  });
}
function renderMoney(){
  renderFundLedger();
  const spent=data.expenses.reduce((a,x)=>a+Number(x.rmAmount??x.amount??0),0),remaining=Number(data.budget||0)-spent;
  // Stage A keeps the legacy expense ledger in MYR. Multi-currency budget conversion arrives with the Stage B ledger.
  qs('#moneyBudget').textContent=`Budget RM ${Number(data.budget||0).toFixed(0)}`;
  qs('#moneySpent').textContent=`Spent RM ${spent.toFixed(0)}`;
  qs('#moneyRemaining').textContent=`RM ${remaining.toFixed(0)}`;
  qs('#moneySmall').textContent=`RM ${remaining.toFixed(0)} left`;
  const byCategory={},byDate={};
  data.expenses.forEach(x=>{const rm=Number(x.rmAmount??x.amount??0),category=x.category||'Other',date=x.date||data.trip.start||'';byCategory[category]=(byCategory[category]||0)+rm;if(date)byDate[date]=(byDate[date]||0)+rm});
  const categories=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]),dates=Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0]));
  qs('#expenseInsights').innerHTML=data.expenses.length?`<div class="insight-section"><div class="insight-heading">BY CATEGORY</div><div class="expense-category-grid">${categories.map(([name,total])=>`<div class="expense-category"><span>${esc(name)}</span><b>${moneyLabel(total,'MYR')}</b></div>`).join('')}</div></div><div class="insight-section"><div class="insight-heading">DAILY TOTALS</div><div class="daily-expense-list">${dates.map(([date,total])=>`<div><span>${esc(fmtDate(date,{day:'numeric',month:'short'}))}</span><b>${moneyLabel(total,'MYR')}</b></div>`).join('')}</div></div>`:'';
  const categoryIcons={Food:'🍜',Transport:'🚆',Shopping:'🛍️',Accommodation:'🏨',Tickets:'🎫',Other:'🧾'};
  qs('#expenseList').innerHTML=data.expenses.slice().reverse().map(x=>{
    const currency=x.currency||'MYR',amount=Number(x.amount??0),rm=Number(x.rmAmount??x.amount??0),foreign=currency!=='MYR';
    return `<div class="expense-item"><div class="expense-main"><span class="expense-icon">${categoryIcons[x.category||'Other']||'🧾'}</span><div class="expense-copy"><b>${esc(x.name)}</b><small>${esc(x.category||'Other')} · ${esc(fmtDate(x.date||data.trip.start,{day:'numeric',month:'short'}))}</small></div></div><div class="expense-value"><b>${moneyLabel(amount,currency)}</b>${foreign?`<small>≈ ${moneyLabel(rm,'MYR')}</small>`:''}<div class="row-actions"><button data-expense-edit="${x.id}" aria-label="Edit expense">✎</button><button class="row-delete" data-expense-delete="${x.id}" aria-label="Delete expense">×</button></div></div></div>`;
  }).join('');
  qs('#expenseEmpty').classList.toggle('hidden',data.expenses.length>0);
  qsa('[data-expense-edit]').forEach(b=>b.addEventListener('click',()=>openExpenseEditor(b.dataset.expenseEdit)));
  qsa('[data-expense-delete]').forEach(b=>b.addEventListener('click',()=>{data.expenses=data.expenses.filter(x=>x.id!==b.dataset.expenseDelete);save();toast('Expense removed')}));
}
function renderPlaces(){
  const list=activePlaceFilter==='All'?data.places:data.places.filter(x=>x.category===activePlaceFilter);
  qs('#placesSmall').textContent=`${data.places.length} saved`;
  qs('#placesList').innerHTML=list.map(x=>`<div class="place-item"><div class="place-icon">${esc(x.icon||'📍')}</div><div><b>${esc(x.name)}</b><small>${esc([x.category,x.note].filter(Boolean).join(' · '))}</small></div><div class="row-actions"><button data-place-map="${x.id}" title="Open maps">↗</button><button class="row-delete" data-place-delete="${x.id}" title="Delete">×</button></div></div>`).join('');
  qsa('[data-place-map]').forEach(b=>b.addEventListener('click',()=>{const p=data.places.find(x=>x.id===b.dataset.placeMap);if(p)openMaps(p.name)}));
  qsa('[data-place-delete]').forEach(b=>b.addEventListener('click',()=>{data.places=data.places.filter(x=>x.id!==b.dataset.placeDelete);save();toast('Place removed')}));
}
function renderStay(){
  const s=data.stay;qs('#hotelName').textContent=s.name||'No hotel yet';qs('#hotelAddress').textContent=s.address||'Address not set';qs('#hotelBooking').textContent=s.booking||'—';
  qs('#hotelTimes').textContent=`Check-in ${s.checkin||'—'} · Check-out ${s.checkout||'—'}`;
  qs('#hotelDateRange').textContent=`${fmtDate(data.trip.start,{day:'numeric',month:'short'}).toUpperCase()} – ${fmtDate(data.trip.end,{day:'numeric',month:'short'}).toUpperCase()}`;
  qs('#hotelVisual').textContent=(data.trip.city||'TRIP').slice(0,3).toUpperCase();qs('#staySmall').textContent=s.name?'1 booking':'No booking';
}
function renderTickets(){
  qs('#ticketsSmall').textContent=`${data.tickets.length} ready`;
  qs('#ticketsList').innerHTML=data.tickets.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(t=>`<article class="ticket-card ${t.type==='EVENT'?'featured':''}" data-ticket-card="${t.id}"><span class="ticket-type">${esc(t.type)}</span><h3>${esc(t.title)}</h3><p>${esc(fmtDate(t.date,{day:'numeric',month:'short'}))}${t.time?' · '+esc(t.time):''}${t.place?' · '+esc(t.place):''}</p><div class="ticket-bottom"><span>${t.seat?'Seat '+esc(t.seat):esc(t.code||'No reference')}</span><div class="ticket-actions"><button class="soft-btn" data-ticket-qr="${t.id}">View</button><button class="icon-btn" data-ticket-edit="${t.id}">✎</button></div></div></article>`).join('');
  qs('#ticketsEmpty').classList.toggle('hidden',data.tickets.length>0);
  qsa('[data-ticket-qr]').forEach(b=>b.addEventListener('click',()=>openQr(b.dataset.ticketQr)));
  qsa('[data-ticket-edit]').forEach(b=>b.addEventListener('click',()=>openTicketEditor(b.dataset.ticketEdit)));
}
function renderGoHome(){
  const done=data.gohome.filter(x=>x.done).length,total=data.gohome.length;
  qs('#goHomeProgress').textContent=`${done} / ${total} checked`;
  qs('#homeChecklist').innerHTML=data.gohome.map(x=>`<div class="check-item ${x.done?'checked':''}"><input type="checkbox" data-homecheck="${x.id}" ${x.done?'checked':''}><label>${esc(x.name)}</label><button class="row-delete" data-home-delete="${x.id}" aria-label="Delete">×</button></div>`).join('');
  qsa('[data-homecheck]').forEach(c=>c.addEventListener('change',()=>{const item=data.gohome.find(x=>x.id===c.dataset.homecheck);if(item)item.done=c.checked;save()}));
  qsa('[data-home-delete]').forEach(b=>b.addEventListener('click',()=>{data.gohome=data.gohome.filter(x=>x.id!==b.dataset.homeDelete);save();toast('Check removed')}));
  qs('#readyHome').classList.toggle('hidden',!total||done!==total);
}
function renderBackup(){
  if(!qs('#backupStatus'))return;
  qs('#backupStatus').textContent=data.lastBackup?`Last backup ${new Date(data.lastBackup).toLocaleString()}`:'Download everything, including ticket images';
  qs('#restoreRecoveryBtn')?.classList.toggle('hidden',!hasRecoverySnapshot());
}
function renderMode(){qs('#modeBtn').textContent=data.mode;document.body.classList.toggle('travel-mode',data.mode==='Travel Mode')}
function activeTripRecord(){return data.trips?.find(t=>t.id===data.activeTripId)||null}
function renderTripManager(){
  const host=qs('#tripCards');if(!host)return;syncActiveTripSnapshot();
  host.innerHTML=(data.trips||[]).slice().sort((a,b)=>(a.status==='archived')-(b.status==='archived')||String(b.start).localeCompare(String(a.start))).map(t=>{
    const active=t.id===data.activeTripId;
    return `<article class="trip-manager-card ${active?'is-current':''} ${t.status==='archived'?'is-archived':''}">
      <div class="trip-card-top"><span class="trip-card-mark">✈</span><span class="trip-card-status">${active?'CURRENT':String(t.status||'planning').toUpperCase()}</span></div>
      <h4>${esc(t.name||'My Trip')}</h4><p>${esc([t.destination,fmtRange(t.start,t.end)].filter(Boolean).join(' · ')||'Dates not set')}</p>
      <div class="trip-card-meta"><span>👥 ${t.members?.length||0} members</span><span>💱 ${esc(t.baseCurrency||'MYR')}</span></div>
      <div class="trip-card-actions">
        <button type="button" class="primary-btn" data-trip-open="${esc(t.id)}">${active?'Open trip':'Switch to trip'}</button>
        <button type="button" class="soft-btn" data-trip-edit="${esc(t.id)}">Edit</button>
        <button type="button" class="soft-btn" data-trip-members="${esc(t.id)}">Members</button>
        <button type="button" class="soft-btn" data-trip-currencies="${esc(t.id)}">Currencies</button>
        <button type="button" class="mini-link" data-trip-archive="${esc(t.id)}">${t.status==='archived'?'Restore':'Archive'}</button>
      </div>
    </article>`;
  }).join('');
  host.querySelectorAll('[data-trip-open]').forEach(b=>b.addEventListener('click',()=>switchTrip(b.dataset.tripOpen)));
  host.querySelectorAll('[data-trip-edit]').forEach(b=>b.addEventListener('click',()=>editTrip(b.dataset.tripEdit)));
  host.querySelectorAll('[data-trip-members]').forEach(b=>b.addEventListener('click',()=>manageMembers(b.dataset.tripMembers)));
  host.querySelectorAll('[data-trip-currencies]').forEach(b=>b.addEventListener('click',()=>manageCurrencies(b.dataset.tripCurrencies)));
  host.querySelectorAll('[data-trip-archive]').forEach(b=>b.addEventListener('click',()=>toggleTripArchive(b.dataset.tripArchive)));
}
function openTrips(){renderTripManager();showView('trips')}
function switchTrip(id){
  syncActiveTripSnapshot();const record=data.trips.find(t=>t.id===id);if(!record)return;
  const trips=data.trips,snapshot=clone(record.snapshot||seed);
  data={...snapshot,version:5,trips,activeTripId:id,members:clone(record.members||[]),currencies:clone(record.currencies||['MYR']),baseCurrency:record.baseCurrency||'MYR'};
  selectedTodayDate='';activePlaceFilter='All';save();showView('home');toast('Trip switched');
}
function createTrip(){
  simpleForm('Create a new trip',[
    {label:'Trip name',name:'name',required:true,placeholder:'Bangkok December 2026'},
    {label:'Destination',name:'destination',placeholder:'Thailand'},
    {label:'Start date',name:'start',type:'date',required:true,value:localISO()},
    {label:'End date',name:'end',type:'date',required:true,value:localISO()},
    {label:'Base currency',name:'baseCurrency',type:'select',value:'MYR',options:['MYR','THB','SGD','USD','JPY','TWD','EUR','GBP']},
    {label:'Budget',name:'budget',type:'number',value:'0'}
  ],f=>{
    if(f.end<f.start)return toast('End date must be after start date');
    syncActiveTripSnapshot();const baseCurrency=f.baseCurrency||'MYR',id=uid('trip_'),fresh=clone(seed);
    fresh.trip={city:f.name.trim(),country:f.destination.trim(),start:f.start,end:f.end};
    fresh.stay={name:'',address:'',checkin:'',checkout:'',booking:''};fresh.budget=Math.max(0,Number(f.budget||0));
    fresh.packing=[];fresh.expenses=[];fresh.places=[];fresh.plans=[];fresh.tickets=[];fresh.gohome=[];
    fresh.members=[{id:uid('member_'),name:'You',role:'owner'}];fresh.currencies=[baseCurrency];fresh.baseCurrency=baseCurrency;
    const record={id,name:f.name.trim(),destination:f.destination.trim(),start:f.start,end:f.end,baseCurrency,budget:fresh.budget,status:'planning',members:clone(fresh.members),currencies:[baseCurrency],createdAt:new Date().toISOString(),snapshot:fresh};
    const trips=data.trips;trips.push(record);data={...fresh,version:5,trips,activeTripId:id};
    selectedTodayDate='';activePlaceFilter='All';save();showView('home');toast('New trip created');
  });
}
function editTrip(id){
  const t=data.trips.find(x=>x.id===id);if(!t)return;const wasActive=id===data.activeTripId;
  simpleForm('Edit trip',[
    {label:'Trip name',name:'name',value:t.name,required:true},{label:'Destination',name:'destination',value:t.destination||''},
    {label:'Start date',name:'start',type:'date',value:t.start,required:true},{label:'End date',name:'end',type:'date',value:t.end,required:true},
    {label:'Base currency',name:'baseCurrency',type:'select',value:t.baseCurrency||'MYR',options:['MYR','THB','SGD','USD','JPY','TWD','EUR','GBP']},
    {label:'Budget',name:'budget',type:'number',value:t.budget||0}
  ],f=>{
    if(f.end<f.start)return toast('End date must be after start date');
    if(wasActive&&data.expenses.length&&f.baseCurrency!==data.baseCurrency)return toast('Base currency is locked while legacy expenses exist.');
    t.name=f.name.trim();t.destination=f.destination.trim();t.start=f.start;t.end=f.end;t.baseCurrency=f.baseCurrency;t.budget=Math.max(0,Number(f.budget||0));
    if(!t.currencies.includes(t.baseCurrency))t.currencies.unshift(t.baseCurrency);
    if(wasActive){data.trip={...data.trip,city:t.name,country:t.destination,start:t.start,end:t.end};data.baseCurrency=t.baseCurrency;data.budget=t.budget;data.currencies=clone(t.currencies);}
    save();renderTripManager();toast('Trip updated');
  });
}
function toggleTripArchive(id){const t=data.trips.find(x=>x.id===id);if(!t)return;t.status=t.status==='archived'?'planning':'archived';save();renderTripManager();toast(t.status==='archived'?'Trip archived':'Trip restored')}
function manageMembers(id){
  if(!data.trips.find(x=>x.id===id))return;if(id!==data.activeTripId)switchTrip(id);
  const t=activeTripRecord();qs('#membersTitle').textContent=(t?.name||'Trip')+' · Members';renderMembers();qs('#membersDialog').showModal();
}
function renderMembers(){
  const host=qs('#membersList'),members=data.members||[];
  host.innerHTML=members.map(m=>`<div class="member-row"><span class="member-avatar">${m.role==='owner'?'♛':'•'}</span><div><b>${esc(m.name)}</b><small>${m.role==='owner'?'Trip owner':'Traveller'}</small></div><div class="member-actions">${m.role==='owner'?'':`<button type="button" data-member-rename="${esc(m.id)}">Edit</button><button type="button" data-member-remove="${esc(m.id)}">Remove</button>`}</div></div>`).join('');
  host.querySelectorAll('[data-member-rename]').forEach(b=>b.addEventListener('click',()=>{const m=data.members.find(x=>x.id===b.dataset.memberRename);simpleForm('Edit member',[{label:'Name',name:'name',value:m.name,required:true}],f=>{m.name=f.name.trim();save();renderMembers()})}));
  host.querySelectorAll('[data-member-remove]').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Remove this traveller from the trip?'))return;data.members=data.members.filter(x=>x.id!==b.dataset.memberRemove);save();renderMembers()}));
}
function manageCurrencies(id){
  if(!data.trips.find(x=>x.id===id))return;if(id!==data.activeTripId)switchTrip(id);
  qs('#currenciesTitle').textContent=(activeTripRecord()?.name||'Trip')+' · Currencies';
  qs('#currenciesFields').innerHTML=`<label class="field"><span>Base currency</span><select id="baseCurrencyInput">${['MYR','THB','SGD','USD','JPY','TWD','EUR','GBP'].map(c=>`<option ${c===(data.baseCurrency||'MYR')?'selected':''}>${c}</option>`).join('')}</select></label><label class="field"><span>Enabled currencies (comma separated)</span><input id="currencyListInput" value="${esc((data.currencies||['MYR']).join(', '))}" placeholder="MYR, THB, JPY"></label>`;
  qs('#currenciesDialog').showModal();
}
function render(){renderTrip();renderToday();renderPacking();renderMoney();renderPlaces();renderStay();renderTickets();renderGoHome();renderBackup();renderMode();renderTripManager()}

function simpleForm(title,fields,onSave){
  qs('#simpleTitle').textContent=title;
  qs('#simpleFields').innerHTML=fields.map(f=>`<label class="field"><span>${esc(f.label)}</span>${f.type==='select'?`<select name="${f.name}">${f.options.map(o=>`<option ${o===f.value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input name="${f.name}" type="${f.type||'text'}" value="${esc(f.value||'')}" ${f.required?'required':''} placeholder="${esc(f.placeholder||'')}">`}</label>`).join('');
  qs('#simpleForm').onsubmit=e=>{e.preventDefault();const form=Object.fromEntries(new FormData(e.currentTarget).entries());onSave(form);qs('#simpleDialog').close()};
  qs('#simpleDialog').showModal();
}

qs('#tripSwitcherBtn').addEventListener('click',openTrips);
qs('#createTripBtn').addEventListener('click',createTrip);
qs('#addMemberBtn').addEventListener('click',()=>simpleForm('Add traveller',[{label:'Member name',name:'name',required:true,placeholder:'Foo Zai'}],f=>{data.members.push({id:uid('member_'),name:f.name.trim(),role:'traveller'});save();renderMembers();toast('Member added')}));
qs('#saveCurrenciesBtn').addEventListener('click',()=>{
  const base=qs('#baseCurrencyInput').value;
  const list=[...new Set(qs('#currencyListInput').value.split(',').map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z]{3}$/.test(x)))];
  if(!list.includes(base))list.unshift(base);
  if(data.expenses.length&&base!==data.baseCurrency)return toast('This trip already has legacy expense records. Keep its base currency unchanged until the Stage B ledger migration.');
  data.baseCurrency=base;data.currencies=list;
  const record=activeTripRecord();if(record){record.baseCurrency=base;record.currencies=clone(list);}
  save();qs('#currenciesDialog').close();toast('Currencies updated');
});
qs('#modeBtn').addEventListener('click',()=>{data.mode=data.mode==='Before Trip'?'Travel Mode':'Before Trip';save();toast(`${data.mode} enabled`)});
qs('#editTripBtn').addEventListener('click',()=>simpleForm('Edit trip',[
  {label:'City',name:'city',value:data.trip.city,required:true},{label:'Country',name:'country',value:data.trip.country},{label:'Start date',name:'start',type:'date',value:data.trip.start,required:true},{label:'End date',name:'end',type:'date',value:data.trip.end,required:true}
],f=>{if(f.end<f.start){toast('End date must be after start date');return}data.trip={...data.trip,...f};selectedTodayDate='';save();toast('Trip updated')}));

qs('#editStayBtn').addEventListener('click',()=>simpleForm('Edit stay',[
  {label:'Hotel name',name:'name',value:data.stay.name,required:true},{label:'Address',name:'address',value:data.stay.address},{label:'Check-in time',name:'checkin',type:'time',value:data.stay.checkin},{label:'Check-out time',name:'checkout',type:'time',value:data.stay.checkout},{label:'Booking reference',name:'booking',value:data.stay.booking}
],f=>{data.stay={...data.stay,...f};save();toast('Stay updated')}));

function openMaps(query){if(!query)return toast('Add an address first');window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,'_blank','noopener')}
qs('#mapsBtn').addEventListener('click',()=>openMaps(data.stay.address||data.stay.name));
qs('#bookingBtn').addEventListener('click',async()=>{if(!data.stay.booking)return toast('No booking reference');try{await navigator.clipboard.writeText(data.stay.booking);toast('Booking reference copied')}catch{toast(data.stay.booking)}});

qsa('#placeFilters .chip').forEach(c=>c.addEventListener('click',()=>{activePlaceFilter=c.dataset.filter;qsa('#placeFilters .chip').forEach(x=>x.classList.toggle('active',x===c));renderPlaces()}));
qs('#addPlaceBtn').addEventListener('click',()=>addPlace());
qs('#addPackBtn').addEventListener('click',()=>simpleForm('Add packing item',[{label:'Item',name:'name',required:true,placeholder:'Umbrella'}],f=>{data.packing.push({id:uid('p'),name:f.name,done:false});save();toast('Added to packing')}));
qs('#editBudgetBtn').addEventListener('click',()=>simpleForm('Trip budget',[{label:'Budget (RM)',name:'budget',type:'number',value:data.budget,required:true}],f=>{data.budget=Math.max(0,Number(f.budget||0));save();toast('Budget updated')}));
qs('#addFundContributionBtn').addEventListener('click',()=>addFundTransaction('in'));
qs('#addFundExpenseBtn').addEventListener('click',()=>addFundTransaction('out'));
qs('#addExpenseBtn').addEventListener('click',()=>openExpenseEditor());
qs('#addPlanBtn').addEventListener('click',()=>addPlan());
qs('#addTicketBtn').addEventListener('click',()=>openTicketEditor());
qs('#prevDayBtn').addEventListener('click',()=>shiftSelectedDay(-1));
qs('#nextDayBtn').addEventListener('click',()=>shiftSelectedDay(1));
qs('#addGoHomeBtn').addEventListener('click',()=>simpleForm('Add final check',[{label:'Check',name:'name',required:true,placeholder:'Hotel safe checked'}],f=>{data.gohome.push({id:uid('g'),name:f.name,done:false});save();toast('Final check added')}));
qs('#resetGoHomeBtn').addEventListener('click',()=>{data.gohome.forEach(x=>x.done=false);save();toast('Go Home checks reset')});

function addPlace(){simpleForm('Add place',[{label:'Place',name:'name',required:true,placeholder:'Siam Paragon'},{label:'Category',name:'category',type:'select',value:'All',options:['All','Must go','Food','Shopping']},{label:'Note',name:'note',placeholder:'Optional'}],f=>{data.places.unshift({id:uid('l'),icon:'📍',name:f.name,category:f.category,note:f.note});save();toast('Place saved')})}
function openExpenseEditor(id=''){
  const x=data.expenses.find(item=>item.id===id)||{id:'',name:'',category:'Food',date:selectedTodayDate||((localISO()>=data.trip.start&&localISO()<=data.trip.end)?localISO():data.trip.start),currency:'THB',amount:'',rmAmount:''};
  const currency=x.currency||'MYR',legacyRate=Number(x.amount)>0&&Number(x.rmAmount)>0?Number(x.rmAmount)/Number(x.amount):1;
  qs('#expenseDialogTitle').textContent=id?'Edit travel expense':'Add travel expense';qs('#expenseEditId').value=x.id||'';qs('#expenseDate').value=x.date||data.trip.start;qs('#expenseCategory').value=['Food','Transport','Shopping','Accommodation','Tickets','Other'].includes(x.category)?x.category:'Other';qs('#expenseName').value=x.name||'';qs('#expenseCurrency').value=['THB','MYR','SGD','USD'].includes(currency)?currency:'MYR';qs('#expenseAmount').value=x.amount??'';qs('#expenseFxRate').value=String(x.fxRate??(currency==='MYR'?1:legacyRate));updateExpenseCurrencyFields();updateExpenseEquivalent();qs('#expenseDialog').showModal();
}
function updateExpenseCurrencyFields(){const isMyr=qs('#expenseCurrency').value==='MYR';qs('#expenseFxRate').value=isMyr?'1':qs('#expenseFxRate').value;qs('#expenseRateWrap').classList.toggle('hidden',false);qs('#expenseRmWrap').classList.toggle('hidden',false);qs('#expenseFxRate').readOnly=isMyr;}
function updateExpenseEquivalent(){const amount=Number(qs('#expenseAmount').value),rate=Number(qs('#expenseFxRate').value);qs('#expenseRmAmount').value=amount>0&&rate>0?(amount*rate).toFixed(2):'';}
qs('#expenseCurrency').addEventListener('change',()=>{updateExpenseCurrencyFields();updateExpenseEquivalent()});
qs('#expenseAmount').addEventListener('input',updateExpenseEquivalent);
qs('#expenseFxRate').addEventListener('input',updateExpenseEquivalent);
qs('#expenseForm').addEventListener('submit',e=>{e.preventDefault();const id=qs('#expenseEditId').value,currency=qs('#expenseCurrency').value,amount=Number(qs('#expenseAmount').value),fxRate=Number(qs('#expenseFxRate').value),rmAmount=Number(qs('#expenseRmAmount').value);if(!(amount>0)||!(fxRate>0)||!(rmAmount>0)){toast('Enter valid amount and exchange rate');return}const expense={id:id||uid('e'),date:qs('#expenseDate').value,category:qs('#expenseCategory').value,name:qs('#expenseName').value.trim(),currency,amount,fxRate,rmAmount,baseCurrency:data.baseCurrency||'MYR'};if(!expense.name)return toast('Enter what the expense was for');if(id){const index=data.expenses.findIndex(x=>x.id===id);if(index>=0)data.expenses[index]={...data.expenses[index],...expense}}else data.expenses.push(expense);save();qs('#expenseDialog').close();toast(id?'Expense updated':'Expense saved')});
function addPlan(){simpleForm('Add plan',[{label:'Date',name:'date',type:'date',value:selectedTodayDate||data.trip.start,required:true},{label:'Time',name:'time',type:'time',value:''},{label:'Plan',name:'title',required:true,placeholder:'📍 Siam'},{label:'Note',name:'meta',placeholder:'Optional'}],f=>{data.plans.push({id:uid('d'),...f});save();toast('Plan saved')})}

qs('#quickAdd').addEventListener('click',()=>qs('#quickDialog').showModal());
qsa('[data-quick]').forEach(b=>b.addEventListener('click',()=>{qs('#quickDialog').close();({place:addPlace,expense:()=>openExpenseEditor(),ticket:()=>openTicketEditor(),plan:addPlan})[b.dataset.quick]()}));

function openTicketEditor(id=''){
  const t=data.tickets.find(x=>x.id===id)||{id:'',type:'FLIGHT',title:'',date:selectedTodayDate||data.trip.start,time:'',place:'',seat:'',code:'',qr:''};
  qs('#ticketDialogTitle').textContent=id?'Edit ticket':'Add ticket';qs('#ticketEditId').value=t.id;qs('#ticketType').value=['FLIGHT','EVENT','TRAIN','BUS','RETURN','OTHER'].includes(t.type)?t.type:'OTHER';
  qs('#ticketTitle').value=t.title;qs('#ticketDate').value=t.date;qs('#ticketTime').value=t.time;qs('#ticketPlace').value=t.place;qs('#ticketSeat').value=t.seat;qs('#ticketCode').value=t.code;
  qs('#ticketQr').value='';pendingTicketQr=t.qr||'';qs('#ticketQrHint').textContent=t.qr?'Current image saved · choose another to replace':'Optional · image is stored only in this browser';
  qs('#deleteTicketBtn').classList.toggle('hidden',!id);qs('#ticketDialog').showModal();
}
qs('#ticketQr').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{pendingTicketQr=await resizeImage(file,900,0.88);qs('#ticketQrHint').textContent='New image ready to save'}catch{toast('Could not read image')}});
function resizeImage(file,max=900,quality=.88){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{let w=img.width,h=img.height;if(Math.max(w,h)>max){const k=max/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};img.src=r.result};r.readAsDataURL(file)})}
qs('#ticketForm').addEventListener('submit',e=>{e.preventDefault();const id=qs('#ticketEditId').value;const ticket={id:id||uid('t'),type:qs('#ticketType').value,title:qs('#ticketTitle').value.trim(),date:qs('#ticketDate').value,time:qs('#ticketTime').value,place:qs('#ticketPlace').value.trim(),seat:qs('#ticketSeat').value.trim(),code:qs('#ticketCode').value.trim(),qr:pendingTicketQr};if(!ticket.title||!ticket.date)return;const idx=data.tickets.findIndex(x=>x.id===id);if(idx>=0)data.tickets[idx]=ticket;else data.tickets.push(ticket);qs('#ticketDialog').close();save();toast('Ticket saved')});
qs('#deleteTicketBtn').addEventListener('click',()=>{const id=qs('#ticketEditId').value;if(!id)return;data.tickets=data.tickets.filter(x=>x.id!==id);qs('#ticketDialog').close();save();toast('Ticket removed')});
function openQr(id){const t=data.tickets.find(x=>x.id===id);if(!t)return;qs('#qrTitle').textContent=t.title;qs('#qrCodeText').textContent=t.code||'No booking reference';qs('#qrMeta').textContent=[t.date,t.time,t.seat?`Seat ${t.seat}`:''].filter(Boolean).join(' · ');qs('#qrImage').classList.toggle('hidden',!t.qr);qs('#fakeQr').classList.toggle('hidden',!!t.qr);if(t.qr)qs('#qrImage').src=t.qr;qs('#qrDialog').showModal()}

function backupFilename(){
  const city=(data.trip.city||'Trip').replace(/[^a-z0-9À-ɏ一-鿿_-]+/gi,'-').replace(/^-+|-+$/g,'')||'Trip';
  return `Trip-Lah-${city}-${data.trip.start||localISO()}-backup.json`;
}
function exportBackup(){
  syncActiveTripSnapshot();
  const exportedAt=new Date().toISOString();
  const payload={app:'Trip Lah!',backupVersion:2,exportedAt,data:{...data,lastBackup:exportedAt,version:4}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=backupFilename();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  data.lastBackup=exportedAt;localStorage.setItem(LS,JSON.stringify(data));render();toast('Trip backup downloaded');
}
function saveRecoverySnapshot(){
  try{localStorage.setItem(RECOVERY_LS,JSON.stringify({savedAt:new Date().toISOString(),data}))}catch{}
}
function hasRecoverySnapshot(){
  try{return !!JSON.parse(localStorage.getItem(RECOVERY_LS))?.data}catch{return false}
}
async function importBackup(file){
  try{
    const raw=JSON.parse(await file.text()),incoming=raw && raw.data ? raw.data : raw;
    if(!incoming || (!incoming.trip && !Array.isArray(incoming.trips)) || (!Array.isArray(incoming.tickets) && !Array.isArray(incoming.trips))) throw new Error('Invalid backup');
    const incomingWorkspace=normalizeData(incoming);
    const source=incomingWorkspace.trips?.[0]?.snapshot||incomingWorkspace;
    const match=Array.isArray(data.trips)&&data.trips.find(t=>t.start===source.trip?.start&&t.end===source.trip?.end);
    if(match){
      if(!confirm(`Merge this backup into existing trip “${match.name}” (${match.start} to ${match.end})?\n\nOther trips will be kept. Current data will be saved as an automatic recovery snapshot.`)) return;
      saveRecoverySnapshot();
      const snapshot={...clone(source),version:5,trip:{...source.trip,city:match.name,country:match.destination||source.trip?.country||'',start:match.start,end:match.end},members:clone(match.members||source.members||[]),currencies:clone(match.currencies||source.currencies||['MYR']),baseCurrency:match.baseCurrency||source.baseCurrency||'MYR'};
      const trips=data.trips.map(t=>t.id===match.id?{...t,snapshot,budget:Number(snapshot.budget??t.budget??0)}:t);
      data={...snapshot,trips,activeTripId:match.id,version:5};
      selectedTodayDate='';activePlaceFilter='All';save();toast('Backup merged into existing trip');showView('home');return;
    }
    if(!confirm(`Restore backup for ${incoming.trip?.city||'this trip'}?\n\nYour current Trip Lah! data will be kept as an automatic recovery snapshot.`)) return;
    saveRecoverySnapshot();
    data=incomingWorkspace;selectedTodayDate='';activePlaceFilter='All';save();toast('Trip backup restored');showView('home');
  }catch{toast('Could not import this backup')}
}
function restoreRecovery(){
  try{
    const snap=JSON.parse(localStorage.getItem(RECOVERY_LS));
    if(!snap?.data) return toast('No recovery snapshot');
    if(!confirm('Undo the last import and restore your previous Trip Lah! data?')) return;
    data=normalizeData(snap.data);selectedTodayDate='';activePlaceFilter='All';localStorage.removeItem(RECOVERY_LS);save();toast('Previous trip restored');showView('home');
  }catch{toast('Could not restore recovery snapshot')}
}
qs('#exportBackupBtn').addEventListener('click',exportBackup);
qs('#importBackupBtn').addEventListener('click',()=>{qs('#backupFileInput').value='';qs('#backupFileInput').click()});
qs('#backupFileInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importBackup(file)});
qs('#restoreRecoveryBtn').addEventListener('click',restoreRecovery);


function loadCloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_LS))||null}catch{return null}}
function loadCloudMeta(){try{return {...{revision:0,dirty:false,lastSyncedAt:'',conflict:false},...(JSON.parse(localStorage.getItem(CLOUD_META_LS))||{})}}catch{return {revision:0,dirty:false,lastSyncedAt:'',conflict:false}}}
function saveCloudSession(){if(cloudSession)localStorage.setItem(CLOUD_SESSION_LS,JSON.stringify(cloudSession));else localStorage.removeItem(CLOUD_SESSION_LS)}
function saveCloudMeta(){localStorage.setItem(CLOUD_META_LS,JSON.stringify(cloudMeta))}
function clearCloudState(){cloudSession=null;cloudMeta={revision:0,dirty:false,lastSyncedAt:'',conflict:false};cloudRemoteSnapshot=null;localStorage.removeItem(CLOUD_SESSION_LS);localStorage.removeItem(CLOUD_META_LS);updateCloudUI()}
function cloudLabelTime(v){if(!v)return '';try{return new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function updateCloudUI(state=''){
  const pill=qs('#cloudStatusBtn'),more=qs('#cloudMoreStatus');
  if(!pill||!more)return;
  pill.classList.remove('is-synced','is-syncing','is-conflict','is-offline');
  const signed=!!cloudSession;
  qs('#cloudSyncNowBtn')?.classList.toggle('hidden',!signed);
  qs('#cloudDisconnectBtn')?.classList.toggle('hidden',!signed);
  qs('#cloudUseCloudBtn')?.classList.toggle('hidden',!cloudMeta.conflict);
  qs('#cloudForcePushBtn')?.classList.toggle('hidden',!cloudMeta.conflict);
  if(!signed){pill.textContent='☁ Local';more.textContent='Local only · tap to sign in';return}
  if(cloudMeta.conflict){pill.textContent='☁ Conflict';pill.classList.add('is-conflict');more.textContent='Cloud conflict · choose which copy to keep';return}
  if(!navigator.onLine){pill.textContent='☁ Offline';pill.classList.add('is-offline');more.textContent='Offline · local changes are safe';return}
  if(state==='syncing'){pill.textContent='☁ Syncing';pill.classList.add('is-syncing');more.textContent='Syncing quietly…';return}
  if(cloudMeta.dirty){pill.textContent='☁ Pending';pill.classList.add('is-syncing');more.textContent='Local change waiting to sync';return}
  pill.textContent='☁ Synced';pill.classList.add('is-synced');more.textContent=cloudMeta.lastSyncedAt?`Synced ${cloudLabelTime(cloudMeta.lastSyncedAt)}`:'Connected · ready to sync';
}
async function authRequest(path,body){
  const r=await fetch(SUPABASE_URL+path,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j.msg||j.message||j.error_description||'Cloud sign-in failed'); return j;
}
async function ensureCloudSession(){
  if(!cloudSession)return null;
  if(cloudSession.expiresAt && Date.now()<cloudSession.expiresAt-60000)return cloudSession;
  try{
    const j=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:cloudSession.refreshToken});
    cloudSession={accessToken:j.access_token,refreshToken:j.refresh_token,userId:j.user?.id||cloudSession.userId,expiresAt:Date.now()+Number(j.expires_in||3600)*1000};saveCloudSession();return cloudSession;
  }catch{clearCloudState();toast('Cloud session expired · sign in again');return null}
}
async function cloudFetch(path,options={}){
  const session=await ensureCloudSession(); if(!session)throw new Error('Not signed in');
  const r=await fetch(SUPABASE_URL+path,{...options,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});
  const text=await r.text(); const j=text?JSON.parse(text):null; if(!r.ok)throw new Error(j?.message||j?.hint||`Cloud ${r.status}`); return j;
}
async function readCloud(){
  const s=await ensureCloudSession();if(!s)return null;
  const rows=await cloudFetch(`/rest/v1/trip_lah_sync?select=payload,revision,updated_at&user_id=eq.${encodeURIComponent(s.userId)}`);
  return rows?.[0]||null;
}
async function createCloudCopy(){
  const s=await ensureCloudSession(); if(!s)return;
  const rows=await cloudFetch('/rest/v1/trip_lah_sync',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:s.userId,payload:data,revision:1})});
  const row=rows?.[0];cloudMeta={revision:Number(row?.revision||1),dirty:false,lastSyncedAt:row?.updated_at||new Date().toISOString(),conflict:false};saveCloudMeta();updateCloudUI();
}
async function updateCloudCopy(baseRevision,force=false){
  const s=await ensureCloudSession(); if(!s)return false;
  let path=`/rest/v1/trip_lah_sync?user_id=eq.${encodeURIComponent(s.userId)}`;
  if(!force)path+=`&revision=eq.${Number(baseRevision||0)}`;
  const rows=await cloudFetch(path,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload:data,revision:Number(baseRevision||0)+1})});
  if(!rows?.length)return false;
  const row=rows[0];cloudMeta={revision:Number(row.revision),dirty:false,lastSyncedAt:row.updated_at||new Date().toISOString(),conflict:false};cloudRemoteSnapshot=null;saveCloudMeta();updateCloudUI();return true;
}
function applyCloudPayload(row){
  saveRecoverySnapshot();
  data=normalizeData(row.payload);selectedTodayDate='';activePlaceFilter='All';
  localStorage.setItem(LS,JSON.stringify(data));
  cloudMeta={revision:Number(row.revision||1),dirty:false,lastSyncedAt:row.updated_at||new Date().toISOString(),conflict:false};cloudRemoteSnapshot=null;saveCloudMeta();render();updateCloudUI();
}
async function syncCloud({manual=false}={}){
  if(!cloudSession||!navigator.onLine)return updateCloudUI();
  if(cloudMeta.conflict&&!manual)return updateCloudUI();
  updateCloudUI('syncing');
  try{
    const remote=await readCloud();
    if(!remote){await createCloudCopy();if(manual)toast('Cloud copy created');return}
    const remoteRev=Number(remote.revision||1),localRev=Number(cloudMeta.revision||0);
    if(localRev===0){
      if(!HAD_LOCAL_AT_START){applyCloudPayload(remote);if(manual)toast('Cloud trip loaded');return}
      cloudRemoteSnapshot=remote;cloudMeta.conflict=true;saveCloudMeta();updateCloudUI();if(manual)toast('Choose cloud or this device copy');return;
    }
    if(remoteRev>localRev){
      if(cloudMeta.dirty){cloudRemoteSnapshot=remote;cloudMeta.conflict=true;saveCloudMeta();updateCloudUI();if(manual)toast('Cloud conflict found');return}
      applyCloudPayload(remote);if(manual)toast('Latest cloud trip loaded');return;
    }
    if(remoteRev===localRev&&cloudMeta.dirty){
      const ok=await updateCloudCopy(localRev,false);
      if(!ok){cloudRemoteSnapshot=await readCloud();cloudMeta.conflict=true;saveCloudMeta();updateCloudUI();if(manual)toast('Cloud conflict found');return}
      if(manual)toast('Synced');return;
    }
    if(remoteRev===localRev){cloudMeta.dirty=false;cloudMeta.lastSyncedAt=remote.updated_at||cloudMeta.lastSyncedAt;saveCloudMeta();updateCloudUI();if(manual)toast('Already synced');return}
    if(remoteRev<localRev&&cloudMeta.dirty){await updateCloudCopy(remoteRev,true);if(manual)toast('Synced');return}
    updateCloudUI();
  }catch(e){console.error(e);updateCloudUI();if(manual)toast('Cloud sync failed · local copy is safe')}
}
function scheduleCloudSync(){clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>syncCloud(),900)}
async function signInCloud(email,password){
  const j=await authRequest('/auth/v1/token?grant_type=password',{email,password});
  cloudSession={accessToken:j.access_token,refreshToken:j.refresh_token,userId:j.user?.id,expiresAt:Date.now()+Number(j.expires_in||3600)*1000};
  cloudMeta={revision:0,dirty:HAD_LOCAL_AT_START,lastSyncedAt:'',conflict:false};saveCloudSession();saveCloudMeta();updateCloudUI('syncing');await syncCloud({manual:true});
}
async function disconnectCloud(){
  try{const s=await ensureCloudSession();if(s)await fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.accessToken}`}})}catch{}
  clearCloudState();toast('Cloud disconnected · local data kept');
}
qs('#cloudStatusBtn')?.addEventListener('click',()=>{if(!cloudSession)qs('#cloudDialog').showModal();else showView('more')});
qs('#cloudSetupBtn')?.addEventListener('click',()=>{if(!cloudSession)qs('#cloudDialog').showModal();else syncCloud({manual:true})});
qs('#cloudForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=qs('#cloudEmail').value.trim(),password=qs('#cloudPassword').value;if(!email||!password)return;try{updateCloudUI('syncing');await signInCloud(email,password);qs('#cloudPassword').value='';qs('#cloudDialog').close();toast('Trip Lah! Cloud connected')}catch(err){console.error(err);toast(err.message||'Could not sign in')}});
qs('#cloudSyncNowBtn')?.addEventListener('click',()=>syncCloud({manual:true}));
qs('#cloudDisconnectBtn')?.addEventListener('click',()=>{if(confirm('Disconnect Trip Lah! from Trip Lah! Cloud on this device?\n\nYour local trip data will stay here.'))disconnectCloud()});
qs('#cloudUseCloudBtn')?.addEventListener('click',async()=>{try{const remote=await readCloud();cloudRemoteSnapshot=remote;if(!remote)return toast('No cloud copy found');if(!confirm('Replace this device copy with the cloud copy?\n\nYour current local copy will be kept as a recovery snapshot.'))return;applyCloudPayload(remote);toast('Cloud copy loaded')}catch{toast('Could not load cloud copy')}});
qs('#cloudForcePushBtn')?.addEventListener('click',async()=>{try{const remote=await readCloud();cloudRemoteSnapshot=remote;if(!remote)return; if(!confirm('Overwrite the cloud copy with this device copy?'))return;const ok=await updateCloudCopy(Number(remote.revision||0),true);if(ok)toast('This device copy is now in cloud')}catch{toast('Could not update cloud copy')}});
window.addEventListener('online',()=>{updateCloudUI();scheduleCloudSync()});
window.addEventListener('offline',updateCloudUI);
async function initCloud(){updateCloudUI();if(cloudSession&&navigator.onLine)await syncCloud()}
initCloud();

let deferredInstallPrompt=null;
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function updateInstallUI(){
  const status=qs('#installStatus'),btn=qs('#installAppBtn');
  if(!status||!btn)return;
  if(isStandalone()){status.textContent='Installed · opens like an app';btn.disabled=true;btn.classList.add('is-disabled');return}
  btn.disabled=false;btn.classList.remove('is-disabled');
  status.textContent=isIOS()?'Safari: Share → Add to Home Screen':(deferredInstallPrompt?'Ready to install':'Add it to your Home Screen');
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallUI()});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallUI();toast('Trip Lah! installed')});
qs('#installAppBtn').addEventListener('click',async()=>{
  if(isStandalone()) return toast('Trip Lah! is already installed');
  if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;updateInstallUI();return}
  if(isIOS()) return alert('On iPhone / iPad:\n\n1. Open Trip Lah! in Safari\n2. Tap the Share button\n3. Choose “Add to Home Screen”\n4. Tap Add');
  alert('Open your browser menu and choose “Install app” or “Add to Home screen”.');
});
updateInstallUI();

async function initPWA(){
  const status=qs('#appRuntimeStatus');
  if(location.protocol==='file:'){if(status)status.textContent='Preview mode · deploy over HTTPS to enable install/offline';return}
  if(!('serviceWorker' in navigator)){if(status)status.textContent='Offline install is not supported in this browser';return}
  try{
    const reg=await navigator.serviceWorker.register('./service-worker.js');
    if(status)status.textContent=navigator.serviceWorker.controller?'Offline ready':'Offline cache preparing…';
    reg.update().catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(status)status.textContent='Offline ready'});
  }catch{if(status)status.textContent='App works, but offline cache could not start'}
}
initPWA();

qs('#resetDemo').addEventListener('click',()=>{if(!confirm('Reset Trip Lah! to the sample trip? Your current local data will be replaced.'))return;saveRecoverySnapshot();localStorage.removeItem(LS);data=normalizeData(seed);activePlaceFilter='All';selectedTodayDate='';save();toast('Demo reset · recovery snapshot saved')});
window.addEventListener('pageshow',()=>{render();updateInstallUI()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderTrip();if(cloudSession)syncCloud()}});
render();
// Open All Trips after the first paint so the initial landing route is deterministic.
window.requestAnimationFrame(()=>showView('trips'));
