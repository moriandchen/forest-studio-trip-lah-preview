(()=>{
'use strict';
const CLOUD_SESSION_LS='travelLahCloudSessionV11';
const CLOUD_META_LS='travelLahCloudMetaV11';
const DATA_LS='travelLahV1';
const RECOVERY_LS='travelLahV1Recovery';
const SUPABASE_URL='https://kxehariqixdqmtyeezrb.supabase.co';
const SUPABASE_KEY='sb_publishable_-fTWxWaGAINGBQAePgh72A_CFr86NU7';
const HAD_LOCAL_AT_START=!!localStorage.getItem(DATA_LS);
let session=loadSession(), meta=loadMeta(), remoteSnapshot=null, syncTimer=null;
const originalSave=window.save;
const $=s=>document.querySelector(s);
const note=m=>{try{if(typeof window.toast==='function')window.toast(m);else console.log(m)}catch{console.log(m)}};
function payloadNow(){try{return JSON.parse(localStorage.getItem(DATA_LS))||null}catch{return null}}
function snapshotLocal(){try{const current=payloadNow();if(current)localStorage.setItem(RECOVERY_LS,JSON.stringify({savedAt:new Date().toISOString(),data:current}))}catch{}}

function loadSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_LS))||null}catch{return null}}
function loadMeta(){try{return {...{revision:0,dirty:false,lastSyncedAt:'',conflict:false},...(JSON.parse(localStorage.getItem(CLOUD_META_LS))||{})}}catch{return {revision:0,dirty:false,lastSyncedAt:'',conflict:false}}}
function storeSession(){session?localStorage.setItem(CLOUD_SESSION_LS,JSON.stringify(session)):localStorage.removeItem(CLOUD_SESSION_LS)}
function storeMeta(){localStorage.setItem(CLOUD_META_LS,JSON.stringify(meta))}
function clearCloud(){session=null;meta={revision:0,dirty:false,lastSyncedAt:'',conflict:false};remoteSnapshot=null;localStorage.removeItem(CLOUD_SESSION_LS);localStorage.removeItem(CLOUD_META_LS);updateUI()}
function schedule(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCloud(),900)}

window.save=function(){
  originalSave();
  if(session){meta.dirty=true;storeMeta();updateUI();schedule();}
};

function injectUI(){
  const style=document.createElement('style');
  style.textContent='.cloud-pill{margin-right:8px}.cloud-pill.synced{color:#34725f;background:#eaf7f2}.cloud-pill.syncing{color:#3f7ca8;background:#eef7fd}.cloud-pill.conflict{color:#9b5b31;background:#fff3e8}.cloud-pill.offline{color:#7a8086;background:#f1f3f5}.cloud-help{font-size:12px;line-height:1.55;color:var(--muted);margin:14px 0 4px}.cloud-help.small{font-size:10px;margin-top:12px}@media(max-width:430px){.cloud-pill{max-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:9px 10px}}';
  document.head.appendChild(style);

  const mode=$('#modeBtn');
  const status=document.createElement('button');
  status.id='cloudStatusBtn';status.className='ghost-pill cloud-pill';status.type='button';status.textContent='☁ Local';
  mode.parentNode.insertBefore(status,mode);

  const tools=$('#installAppBtn')?.parentNode;
  if(tools){
    const wrap=document.createElement('div');
    wrap.innerHTML='<button id="cloudSetupBtn"><span>☁</span><div><b>Cloud Sync</b><small id="cloudMoreStatus">Local only · tap to sign in</small></div><span>→</span></button><button id="cloudSyncNowBtn" class="hidden"><span>↻</span><div><b>Sync now</b><small>Check cloud and sync this device</small></div><span>→</span></button><button id="cloudUseCloudBtn" class="hidden"><span>↓</span><div><b>Use cloud copy</b><small>Conflict only · replace this device copy</small></div><span>→</span></button><button id="cloudForcePushBtn" class="hidden"><span>⇧</span><div><b>Use this device copy</b><small>Conflict only · replace the cloud copy</small></div><span>→</span></button><button id="cloudDisconnectBtn" class="hidden"><span>⛅</span><div><b>Disconnect Cloud</b><small>Keep local data on this device</small></div><span>→</span></button>';
    [...wrap.children].forEach(x=>tools.insertBefore(x,$('#installAppBtn')));
  }

  const dialog=document.createElement('dialog');dialog.id='cloudDialog';dialog.className='modal';
  dialog.innerHTML='<form class="modal-sheet" id="cloudForm"><div class="modal-head"><h3>Forest Studio Cloud</h3><button type="button" id="cloudClose">×</button></div><p class="cloud-help">Sign in with the same Forest Studio cloud account on iPhone, iPad and Windows. Travel Lah! saves locally first, then syncs quietly when online.</p><label class="field"><span>Email</span><input id="cloudEmail" type="email" autocomplete="username" placeholder="Your Forest Studio account" required></label><label class="field"><span>Password</span><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Password" required></label><p class="cloud-help small">Your password goes directly to Supabase Auth and is never stored by Travel Lah!.</p><button type="submit" class="primary-btn wide">Sign in & Sync</button></form>';
  document.body.appendChild(dialog);

  $('#cloudClose').onclick=()=>dialog.close();
  $('#cloudStatusBtn').onclick=()=>session?document.querySelector('[data-open="more"]')?.click():dialog.showModal();
  $('#cloudSetupBtn').onclick=()=>session?syncCloud({manual:true}):dialog.showModal();
  $('#cloudSyncNowBtn').onclick=()=>syncCloud({manual:true});
  $('#cloudDisconnectBtn').onclick=()=>{if(confirm('Disconnect Forest Studio Cloud on this device?\n\nYour local trip data will stay here.'))disconnect()};
  $('#cloudUseCloudBtn').onclick=useCloudCopy;
  $('#cloudForcePushBtn').onclick=useDeviceCopy;
  $('#cloudForm').onsubmit=async e=>{
    e.preventDefault();
    const email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;
    try{await signIn(email,password);$('#cloudPassword').value='';dialog.close();note('Forest Studio Cloud connected')}
    catch(err){console.error(err);note(err.message||'Could not sign in')}
  };
}

