/* Independent delivery verification. A successful download is not proof of current research. */
(function () {
  'use strict';
  let current=null, unavailable=false, inFlight=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idPattern=/^da-[a-f0-9]{64}$/;
  const time=v=>{if(!v||!Number.isFinite(Date.parse(v)))return 'Unknown';return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(v));};
  const labels={healthy:'Checks agree',attention:'Verification incomplete',stale:'Review overdue',failed:'Correction needed',verified:'Verified',unknown:'Not established',behind:'Behind available research',mismatch:'Mismatch',reviewed:'Reviewed',not_checked:'Not checked',not_initialized:'Not established',current:'Current at audit',completed:'Completed',in_progress:'In progress',no_update:'No update',missing:'Missing',unavailable:'Unavailable',matched:'Matched',wrong:'Wrong assignment',deployed:'In use',available_unused:'Available, not deployed',additional_license_needed:'Additional license needed',missing_or_broken:'Missing or broken',wrong_assignment:'Wrong assignment'};
  const label=v=>labels[v]||String(v||'Unknown').replace(/_/g,' ');
  const valid=v=>v&&(v.status==='not_initialized'||(v.status==='published'&&idPattern.test(v.version)&&v.ledger&&v.assessment&&Array.isArray(v.ledger.task_checks)&&v.ledger.snapshot&&v.ledger.ui&&Array.isArray(v.ledger.ui.inventory)&&Number.isFinite(Date.parse(v.reviewed_at))));
  const status=value=>unavailable?'Delivery status unavailable':!value||value.status!=='published'?'Verification pending':value.last_attempt?.status==='failed'?'Latest audit did not publish':value.freshness==='stale'?'Audit overdue':label(value.assessment?.verdict);
  const warning=value=>unavailable||value?.freshness==='stale'||value?.last_attempt?.status==='failed'||['attention','stale','failed'].includes(value?.assessment?.verdict);
  const icon=()=>'<img src="'+esc(typeof licensedIconSources!=='undefined'?licensedIconSources.evidence:'/icons/evidence.svg')+'" alt="" aria-hidden="true" class="da-icon">';
  const clocks=value=>'<div class="da-times"><span><b>Audit checked</b> '+esc(time(value?.reviewed_at))+'</span><span><b>Audit published</b> '+esc(time(value?.published_at))+'</span></div>';
  function compact(value){
    const published=value?.status==='published';
    const snap=value?.ledger?.snapshot;
    const currentVersion=typeof DATA!=='undefined'?DATA.snapshot_version:null;
    const verified=published&&!unavailable&&value.freshness!=='stale'&&value.assessment?.verdict==='healthy'&&snap?.version===currentVersion;
    const filesVerified=published&&!unavailable&&value.freshness!=='stale'&&value.assessment?.transport_integrity==='verified'&&snap?.version===currentVersion;
    const behind=published&&value.assessment?.upstream_freshness==='behind';
    const failed=published&&value.assessment?.verdict==='failed';
    return (behind&&!unavailable&&value.freshness!=='stale'&&snap?.version===currentVersion?'<p class="publication-disclosure"><strong>Publication delay:</strong> The displayed election edition was reviewed '+esc(time(snap.data_reviewed_at))+'. Newer research reviewed '+esc(time(snap.latest_available_reviewed_at))+' awaits publication. This website publication gap is separate from county reporting delays.</p>':'')+'<details data-da-detail="global"><summary><span>Update status</span><small>'+esc(unavailable?'Delivery status unavailable':behind?'Research newer than published edition':failed?'Publication or content check failed':value?.assessment?.verdict==='stale'?'Research review overdue':verified?'Delivery verified · '+time(value.reviewed_at):filesVerified?'Edition files verified · review details':'Delivery verification pending')+'</small></summary><div class="da-global-body"><p>'+esc(published?value.ledger.summary:'Delivery has not yet been independently verified.')+'</p>'+clocks(value)+'<a href="#evidence/website-delivery" data-open="evidence" data-scroll="website-delivery">View verification details ↗</a></div></details>';
  }
  function inventoryHTML(ui){
    return '<div class="da-inventory">'+(ui?.inventory||[]).filter(item=>item&&item.stock_id).map(item=>'<article><div><b>Adobe Stock '+esc(item.stock_id)+'</b><span class="da-pill">'+esc(label(item.status))+'</span></div><p>'+esc(item.note)+'</p></article>').join('')+'</div>';
  }
  function full(value){
    const published=value?.status==='published', l=value?.ledger, a=value?.assessment||{};
    const scheduleState=l?.schedule?.enabled===true?'Enabled':l?.schedule?.enabled===false?'Paused':'Not yet confirmed';
    const head='<div class="section-head"><div><div class="eyebrow">OUR OWN REPORTING · THE SAME STANDARD</div><h2>'+icon()+'<span>Website delivery</span></h2><p>Does the published dashboard match the available research and the intended design?</p></div><span class="da-state'+(warning(value)?' da-attention':'')+'">'+esc(status(value))+'</span></div>'+clocks(value)+'<p class="da-small"><b>Audit schedule · '+scheduleState+':</b> Hourly · America/Chicago. An audit time is separate from source, research and publication times.</p>';
    if(!published)return head+'<div class="da-empty"><b>No completed delivery audit is available in this view.</b><p>Research freshness, published-file consistency, factual agreement and icon delivery remain unverified here.</p></div>';
    const cards=[['Published files',a.transport_integrity],['Research freshness',a.upstream_freshness],['Website assets',a.asset_integrity],['Content agreement',a.factual_agreement]];
    const matrix='<div class="da-check-grid">'+cards.map(([title,verdict])=>'<div><span>'+title+'</span><b>'+esc(label(verdict))+'</b></div>').join('')+'</div>';
    const issues=(a.reasons||[]).length?'<ul class="da-reasons">'+a.reasons.map(r=>'<li>'+esc(r)+'</li>').join(''):'<p class="da-small">The checks recorded in this audit agree. This is a dated assessment, not a guarantee about later changes.</p>';
    const snapshot=l.snapshot,artifactRows=(snapshot.artifacts||[]).map(item=>'<div class="da-row"><span>'+esc({data:'Dashboard data',png:'PNG summary',report:'Companion report'}[item.asset]||item.asset)+'</span><b>'+esc(label(item.status))+(item.status==='verified'&&item.expected_sha256!==item.actual_sha256?' · hash mismatch':'')+'</b></div>').join('');
    const taskRows=(l.task_checks||[]).map(item=>'<article class="da-task"><div><b>'+esc(item.title)+'</b><span class="da-pill">'+esc(label(item.last_run_status))+'</span></div><div class="da-times"><span><b>Task checked</b> '+esc(time(item.checked_at))+'</span><span><b>Recorded completion</b> '+esc(time(item.completed_at))+'</span></div><p>'+esc(item.evidence)+'</p></article>').join('');
    const uiAssets=Array.isArray(l.ui.assets)?l.ui.assets:(l.ui.inventory||[]).map(item=>({role:'published file',path:item.path,status:item.match?'verified':(item.http===200?'mismatch':'unavailable'),assignment:item.match?'verified':'unverified'}));
    const uiIssues=(l.ui.issues||[]).map(item=>typeof item==='string'?{category:'asset',description:'Served file does not match the edition manifest.',asset:item}:item);
    const assetIssues=uiIssues.length?'<ul class="da-reasons">'+uiIssues.map(item=>'<li><b>'+esc(label(item.category))+':</b> '+esc(item.description)+(item.asset?' <span class="da-path">'+esc(item.asset)+'</span>':'')+'</li>').join('')+'</ul>':'<p class="da-small">No separate asset issue is recorded in this audit; see whether delivery and assignment were actually checked below.</p>';
    const assetRows=uiAssets.map(item=>'<div class="da-row da-asset-row"><div><span>'+esc(item.role)+'</span><small>'+esc(item.path)+'</small></div><div><b>'+esc(label(item.status))+'</b><small>Assignment: '+esc(label(item.assignment))+'</small></div></div>').join('');
    return head+'<p class="da-lead">'+esc(l.summary)+'</p>'+matrix+issues+(unavailable?'<p class="da-warning-note">The latest audit lookup could not be verified. This previous audit and its dates are retained.</p>':'')+
      '<details class="da-detail" data-da-detail="edition"><summary>Published edition and research delivery</summary><div class="da-times"><span><b>Election data review</b> '+esc(time(snapshot.data_reviewed_at))+'</span><span><b>Election publication</b> '+esc(time(snapshot.published_at))+'</span><span><b>Latest available research review</b> '+esc(time(snapshot.latest_available_reviewed_at))+'</span></div><p class="da-small">'+esc(snapshot.upstream_evidence||'The latest available research package has not been established.')+'</p>'+artifactRows+'<p class="da-small"><b>Content agreement:</b> '+esc(l.factual_agreement?.evidence||'Not checked')+'</p><div class="da-times"><span><b>Reporting Transparency review</b> '+esc(time(l.reporting?.reviewed_at))+'</span><span><b>Delivery status</b> '+esc(label(l.reporting?.status))+'</span></div></details>'+
      '<details class="da-detail" data-da-detail="tasks"><summary>Scheduled research checks · '+(l.task_checks||[]).length+'</summary>'+taskRows+'</details>'+
      '<details class="da-detail" data-da-detail="design"><summary>Design assets and licensed inventory</summary><div class="da-times"><span><b>Asset check</b> '+esc(time(l.ui.checked_at))+'</span><span><b>Design release</b> '+esc(l.ui.release||'Not verified')+'</span></div>'+inventoryHTML(l.ui)+assetIssues+'<details class="da-inner-detail" data-da-detail="asset-files"><summary>Individual asset checks · '+uiAssets.length+'</summary>'+assetRows+'</details></details>'+
      ((l.notes||[]).length?'<details class="da-detail" data-da-detail="limits"><summary>Audit limits and notes</summary><ul class="da-reasons">'+l.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></details>':'')+
      '<a class="da-download" href="/delivery-audit.json?version='+encodeURIComponent(value.version)+'">Download this delivery audit <span aria-hidden="true">↓</span></a>';
  }
  function replace(node,html){
    if(!node||node.dataset.daMarkup===html)return;
    const open=[...node.querySelectorAll('details[open][data-da-detail]')].map(d=>d.dataset.daDetail),active=document.activeElement;
    const focus=node.contains(active)?active.closest('details[data-da-detail]')?.dataset.daDetail:null;
    node.innerHTML=html;node.dataset.daMarkup=html;
    node.querySelectorAll('details[data-da-detail]').forEach(d=>{if(open.includes(d.dataset.daDetail))d.open=true;if(focus===d.dataset.daDetail)d.querySelector('summary')?.focus({preventScroll:true});});
  }
  function mount(){
    let global=document.getElementById('delivery-assurance');
    if(!global){const anchor=document.getElementById('snapshot-status')||document.querySelector('nav.nav');if(anchor){global=document.createElement('aside');global.id='delivery-assurance';global.setAttribute('aria-label','Independent website delivery assurance');global.dataset.independentTimestamps='true';anchor.append(global);}}
    replace(global,compact(current));replace(document.getElementById('website-delivery'),full(current));
    const destination=global?.querySelector('a[data-open]');if(destination)destination.onclick=event=>{if(typeof showTab==='function'&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();showTab('evidence',true,{section:'website-delivery'});}};
    document.querySelectorAll('[data-delivery-navigation-time]').forEach(n=>n.textContent='Audit checked · '+time(current?.reviewed_at));
  }
  async function refresh(initial=false){
    if(inFlight||(!initial&&document.hidden))return;inFlight=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{const r=await fetch('/api/delivery-status',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Unavailable');const value=await r.json();if(!valid(value)||current?.status==='published'&&(value.status!=='published'||Date.parse(value.reviewed_at)<Date.parse(current.reviewed_at)))throw Error('Unverified');current=value;unavailable=false;}catch{unavailable=true;}finally{clearTimeout(timeout);inFlight=false;mount();}
  }
  window.DeliveryAudit={mount,refresh};
  if(window.__DELIVERY_TEST__)window.DeliveryAudit.test={valid,compact,full,inventoryHTML,getCurrent:()=>current,setCurrent:value=>{current=value;unavailable=false;},unavailable:()=>unavailable};
  mount();refresh(true);setInterval(()=>refresh(),60000);
  document.addEventListener('civic:render',mount);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}());