function time(v){if(!v)return '';try{return new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function updateUI(state=''){
  const pill=$('#cloudStatusBtn'),more=$('#cloudMoreStatus');if(!pill||!more)return;
  pill.classList.remove('synced','syncing','conflict','offline');
  const signed=!!session;
  $('#cloudSyncNowBtn')?.classList.toggle('hidden',!signed);
  $('#cloudDisconnectBtn')?.classList.toggle('hidden',!signed);
  $('#cloudUseCloudBtn')?.classList.toggle('hidden',!meta.conflict);
  $('#cloudForcePushBtn')?.classList.toggle('hidden',!meta.conflict);
  if(!signed){pill.textContent='☁ Local';more.textContent='Local only · tap to sign in';return}
  if(meta.conflict){pill.textContent='☁ Conflict';pill.classList.add('conflict');more.textContent='Cloud conflict · choose which copy to keep';return}
  if(!navigator.onLine){pill.textContent='☁ Offline';pill.classList.add('offline');more.textContent='Offline · local changes are safe';return}
  if(state==='syncing'){pill.textContent='☁ Syncing';pill.classList.add('syncing');more.textContent='Syncing quietly…';return}
  if(meta.dirty){pill.textContent='☁ Pending';pill.classList.add('syncing');more.textContent='Local change waiting to sync';return}
  pill.textContent='☁ Synced';pill.classList.add('synced');more.textContent=meta.lastSyncedAt?'Synced '+time(meta.lastSyncedAt):'Connected · ready to sync';
}

async function auth(path,body){
  const r=await fetch(SUPABASE_URL+path,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.msg||j.message||j.error_description||'Cloud sign-in failed');return j;
}
async function validSession(){
  if(!session)return null;
  if(session.expiresAt&&Date.now()<session.expiresAt-60000)return session;
  try{
    const j=await auth('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refreshToken});
    session={accessToken:j.access_token,refreshToken:j.refresh_token,userId:j.user?.id||session.userId,expiresAt:Date.now()+Number(j.expires_in||3600)*1000};storeSession();return session;
  }catch{clearCloud();note('Cloud session expired · sign in again');return null}
}
async function api(path,options={}){
  const s=await validSession();if(!s)throw new Error('Not signed in');
  const r=await fetch(SUPABASE_URL+path,{...options,headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+s.accessToken,'Content-Type':'application/json',...(options.headers||{})}});
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch{j=null}if(!r.ok)throw new Error(j?.message||j?.hint||('Cloud '+r.status));return j;
}
async function readRemote(){
  const s=await validSession();if(!s)return null;
  const rows=await api('/rest/v1/travel_lah_sync?select=payload,revision,updated_at&user_id=eq.'+encodeURIComponent(s.userId));
  return rows?.[0]||null;
}
async function createRemote(){
  const s=await validSession();if(!s)return;
  const rows=await api('/rest/v1/travel_lah_sync',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:s.userId,payload:payloadNow(),revision:1})});
  const row=rows?.[0];meta={revision:Number(row?.revision||1),dirty:false,lastSyncedAt:row?.updated_at||new Date().toISOString(),conflict:false};storeMeta();updateUI();
}
async function updateRemote(baseRevision,force=false){
  const s=await validSession();if(!s)return false;
  let path='/rest/v1/travel_lah_sync?user_id=eq.'+encodeURIComponent(s.userId);
  if(!force)path+='&revision=eq.'+Number(baseRevision||0);
  const rows=await api(path,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload:payloadNow(),revision:Number(baseRevision||0)+1})});
  if(!rows?.length)return false;
  const row=rows[0];meta={revision:Number(row.revision),dirty:false,lastSyncedAt:row.updated_at||new Date().toISOString(),conflict:false};remoteSnapshot=null;storeMeta();updateUI();return true;
}
function applyRemote(row){
  snapshotLocal();
  localStorage.setItem(DATA_LS,JSON.stringify(row.payload));
  meta={revision:Number(row.revision||1),dirty:false,lastSyncedAt:row.updated_at||new Date().toISOString(),conflict:false};
  remoteSnapshot=null;storeMeta();updateUI();
  location.reload();
}
async function syncCloud({manual=false}={}){
  if(!session||!navigator.onLine)return updateUI();
  if(meta.conflict&&!manual)return updateUI();
  updateUI('syncing');
  try{
    const remote=await readRemote();
    if(!remote){await createRemote();if(manual)note('Cloud copy created');return}
    const rr=Number(remote.revision||1),lr=Number(meta.revision||0);
    if(lr===0){
      if(!HAD_LOCAL_AT_START){applyRemote(remote);if(manual)note('Cloud trip loaded');return}
      remoteSnapshot=remote;meta.conflict=true;storeMeta();updateUI();if(manual)note('Choose cloud or this device copy');return;
    }
    if(rr>lr){
      if(meta.dirty){remoteSnapshot=remote;meta.conflict=true;storeMeta();updateUI();if(manual)note('Cloud conflict found');return}
      applyRemote(remote);if(manual)note('Latest cloud trip loaded');return;
    }
    if(rr===lr&&meta.dirty){
      const ok=await updateRemote(lr,false);
      if(!ok){remoteSnapshot=await readRemote();meta.conflict=true;storeMeta();updateUI();if(manual)note('Cloud conflict found');return}
      if(manual)note('Synced');return;
    }
    if(rr===lr){meta.dirty=false;meta.lastSyncedAt=remote.updated_at||meta.lastSyncedAt;storeMeta();updateUI();if(manual)note('Already synced');return}
    if(rr<lr&&meta.dirty){await updateRemote(rr,true);if(manual)note('Synced');return}
    updateUI();
  }catch(e){console.error(e);updateUI();if(manual)note('Cloud sync failed · local copy is safe')}
}
async function signIn(email,password){
  updateUI('syncing');
  if(!payloadNow()&&typeof originalSave==='function')originalSave();
  const j=await auth('/auth/v1/token?grant_type=password',{email,password});
  session={accessToken:j.access_token,refreshToken:j.refresh_token,userId:j.user?.id,expiresAt:Date.now()+Number(j.expires_in||3600)*1000};
  meta={revision:0,dirty:HAD_LOCAL_AT_START,lastSyncedAt:'',conflict:false};storeSession();storeMeta();await syncCloud({manual:true});
}
async function disconnect(){
  try{const s=await validSession();if(s)await fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+s.accessToken}})}catch{}
  clearCloud();note('Cloud disconnected · local data kept');
}
async function useCloudCopy(){
  try{const r=remoteSnapshot||await readRemote();if(!r)return note('No cloud copy found');if(!confirm('Replace this device copy with the cloud copy?\n\nYour current local copy will be kept as a recovery snapshot.'))return;applyRemote(r);note('Cloud copy loaded')}catch{note('Could not load cloud copy')}
}
async function useDeviceCopy(){
  try{const r=remoteSnapshot||await readRemote();if(!r)return;if(!confirm('Overwrite the cloud copy with this device copy?'))return;const ok=await updateRemote(Number(r.revision||0),true);if(ok)note('This device copy is now in cloud')}catch{note('Could not update cloud copy')}
}

injectUI();updateUI();
window.addEventListener('online',()=>{updateUI();schedule()});
window.addEventListener('offline',updateUI);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session)syncCloud()});
setInterval(()=>{if(document.visibilityState==='visible'&&session&&navigator.onLine)syncCloud()},30000);
if(session&&navigator.onLine)syncCloud();
})();