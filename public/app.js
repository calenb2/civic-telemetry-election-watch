'use strict';
const $=s=>document.querySelector(s),fmt=v=>v==null?'Not verified':Number(v).toLocaleString('en-US'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let DATA, activeTab='overview', countyName='Dallas', REFRESH={}, SNAPSHOT_VERSION=null, usingFallback=false, refreshError=null, refreshInFlight=false;
const primary=['Dallas','Tarrant','Travis','Harris','Bexar','El Paso','Lubbock'];
const modeLabel={total:'In person + mail',ip:'Early in person',mail:'Mail (source-defined)'};
const rate=(n,d)=>n!=null&&d?`${(n/d*100).toFixed(2)}%`:'Not verified';
const editionURL=path=>{const version=DATA?.snapshot_version??DATA?.version;return version?path+'?version='+encodeURIComponent(version):path.replace(/^(\/?)(snapshot\.png|notes\.md|data\.json)$/, '$1fallback-$2')};
const safeURL=url=>{if(typeof url!=='string'||!url.trim())return null;try{const u=new URL(url,location.origin);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
const link=(url,label='View source ↗')=>{const href=safeURL(url);return href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:''};
const select=(id,label,options,current)=>`<label>${label}<select id="${id}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const intro=(eyebrow,title,sub)=>`<div class="intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div><div class="review-stamp"><b>${esc(DATA.reviewed_at||'Review time unavailable')}</b>Checked every two hours through November 3; every 12 hours beginning November 4. Each figure retains its source reporting cutoff.</div></div>`;
const scopeStyle=a=>/Democratic-favorable/i.test(a.balance)?'blue':/Republican-favorable/i.test(a.balance)?'red':/Mixed/i.test(a.balance)?'amber':'gray';
const assessments=()=>['Senate','Governor','Broader Texas'].map(scope=>(DATA.assessments||[]).find(a=>a.scope===scope)||{scope,balance:'Insufficient evidence',stage:'Assessment unavailable',movement:'not comparable',strength:'Low'});
const scopeHTML=(interactive=false)=>`<div class="scope-grid ${interactive?'summary-scopes':''}" aria-label="Analytical race assessments">${assessments().map(a=>{const tag=interactive?'button':'article',target=a.scope==='Broader Texas'?'evidence':'polling';return `<${tag} class="scope-card ${interactive?'scope-link ':''}${scopeStyle(a)}" ${interactive?'data-open="'+target+'"':''}><span class="scope-title">${esc(a.scope)}${interactive?' <span aria-hidden="true">↗</span>':''}</span><strong>${esc(a.balance)}</strong><span class="scope-description">${esc(a.stage)}</span><span class="scope-meta"><span>Movement: ${esc(a.movement)}</span><span>Evidence: ${esc(a.strength)}</span></span>${interactive?'<span class="scope-action">'+(target==='polling'?'Explore candidate polling':'Inspect the seven signals')+'</span>':''}</${tag}>`}).join('')}</div>`;
const scopeCards=()=>scopeHTML(false);
const sharedCountyCutoff=(names=primary)=>{const cutoffs=[...new Set(DATA.counties.filter(c=>names.includes(c.name)).map(c=>c.cutoff||'Cutoff unverified'))];return cutoffs.length===1?'Shared date label: '+cutoffs[0]+'; exact cutoffs unverified':'Mixed county cutoffs — see each bar'};
const raceMovement=()=>{const a=assessments(),moves=a.map(x=>x.movement);return moves.every(m=>m==='unchanged')?'Race reads unchanged.':moves.some(m=>m==='toward D'||m==='toward R')?'Race assessments updated.':'Race movement not comparable.'};
const evidenceText=party=>{const p=DATA.polls||[],out=[];for(const [key,label] of [['sen','Senate'],['gov','Governor']]){const margins=p.map(x=>party==='D'?x[key+'D']-x[key+'R']:x[key+'R']-x[key+'D']).filter(v=>Number.isFinite(v)&&v>0);if(margins.length){const min=Math.min(...margins),max=Math.max(...margins);out.push(`${label}: featured ${party} leads of ${min===max?min:min+'–'+max} points.`)}}return out.join(' ')||'No favorable candidate lead appears in the featured polls.'};
const pollPeriods=()=>[...new Set((DATA.polls||[]).map(p=>`${p.name}: field ${p.field}; release ${p.published}${p.publication_time?' '+p.publication_time:' (time unverified)'}`))].join(' · ');
const centralTime=value=>{if(!value)return 'Not yet verified';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'}).format(d)+' Central'};

const legend=()=>`<div class="legend"><span class="d">Democratic-favorable</span><span class="r">Republican-favorable</span><span class="mixed">Mixed / no clear advantage</span><span>Insufficient evidence</span></div><p class="small">Colors describe evidence within its stated scope. Gray means missing, stale, unverified or incomparable data, not a neutral result.</p>`;
// A single destination registry keeps desktop disclosures, mobile navigation and
// fragment links aligned. Icons are decorative companions to explicit labels.
const navigationPages=[
 {id:'overview',label:'At a glance',sections:[
  ['Statewide participation','statewide-participation','.summary-total'],
  ['Race assessments','overview-assessments','.assessment-label'],
  ['Seven-county comparison','overview-counties','.summary-counties'],
  ['Daily reports','overview-daily','.summary-daily'],
  ['County coverage','overview-coverage','.coverage-summary'],
  ['Next checkpoint','overview-checkpoint','.summary-next']]},
 {id:'counties',label:'County explorer',sections:[
  ['Selected county','county-observation',':scope > .panel:nth-of-type(1)'],
  ['Daily voting','county-daily-section',':scope > .panel:nth-of-type(2)'],
  ['County comparison','county-comparison',':scope > .panel:nth-of-type(3)']],crossLinks:[['Reporting transparency','evidence','reporting-transparency'],['All-county coverage','evidence','coverage-roster']]},
 {id:'polling',label:'Polling',sections:[
  ['Senate & governor margins','candidate-margins',':scope > .panel'],
  ['Pollster methods & sources','poll-methods',':scope > .panel details'],
  ['Race assessments','polling-assessments',':scope > .scope-grid']]},
 {id:'history',label:'Historical context',sections:[
  ['Matched-day comparison','history-comparison',':scope > .panel'],
  ['Comparison sources','historical-sources','.history-sources']]},
 {id:'evidence',label:'Evidence & sources',sections:[
  ['Seven signals','signal-scorecard',':scope > .panel'],
  ['Reporting transparency','reporting-transparency','#reporting-transparency'],
  ['Website delivery','website-delivery','#website-delivery'],
  ['All-county coverage','coverage-roster','#coverage-roster'],
  ['Primary history','primary-history','.composition-stack'],
  ['Original baseline','original-baseline','.county-kpis'],
  ['Observation rules','observation-rules','#observation-rules'],
  ['Source register','source-register','#source-register']]}
];
const uiRelease=document.querySelector('meta[name="civic-ui-version"]')?.getAttribute?.('content')||'';
const licensedIconSources=Object.freeze(Object.fromEntries(['overview','counties','polling','history','evidence','participation','daily','comparison','coverage','baseline','checkpoint'].map(name=>[name,'/icons/'+name+'.svg'+(uiRelease?'?v='+encodeURIComponent(uiRelease):'')])));
const sectionIconNames=Object.freeze({
 'statewide-participation':'participation','overview-assessments':'polling',
 'overview-counties':'comparison','overview-daily':'daily','overview-coverage':'coverage','overview-checkpoint':'checkpoint',
 'county-observation':'counties','county-daily-section':'daily','county-comparison':'comparison',
 'candidate-margins':'polling','poll-methods':'evidence','polling-assessments':'polling',
 'history-comparison':'history','historical-sources':'evidence','signal-scorecard':'evidence',
 'coverage-roster':'coverage','primary-history':'participation','original-baseline':'baseline',
 'observation-rules':'evidence','source-register':'evidence','reporting-transparency':'evidence','website-delivery':'evidence'
});
function mountLicensedIcon(slot,name){
 const src=licensedIconSources[name];
 if(!src){slot.hidden=true;return;}
 if(slot.dataset.iconAsset===name&&slot.querySelector('img'))return;
 slot.hidden=true;slot.dataset.iconAsset=name;
 const img=document.createElement('img');img.alt='';img.setAttribute('aria-hidden','true');img.width=28;img.height=28;img.decoding='async';
 img.onload=()=>{if(slot.firstElementChild===img)slot.hidden=false;};
 img.onerror=()=>{if(slot.firstElementChild===img)slot.hidden=true;};
 slot.replaceChildren(img);img.src=src;
}
function mountNavigationIcons(){
 document.querySelectorAll('[data-navigation-icon]').forEach(slot=>mountLicensedIcon(slot,slot.dataset.navigationIcon));
 const current=document.getElementById('mobile-current-icon');
 if(current)mountLicensedIcon(current,activeTab);
}
let activeSection=null,navigationReady=false;
function parseNavigationHash(hash){
 const [page,section,...rest]=String(hash||'').replace(/^#/,'').split('/');
 const entry=navigationPages.find(p=>p.id===page);
 return entry&&!rest.length?{page:entry.id,section:entry.sections.some(s=>s[1]===section)?section:null}:{page:'overview',section:null};
}
function navigationHash(page,section){return '#'+page+(section?'/'+section:'')}
function closeNavigationMenus(returnFocus=false){
 document.querySelectorAll('[data-navigation-toggle][aria-expanded="true"]').forEach(button=>{
  button.setAttribute('aria-expanded','false');
  const panel=document.getElementById(button.getAttribute('aria-controls'));
  if(panel)panel.hidden=true;
  if(returnFocus)button.focus({preventScroll:true});
 });
}
function updateNavigationState(){
 document.querySelectorAll('[data-navigation-page]').forEach(link=>{
  const current=link.dataset.navigationPage===activeTab;
  link.classList.toggle('active',current);
  if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
 document.querySelectorAll('[data-navigation-section]').forEach(link=>{
  if(link.dataset.navigationPage===activeTab&&link.dataset.navigationSection===activeSection)link.setAttribute('aria-current','location');
  else link.removeAttribute('aria-current');
 });
 const label=document.getElementById('mobile-current-page');
 if(label)label.textContent=navigationPages.find(p=>p.id===activeTab)?.label||'At a glance';
 mountNavigationIcons();
}
function prepareNavigationAnchors(){
 if(!navigationReady)return;
 for(const entry of navigationPages){
  const page=document.getElementById(entry.id);if(!page)continue;
  const heading=page.querySelector('h1');
  if(heading){heading.id=entry.id+'-heading';heading.tabIndex=-1;page.setAttribute('aria-labelledby',heading.id);}
  for(const [label,id,selector] of entry.sections){
   let node=page.querySelector(selector);
   if(node&&['primary-history','original-baseline'].includes(id))node=node.closest('.panel');
   if(node){node.id=id;node.tabIndex=-1;node.classList.add('navigation-anchor');node.setAttribute('aria-label',label);}
   document.querySelectorAll('[data-navigation-section="'+id+'"]').forEach(link=>{
    link.hidden=!node;
   });
  }
  // County/filter redraws can replace heading text. Remount idempotently, using
  // the enclosing section rather than the heading's own dynamic ID.
  page.querySelectorAll('h2').forEach(heading=>{
   if(heading.closest('[data-independent-timestamps="true"]'))return;
   let slot=heading.querySelector('.section-icon-slot');
   if(!slot){
    const text=document.createElement('span');text.className='section-heading-text';
    while(heading.firstChild)text.append(heading.firstChild);
    slot=document.createElement('span');slot.className='section-icon-slot';slot.hidden=true;slot.setAttribute('aria-hidden','true');
    heading.append(slot,text);heading.classList.add('icon-heading');
   }
   const section=heading.closest('.navigation-anchor')?.id||entry.id;
   slot.dataset.sectionIcon=section;
   mountLicensedIcon(slot,sectionIconNames[section]||entry.id);
  });
 }
}
function buildNavigation(){
 if(navigationReady)return;
 const root=document.getElementById('dashboard-navigation');if(!root)return;
 const slot=id=>'<span class="nav-icon-slot" data-navigation-icon="'+id+'" hidden aria-hidden="true"></span>';
 const time='<small class="tab-time" data-navigation-time></small>';
 const sectionLinks=entry=>[...entry.sections.map(([label,id])=>[label,entry.id,id]),...(entry.crossLinks||[])].map(([label,page,id])=>'<a href="'+navigationHash(page,id)+'" data-navigation-page="'+page+'" data-navigation-section="'+id+'">'+esc(label)+(id==='reporting-transparency'?'<small data-reporting-navigation-time>Reporting review · loading</small>':id==='website-delivery'?'<small data-delivery-navigation-time>Audit checked · loading</small>':'')+'</a>').join('');
 root.innerHTML='<div class="nav-inner">'+navigationPages.map(entry=>'<div class="nav-destination"><a class="nav-tab" id="nav-'+entry.id+'" href="#'+entry.id+'" data-navigation-page="'+entry.id+'">'+slot(entry.id)+'<span class="nav-label">'+esc(entry.label)+time+'</span></a><button type="button" class="nav-disclosure" id="nav-toggle-'+entry.id+'" data-navigation-toggle aria-expanded="false" aria-controls="nav-sections-'+entry.id+'" aria-label="Sections in '+esc(entry.label)+'"><span class="navigation-chevron" aria-hidden="true"></span></button><div class="navigation-panel" id="nav-sections-'+entry.id+'" hidden><div class="navigation-panel-heading">'+esc(entry.label)+time+'</div>'+sectionLinks(entry)+'</div></div>').join('')+'</div><div class="mobile-navigation"><button type="button" class="mobile-navigation-toggle" id="mobile-navigation-toggle" data-navigation-toggle aria-controls="mobile-navigation-panel" aria-expanded="false"><span class="mobile-current-destination"><span id="mobile-current-icon" class="nav-icon-slot" hidden aria-hidden="true"></span><span class="mobile-current-copy"><span class="navigation-kicker">Explore dashboard</span><strong id="mobile-current-page">At a glance</strong>'+time+'</span></span><span class="navigation-chevron" aria-hidden="true"></span></button><div class="mobile-navigation-panel" id="mobile-navigation-panel" hidden>'+navigationPages.map(entry=>'<div class="mobile-navigation-group"><a class="mobile-page-link" id="mobile-nav-'+entry.id+'" href="#'+entry.id+'" data-navigation-page="'+entry.id+'">'+slot(entry.id)+'<span>'+esc(entry.label)+time+'</span></a><div class="mobile-section-links">'+sectionLinks(entry)+'</div></div>').join('')+'</div></div>';
 root.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-navigation-toggle]');
  if(toggle){
   const open=toggle.getAttribute('aria-expanded')!=='true';
   closeNavigationMenus();toggle.setAttribute('aria-expanded',String(open));
   document.getElementById(toggle.getAttribute('aria-controls')).hidden=!open;
   return;
  }
  const link=event.target.closest('a[data-navigation-page]');
  if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();showTab(link.dataset.navigationPage,true,{section:link.dataset.navigationSection||null});
 });
 document.addEventListener('click',event=>{if(!root.contains(event.target))closeNavigationMenus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.querySelector('[data-navigation-toggle][aria-expanded="true"]')){event.preventDefault();closeNavigationMenus(true);}});
 document.addEventListener('focusin',event=>{if(!root.contains(event.target))closeNavigationMenus();});
 const breakpoint=window.matchMedia?.('(max-width: 800px)');
 breakpoint?.addEventListener('change',()=>closeNavigationMenus());
 navigationReady=true;updateNavigationState();
}
function showTab(name,scroll=true,options={}){
 const entry=navigationPages.find(p=>p.id===name);if(!entry)return;
 const section=entry.sections.some(s=>s[1]===options.section)?options.section:null;
 activeTab=name;activeSection=section;
 document.querySelectorAll('.page').forEach(page=>page.hidden=page.id!==name);
 refreshTimeLabels();updateNavigationState();
 if(options.closeMenus!==false)closeNavigationMenus();
 const fragment=navigationHash(name,section);
 if(options.history!=='none'&&location.hash!==fragment)history.pushState(null,'',fragment);
 const page=document.getElementById(name),target=(section?document.getElementById(section):null)||page?.querySelector('h1');
 if(section&&target?.tagName==='DETAILS')target.open=true;
 if(scroll){if(section&&target)target.scrollIntoView({behavior:'instant',block:'start'});else window.scrollTo({top:0,behavior:'instant'});}
 if(options.focus??scroll)target?.focus({preventScroll:true});
}
function followNavigationHistory(){
 if(!DATA)return;
 const requested=parseNavigationHash(location.hash);
 if(requested.page===activeTab&&requested.section===activeSection)return;
 showTab(requested.page,true,{section:requested.section,history:'none'});
}
window.addEventListener?.('popstate',followNavigationHistory);
window.addEventListener?.('hashchange',followNavigationHistory);
function barsHTML(rows,mode,sort='volume',metric='count'){const value=c=>metric==='rate'?(c[mode]!=null&&c.registered?c[mode]/c.registered*100:null):c[mode],list=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):(value(b)??-1)-(value(a)??-1)),max=Math.max(...list.map(c=>value(c)||0),1);return list.map(c=>{const v=value(c),label=v==null?'Not verified':metric==='rate'?v.toFixed(2)+'%':fmt(v);return `<div class="county-bar"><button class="county-name" data-county="${esc(c.name)}">${esc(c.name)}<small>${esc(c.city||'County detail')} ↗</small></button><button class="track county-chart-link" data-county="${esc(c.name)}" title="${esc(c.name)}: ${label}" aria-label="Explore ${esc(c.name)} County, ${label}"><span class="fill" style="width:${v==null?0:v/max*100}%;min-width:0;display:block"></span></button><div class="bar-value">${label}<small>${esc(c.cutoff)}</small></div></div>`}).join('')}
function wireCountyLinks(){document.querySelectorAll('[data-county]').forEach(b=>b.onclick=()=>{countyName=b.dataset.county;renderCounty();showTab('counties')})}
function coverageSummary(){const c=DATA.coverage;if(!c)return '';const k=c.counts,observed=(k.official_observation||0)+(k.publisher_only||0);return `<section class="coverage-summary"><div><span class="eyebrow">COUNTY COVERAGE / TRANSPARENT BY DESIGN</span><h2>${observed} of ${c.county_count} counties have a detail record.</h2><p>The statewide publisher total is broader. County-level verification is a separate, ongoing review.</p></div><div class="coverage-metrics"><span><b>${k.official_observation||0}</b>Official observation</span><span><b>${k.publisher_only||0}</b>Publisher only</span><span><b>${k.not_yet_reviewed||0}</b>Not yet reviewed</span></div><button class="text-button" data-open="evidence" data-scroll="coverage-roster">Search all ${c.county_count} county statuses →</button><small>“Official observation” does not mean all voting modes, dates or historical comparisons are complete.</small></section>`}
function coverageRosterHTML(){const c=DATA.coverage;if(!c)return '';return `<section class="panel" id="coverage-roster"><div class="section-head"><div><div class="eyebrow">ALL ${c.county_count} TEXAS COUNTIES</div><h2>Coverage is visible, including the gaps.</h2><p>Search the official county roster. Available observations link to detail; unreviewed counties retain an explicit status.</p></div><span class="badge">Coverage register</span></div><div class="roster-controls"><label for="coverage-search">Find a county<input id="coverage-search" type="search" placeholder="County name or FIPS code" autocomplete="off"></label>${select('coverage-status','Status',[['all','All statuses'],['official_observation','Official observation'],['publisher_only','Publisher only'],['not_yet_reviewed','Not yet reviewed']],'all')}</div><div class="roster-result-count" id="coverage-result-count" aria-live="polite"></div><div class="coverage-roster-list" id="coverage-roster-list"></div><p class="panel-note">A source record is not a claim of complete county coverage. In-person, mail and daily records are tracked separately. Missing data remain unmeasured; no zero counts are inferred.</p><p class="source-line">Official county roster: ${link(c.roster_source?.url,c.roster_source?.name||'View roster ↗')} · <a href="/coverage.json" download>Download the coverage register ↗</a></p></section>`}
function wireCoverage(){if(!DATA.coverage||!$('#coverage-search'))return;const draw=()=>{const q=$('#coverage-search').value.trim().toLowerCase(),status=$('#coverage-status').value,rows=DATA.coverage.counties.filter(c=>(status==='all'||c.current_status===status)&&(!q||c.name.toLowerCase().includes(q)||c.fips.includes(q)));$('#coverage-result-count').textContent=`${rows.length} of ${DATA.coverage.county_count} counties`;$('#coverage-roster-list').innerHTML=rows.length?rows.map(c=>{const known=DATA.counties.some(x=>x.name===c.name),m=c.current_mode_coverage||{},modes=[m.in_person?'In person':null,m.mail?'Mail':null,m.daily_in_person?'Daily in person':null].filter(Boolean).join(' · ');return `<article class="roster-record"><div><strong>${esc(c.name)} County</strong><small>FIPS ${esc(c.fips)}</small></div><div class="roster-status"><span class="roster-state ${esc(c.current_status)}">${esc(c.current_status_label)}</span><small>${esc(c.current_cutoff||'No county observation reviewed yet')}${modes?'<br>'+esc(modes):''}</small></div>${known?`<button class="text-button" data-county="${esc(c.name)}">Open detail →</button>`:`<span class="roster-pending">Review pending</span>`}</article>`}).join(''):'<div class="empty"><b>No matching counties.</b>Try another name or status.</div>';wireCountyLinks()};$('#coverage-search').oninput=draw;$('#coverage-status').onchange=draw;draw()}
function summaryScopes(){return scopeHTML(true)}
function chartDay(value){return String(value).replace(/^\d{4}-\d{2}-0?/, '').replace('Oct ','')}
function summaryDaily(county,max){const c=DATA.counties.find(x=>x.name===county),r=c?.latest;if(!r||!Array.isArray(r.daily_values))return '';const vals=r.daily_values.filter(x=>!x.partial),last=vals[vals.length-1];if(!last)return ''; return `<article class="daily-brief"><div class="daily-brief-heading"><h3>${esc(county)}</h3><span><strong>${fmt(r.ip)}</strong> cumulative in person</span></div><p class="daily-brief-latest">${esc(last.date)}: <b>${fmt(last.value)}</b> in person <span class="badge">Completed day</span></p><button class="daily-drill" data-county="${esc(county)}" aria-label="Explore ${esc(county)} County daily counts and source"><span class="mini-axis"><span>${fmt(max)}</span><span>${fmt(max/2)}</span><span>0</span></span><span class="mini-chart">${vals.map((v,i)=>`<span class="mini-day"><span class="mini-count">${fmt(v.value)}</span><span class="mini-plot"><span class="mini-fill ${i===vals.length-1?'latest':''}" style="height:${v.value/max*100}%"></span></span><span class="mini-date">${esc(chartDay(v.date))}</span></span>`).join('')}</span></button><div class="daily-brief-foot"><span>October ${esc(chartDay(vals[0].date))}–${esc(chartDay(last.date))} · zero-based, common scale</span><button class="text-button" data-county="${esc(county)}">Explore county →</button></div><p class="source-line">${esc(r.classification)} · ${link(r.source,'County report ↗')}</p></article>`}
function renderOverview(){const s=DATA.statewide,delta=s.prior_total==null?null:s.total-s.prior_total,dayCounties=['Harris','Tarrant'],dailyMax=Math.ceil(Math.max(...dayCounties.flatMap(n=>(DATA.counties.find(c=>c.name===n)?.latest?.daily_values||[]).filter(v=>!v.partial).map(v=>v.value)),1)/20000)*20000,hasOfficial=DATA.counties.filter(c=>c.latest).length;
$('#overview').innerHTML=`<div class="summary-heading"><div><div class="eyebrow">THE TEXAS ELECTION BRIEFING</div><h1>${(s.total/1e6).toFixed(2)} million logged.<br><span>${esc(DATA.headline||raceMovement())}</span></h1><p>A statewide picture, with the evidence one click away.</p></div><div class="summary-heading-side"><div class="review-stamp"><b>${esc(DATA.reviewed_at)}</b>Checked every two hours through November 3; every 12 hours beginning November 4. Each figure retains its source reporting cutoff.</div><a class="download-link" href="/snapshot.png" download>Download the PNG <span aria-hidden="true">↓</span></a></div></div>
<div class="reading-key" aria-label="How to read this briefing"><span><i class="key-observed"></i>Reported participation</span><span><i class="key-poll"></i>Pollster measurements</span><span><i class="key-read"></i>Analytical interpretation</span><button class="text-button" data-open="evidence">Source standards →</button></div>
<section class="summary-total"><div class="summary-section-title"><span>01 / STATEWIDE PARTICIPATION</span><span class="badge">${delta===0?'Unchanged publisher release':'Dated publisher snapshot'}</span></div><div class="summary-total-top"><div><div class="total">${fmt(s.total)}</div><p>Reported early voters · in person + mail</p></div><div class="summary-delta"><strong>${delta==null?'Not comparable':(delta>0?'+':'')+fmt(delta)}</strong><span>Change from saved publisher total</span><small>Compared with ${esc(DATA.baseline)}</small></div></div><button class="mode-drill" data-open="evidence" aria-label="Inspect statewide in-person and mail totals and source methodology"><span class="mode-track"><span style="width:${s.in_person/s.total*100}%"></span><span style="width:${s.mail/s.total*100}%"></span></span><span class="mode-labels"><span><strong>In person ${fmt(s.in_person)}</strong><small>${(s.in_person/s.total*100).toFixed(2)}% of reported total</small></span><span><strong>Mail ${fmt(s.mail)}</strong><small>${(s.mail/s.total*100).toFixed(2)}% of reported total</small></span></span></button><div class="summary-total-footer"><p><b>${esc(s.classification)}</b> · publisher date ${esc(s.as_of)}. ${esc(s.cutoff)}. Newer county reports remain separate.</p><button class="text-button" data-open="evidence">Trace the data →</button></div><details class="compact-detail"><summary>Registration-adjusted participation and cutoff limits</summary><p>Calculated participation: ${rate(s.total,s.registered)} of ${fmt(s.registered)} SOS November registered voters, including suspense. The count retains mixed reporting cutoffs. This is not a verified, same-cutoff official aggregate for every county.</p><p>${link(s.source,'Publisher snapshot ↗')} · ${link(s.registered_source,'Texas SOS registration ↗')}</p></details></section>
<div class="assessment-label"><span>02 / THE CURRENT READ</span><span>Analytical interpretation · not a race forecast</span></div>${summaryScopes()}
<section class="panel summary-counties"><div class="summary-section-title"><span>03 / SEVEN-COUNTY COMPARISON</span><span class="badge">${esc(sharedCountyCutoff())}</span></div><div class="section-head"><div><h2>Where the reported votes are.</h2><p>Shared publisher snapshot. Select a county for its latest verified detail.</p></div><div class="controls">${select('overview-mode','Voting mode',Object.entries(modeLabel),'total')}${select('overview-metric','Measure',[['count','Voters'],['rate','% registered']],'count')}${select('overview-sort','Sort',[['volume','Highest value'],['name','County name']],'volume')}</div></div><div class="bar-column-head"><span>County / principal city</span><span id="overview-measure-label">Reported voters</span></div><div id="overview-bars" class="county-bars"></div><div class="chart-bottom-note"><p>Neutral bar colors describe participation, not party preference.</p><button class="text-button" data-open="counties">Explore all ${DATA.counties.length} monitored counties →</button></div><details class="compact-detail"><summary>Sources, coverage and registration denominators</summary><p>Publisher-reproduced counts. ${esc(sharedCountyCutoff())}. Rates use SOS November registration, including suspense. These seven counties are a selected comparison, not all of Texas. City names identify principal cities, not complete municipal boundaries. ${hasOfficial} of the ${DATA.counties.length} monitored counties also have a separately documented official-source observation.</p><p>${link(s.source,'Publisher data ↗')} · ${link(s.registered_source,'Texas SOS registration ↗')}</p></details></section>
<section class="panel summary-daily"><div class="summary-section-title"><span>04 / NEWER COUNTY REPORTS</span><span class="badge">Official sources · separate cutoffs</span></div><div class="section-head"><div><h2>The completed-day participation record.</h2><p>Completed daily in-person counts. Select either chart to examine its source and totals.</p></div></div><div class="summary-daily-grid">${dayCounties.map(n=>summaryDaily(n,dailyMax)).join('')}</div><p class="panel-note">Newer official county counts are not substituted into the statewide publisher snapshot. Source revisions and reporting differences remain visible in county detail.</p></section>
<div class="evidence-brief"><button class="evidence-brief-card blue" data-open="polling"><span>Supports Democrats <b aria-hidden="true">↗</b></span><p>${esc(evidenceText('D'))}</p></button><button class="evidence-brief-card red" data-open="polling"><span>Supports Republicans <b aria-hidden="true">↗</b></span><p>${esc(evidenceText('R'))}</p></button><button class="evidence-brief-card gray" data-open="evidence"><span>Still unknown <b aria-hidden="true">↗</b></span><p>Any statewide turnout advantage, extra participation versus timing, and ballot choice.</p></button></div>
${coverageSummary()}<div class="summary-next"><div><span class="eyebrow">ELECTION CHECKPOINTS · NOVEMBER 3</span><h2>From early voting to reported results.</h2><p>Early voting ended October 30. Election Day is November 3. Treat initial returns, race calls and certified results as distinct stages.</p></div><div class="summary-next-actions"><button class="pill-button" data-open="history">Compare earlier elections →</button><button class="text-button" data-open="evidence">Review all seven signals →</button></div></div><div class="summary-legend">${legend()}</div>`;
const draw=()=>{const mode=$('#overview-mode').value,metric=$('#overview-metric').value;$('#overview-bars').innerHTML=barsHTML(DATA.counties.filter(c=>primary.includes(c.name)),mode,$('#overview-sort').value,metric);$('#overview-measure-label').textContent=metric==='rate'?'% of SOS registration':'Reported voters';wireCountyLinks()};draw();$('#overview-mode').onchange=draw;$('#overview-sort').onchange=draw;$('#overview-metric').onchange=draw;wireCountyLinks();wireTabs()}

function dailyChart(rec){const vals=rec.daily_values;if(!Array.isArray(vals)||!vals.length)return `<div class="empty"><b>Daily series not verified for this selection.</b>The cumulative observation remains available. No daily curve has been inferred.</div>`;const max=Math.max(...vals.map(x=>x.value||0),1);return `<div class="daily-chart" role="img" aria-label="Daily early in-person voting, ${esc(rec.cutoff)}">${vals.map(v=>`<div class="daily-slot"><div class="daily-fill ${v.partial?'partial':''}" style="height:${(v.value||0)/max*175}px"><span class="daily-value">${fmt(v.value)}</span></div><div class="daily-date">${esc(v.date)}${v.partial?'<small>PARTIAL</small>':''}</div></div>`).join('')}</div><p class="source-line">Daily early in-person counts · zero-based bars · ${esc(rec.cutoff)}</p>`}
function renderCounty(){const c=DATA.counties.find(c=>c.name===countyName)||DATA.counties[0];countyName=c.name;$('#counties').innerHTML=intro('02 / COUNTY EXPLORER','Look beneath the statewide total.','Use the shared publisher snapshot for comparison, then inspect each county’s official reporting separately.')+`<aside id="county-reporting-transparency" class="rt-compact" aria-label="Reporting transparency" data-independent-timestamps="true"></aside><section class="panel"><div class="section-head"><div><h2 id="county-title"></h2><p id="county-sub"></p></div><div class="controls">${select('county-select','County',DATA.counties.map(c=>[c.name,c.name+' County']),countyName)}${select('county-source','Observation',[['publisher','Shared publisher snapshot'],['latest','Latest verified county record']],c.latest?'latest':'publisher')}${select('county-mode','Voting mode',Object.entries(modeLabel),'ip')}</div></div><div id="county-details"></div></section><section class="panel"><div class="section-head"><div><div class="eyebrow">DAILY VOTING</div><h2>One day at a time.</h2><p>In-person series from the selected observation, where verified.</p></div></div><div id="county-daily"></div></section><section class="panel"><div class="section-head"><div><h2>Expand the comparison.</h2><p>Shared publisher counts for the monitored counties.</p></div><div class="controls">${select('county-compare-sort','Sort',[['volume','Reported volume'],['name','County name']],'volume')}</div></div><div id="county-all-bars" class="county-bars"></div></section>`;$('#county-select').onchange=e=>{countyName=e.target.value;renderCounty()};function draw(){const latest=$('#county-source').value==='latest',rec=latest?c.latest:c,m=$('#county-mode').value;$('#county-title').textContent=c.name+' County';$('#county-sub').textContent=c.city||'';$('#county-all-bars').innerHTML=barsHTML(DATA.counties,m,$('#county-compare-sort').value);wireCountyLinks();if(!rec){$('#county-details').innerHTML=`<div class="empty"><b>Official aggregate not verified.</b>Switch to the shared publisher snapshot for the available observation.</div>`;$('#county-daily').innerHTML=dailyChart({});return}const n=rec[m];$('#county-details').innerHTML=`<span class="badge ${latest?'amber':''}">${esc(rec.classification||c.classification)}</span><div class="county-kpis"><div class="metric"><b>${fmt(n)}</b><span>${modeLabel[m]}</span></div><div class="metric"><b>${rate(n,rec.registered)}</b><span>${latest?'Calculated participation':'Of SOS November registration'}</span><small>${rec.registered?fmt(rec.registered)+' denominator; see source note':'Matched denominator unavailable'}</small></div><div class="metric"><b>${fmt(rec.daily)}</b><span>Latest daily in-person count</span></div><div class="metric"><b>${latest?'County':'Publisher'}</b><span>${esc(rec.cutoff||c.cutoff)}</span></div></div>${rec.note?`<div class="callout">${esc(rec.note)}</div>`:''}<p class="source-line">${link(rec.source||c.source)} ${rec.mail_source?' · '+link(rec.mail_source,'Returned-mail source ↗'):''} ${rec.registered_source?' · '+link(rec.registered_source,'Registration source ↗'):(!latest&&c.registered_source?' · '+link(c.registered_source,'SOS registration ↗'):'')} · ${latest?'This county observation is not substituted into the publisher’s statewide total.':'Publisher-reproduced counts are not independently rebuilt from individual voter records.'}</p>`;$('#county-daily').innerHTML=dailyChart(rec);$('#county-all-bars').innerHTML=barsHTML(DATA.counties,m,$('#county-compare-sort').value);wireCountyLinks()}$('#county-mode').onchange=draw;$('#county-source').onchange=draw;$('#county-compare-sort').onchange=draw;draw();window.ReportingTransparency?.mount()}
function dot(m){const span=pollScale(),pos=(m+span)/(2*span)*100,party=m>0?'R':m<0?'D':'Tie';return `<div class="dot-track" aria-label="${party}${m===0?'': ' lead '+Math.abs(m)+' percentage points'}"><span class="dot-point ${m>0?'r':m===0?'tie':''}" style="left:${Math.max(0,Math.min(100,pos))}%"><span class="dot-label">${m===0?'Tie':party+' +'+Math.abs(m)}</span></span></div>`}
const pollScale=()=>Math.max(6,...(DATA.polls||[]).flatMap(p=>[Math.abs(p.senR-p.senD),Math.abs(p.govR-p.govD)]).filter(Number.isFinite));
function renderPolling(){$('#polling').innerHTML=intro('03 / CANDIDATE PREFERENCE','Two races. Different signals.','Independent poll releases stay separate. The chart shows candidate margins, not a forecast or win probability.')+`<section class="panel"><div class="section-head"><div><h2>Candidate margins on the same scale.</h2><p>Release dates and freshness labels are retained for every poll. Data review: ${esc(DATA.reviewed_at)}.</p></div><span class="badge">Separate original releases</span></div><div class="poll-head"><div>Pollster / field dates / sample</div><div><h3>U.S. Senate</h3><p>Talarico (D) / Paxton (R)</p><div class="poll-scale"><span>D +${pollScale()}</span><span>Tie</span><span>R +${pollScale()}</span></div></div><div><h3>Governor</h3><p>Hinojosa (D) / Abbott (R)</p><div class="poll-scale"><span>D +${pollScale()}</span><span>Tie</span><span>R +${pollScale()}</span></div></div></div>${DATA.polls.map(p=>`<div class="poll-row"><div class="poll-meta"><b>${esc(p.name)}</b><span>${esc(p.field)} · ${fmt(p.n)} ${esc(p.population||'Population unverified')}</span><small>Published ${esc(p.published)} · ${esc(p.share_uncertainty)}</small><small>${esc(p.freshness||'Release freshness unverified')}</small></div>${dot(p.senR-p.senD)}${dot(p.govR-p.govD)}</div>`).join('')}<p class="panel-note">Margins are percentage points. Reported share uncertainty is not margin uncertainty, so no margin error bars are drawn. Different follow-up treatments limit direct comparability.</p>${DATA.polls.map(p=>`<details><summary>${esc(p.name)} · methods & source</summary><p>${esc(p.method)}</p><p>Senate: Talarico ${fmt(p.senD)}% / Paxton ${fmt(p.senR)}%. Governor: Hinojosa ${fmt(p.govD)}% / Abbott ${fmt(p.govR)}%.</p>${link(p.source)}</details>`).join('')}</section>`+scopeCards()+legend()}
function renderHistory(){const available=Object.keys(DATA.history||{}).length,countyOptions=(DATA.coverage?.counties||DATA.counties).map(c=>[c.name,c.name+' County']);$('#history').innerHTML=intro('04 / HISTORICAL CONTEXT','Compare the same point in voting.','Five previous election years are listed. A missing verified observation remains missing, never zero.')+`<section class="panel"><div class="section-head"><div><h2>Eight completed early-voting days.</h2><p>Early in person only. Verified observations currently cover ${available} counties, with different coverage in each year.</p></div><div class="controls">${select('history-county','County',countyOptions,'Harris')}${select('history-year','Year',[['all','Compare all years'],...['2016','2018','2020','2022','2024','2026'].map(y=>[y,y])],'all')}</div></div><div id="history-chart"></div><p class="panel-note">P = presidential; M = midterm. The 2020 early-voting window was longer. Equal elapsed days do not guarantee identical calendar effects. Partial October 27 counts are excluded. Each row uses its own reporting cutoff and registration denominator.</p><div class="callout">Historical turnout does not reveal candidate preference. Growth in voters can reflect population growth, voting earlier, or additional participation.</div></section>`;function draw(){const county=$('#history-county').value,yr=$('#history-year').value,rows=DATA.history[county];if(!rows){$('#history-chart').innerHTML=`<div class="empty"><b>${esc(county)} historical series not yet verified.</b>Matched voting mode, elapsed day and registration records are required before plotting. No historical values have been inferred.</div>`;return}const filtered=rows.filter(r=>yr==='all'||String(r.year)===yr),max=Math.max(...rows.map(r=>r.count||0),1);$('#history-chart').innerHTML=filtered.map(r=>`<div class="history-row ${r.year===2026?'current':''}"><div class="history-year">${r.year} <span class="small">${r.year%4===0?'P':'M'}</span><small>${esc(r.cutoff)}</small></div>${r.count==null?`<div class="missing-label">Not verified</div>`:`<div class="history-bar-wrap"><div class="track"><div class="fill" style="width:${r.count/max*100}%"></div></div><div class="history-number">${fmt(r.count)}</div></div>`}<div class="history-rate">${r.count==null?'—':rate(r.count,r.registered)}<small>% registered</small></div></div>`).join('')+`<div class="history-sources"><h3>Sources behind this comparison</h3>${filtered.filter(r=>r.count!=null).map(r=>`<p><b>${r.year}</b> · ${link(r.source,'Original turnout record ↗')} ${r.denominator_source?' · '+link(r.denominator_source,'Registration denominator ↗'):''}<small>${fmt(r.registered)} registered voters${r.snapshot?' · '+esc(r.snapshot):''}${r.note?' · '+esc(r.note):''}</small></p>`).join('')||'<p>No verified count in this selection.</p>'}</div><p class="source-line">${esc(county)} County only. Further source details and denominator differences are retained in the <a href="/notes.md">methodology notes</a>.</p>`}$('#history-county').onchange=draw;$('#history-year').onchange=draw;draw()}

const signalReasons={
 'Composition persistence':'One unchanged publisher release cannot establish persistence. Next: repeated cumulative snapshots with the same history definitions.',
 'Geographic breadth':'County coverage is broader, but cutoffs and source totals differ. Next: a matched completed-day comparison.',
 'Registration and prior nonvoters':'Registration vintages differ; previous midterm nonvoters are not verified. Next: consistent denominators and reproducible voter history.',
 'Suburban competitiveness':'Turnout alone does not measure suburban candidate support. Next: comparable Collin, Denton and Tarrant preference evidence.',
 'Urban/South Texas vs rural':'Carried-forward balance; current turnout does not resolve geographic candidate support. Next: urban and South Texas contributions versus offsets elsewhere.',
 'Polling and crossover':'Featured Senate and governor polls point in different directions. Next: repeated independent late polls with consistent follow-up treatment.',
 'Actual returns':'Election results are not available in this pre-election snapshot. Next: November 3 returns, outstanding ballots and certification.'
};
function normalizeComposition(raw){
 if(!raw||typeof raw!=='object')return null;
 let counts,categories;
 if(Array.isArray(raw.counts)&&Array.isArray(raw.categories)&&raw.counts.length===raw.categories.length){counts=[...raw.counts];categories=[...raw.categories];}
 else if(raw.ip_counts&&typeof raw.ip_counts==='object'){const keys=['D_only','R_only','both','no_history'];if(!keys.every(k=>Object.hasOwn(raw.ip_counts,k)))return null;counts=keys.map(k=>raw.ip_counts[k]);categories=['Democratic primary only','Republican primary only','Both-party primary history','No primary history'];}
 else return null;
 if(!counts.length||!counts.every(v=>Number.isFinite(v)&&v>=0)||!categories.every(v=>typeof v==='string'))return null;
 const total=counts.reduce((a,b)=>a+b,0);if(!(total>0))return null;
 return {...raw,counts,categories,total,mode:raw.mode||'Early in person',note:raw.note||'Publisher primary-history categories describe past participation since 2020. They are not ballot choice; the classification window and roster gaps limit historical comparisons.'};
}
function compositionHTML(){const c=normalizeComposition(DATA.composition);if(!c)return DATA.composition?'<section class="panel"><div class="empty"><b>Primary-history composition is not verified for this snapshot.</b>No missing category has been replaced with zero.</div></section>':'';const total=c.total,colors=['var(--blue)','var(--red)','var(--amber)','var(--quiet)'];return `<section class="panel"><div class="section-head"><div><div class="eyebrow">VOTER HISTORY · ${esc(c.mode)}</div><h2>Who has a primary participation record?</h2><p>${fmt(total)} in-person early voters in the publisher snapshot. These categories describe past participation.</p></div><span class="badge amber">Not ballot choice</span></div><div class="composition-stack" role="img" aria-label="${c.categories.map((n,i)=>esc(n)+': '+(c.counts[i]/total*100).toFixed(1)+' percent').join('; ')}">${c.counts.map((v,i)=>`<span style="width:${v/total*100}%;background:${colors[i]||'var(--quiet)'}"></span>`).join('')}</div><div class="composition-legend">${c.categories.map((n,i)=>`<div><span class="composition-label"><i style="background:${colors[i]||'var(--quiet)'}"></i>${esc(n)}</span><strong>${(c.counts[i]/total*100).toFixed(1)}%</strong><small>${fmt(c.counts[i])} voters</small></div>`).join('')}</div><p class="panel-note">${esc(c.note)} No candidate-vote allocation or forecast is derived from this chart. Colors identify history categories only.</p><p class="source-line">${link(c.source||DATA.statewide.source,'Publisher turnout data ↗')} · ${link('https://theoelections.com/methodology','Publisher methodology ↗')}</p></section>`}
function initialBaselineHTML(){const b=DATA.initial_baseline;if(!b)return '';return `<section class="panel"><div class="section-head"><div><div class="eyebrow">AUDIT TRAIL · OCTOBER 19, 2026</div><h2>The original Collin + Denton baseline.</h2><p>First-day early in-person voting. Retained for continuity, not treated as a new release.</p></div><span class="badge">Carried forward</span></div><div class="county-kpis"><div class="metric"><b>${fmt(b.collin_denton_ip)}</b><span>2026 first-day voters</span></div><div class="metric"><b>${fmt(b['2022_day1'])}</b><span>2022 first-day voters</span></div><div class="metric"><b>${fmt(b['2024_day1'])}</b><span>2024 first-day voters</span></div><div class="metric"><b>+${((b.collin_denton_ip/b['2022_day1']-1)*100).toFixed(1)}%</b><span>2026 raw count versus 2022</span></div></div><details><summary>Primary-history counts and comparison limits</summary><p>2026 publisher counts: Democratic history ${fmt(b.D_history)}, Republican history ${fmt(b.R_history)}, no primary record ${fmt(b.no_history)}. Historical 2022 shares were not independently reproduced, and the classification window expands from 2020.</p><p>${esc(b.caution)}. This is not evidence that individual voters changed candidate preference.</p></details></section>`}
function sourceRegisterHTML(){const items=[{url:DATA.statewide.source,label:'Statewide publisher snapshot',detail:DATA.statewide.as_of+' · mixed county reporting cutoffs'},{url:DATA.statewide.registered_source,label:'Texas SOS November registration',detail:'Administrative registration including suspense; numerator reporting cutoffs differ.'}];for(const c of DATA.counties){const r=c.latest;if(!r)continue;items.push({url:r.source,label:c.name+' county observation',detail:(r.classification||'Official source')+' · '+r.cutoff});if(r.mail_source)items.push({url:r.mail_source,label:c.name+' returned-mail report',detail:'Mail received, not mail sent · '+r.cutoff});if(r.registered_source)items.push({url:r.registered_source,label:c.name+' registration denominator',detail:'County-record denominator; see differences from SOS in the source note.'})}for(const p of DATA.polls)items.push({url:p.source,label:p.name+' original poll',detail:'Fielded '+p.field+' · published '+p.published});return `<div class="sources-grid">${items.filter(x=>x.url).map(x=>`<div class="source-item">${link(x.url,x.label+' ↗')}<span>${esc(x.detail)}</span></div>`).join('')}</div>`}
function renderEvidence(){$('#evidence').innerHTML=intro('05 / EVIDENCE & SOURCES','Every signal keeps its limits.','Reliability of a count is different from confidence about an election outcome.')+`<section class="panel"><div class="section-head"><div><h2>The seven-signal scorecard</h2><p>Qualitative assessments reviewed ${esc(DATA.reviewed_at)}. Movement compared with ${esc(DATA.baseline)}.</p></div></div><div class="table-wrap"><table class="evidence-table"><thead><tr><th>Signal</th><th>Current assessment</th><th>Movement</th><th>Strength</th><th>Checkpoint / next test</th></tr></thead><tbody>${DATA.signals.map(s=>`<tr><td>${esc(s.signal)}</td><td><span class="status-label ${/Mixed/i.test(s.assessment)?'mixed':''}">${esc(s.assessment)}</span></td><td>${esc(s.movement)}</td><td>${esc(s.strength)}</td><td><strong>${esc(s.status)}</strong><span class="signal-reason">${esc(s.reason||signalReasons[s.signal]||'See the dated source notes for the next comparable observation.')}</span></td></tr>`).join('')}</tbody></table></div>${legend()}</section>`+`<section class="panel rt-independent" id="reporting-transparency" data-independent-timestamps="true" tabindex="-1" aria-label="Reporting transparency"></section><section class="panel da-independent" id="website-delivery" data-independent-timestamps="true" tabindex="-1" aria-label="Website delivery audit"></section>`+coverageRosterHTML()+compositionHTML()+initialBaselineHTML()+`<section class="panel" id="observation-rules" tabindex="-1"><div class="section-head"><div><h2>Observation rules</h2><p>The statewide snapshot and county updates are separate records.</p></div></div><ul class="simple-list">${DATA.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section><section class="panel" id="source-register" tabindex="-1"><div class="section-head"><div><h2>Source register</h2><p>Publisher reproduction, official observations and calculated values are labeled separately. <a href="/notes.md">Read the verification record ↗</a></p></div></div>${sourceRegisterHTML()}</section><div class="next-row"><span>ELECTION CHECKPOINTS · NOV 3</span><p>Review closing participation reports and final polling. Distinguish preliminary returns, reported race calls and official certification.</p></div>`}
function wireTabs(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e?.preventDefault();showTab(b.dataset.open,true,{section:b.dataset.scroll||null})})}

function refreshTimeLabels(){
 if(!DATA)return;
 const snapshot=DATA.reviewed_at;
 document.querySelectorAll('a[href]').forEach(a=>{try{const u=new URL(a.getAttribute('href'),location.origin);if(u.origin===location.origin&&['/snapshot.png','/notes.md','/data.json'].includes(u.pathname))a.setAttribute('href',editionURL(u.pathname));}catch{}});
 const fullDate=v=>{const x=String(v||'Not verified');return /20\d{2}/.test(x)?x:x+' · 2026';};
 let banner=document.getElementById('snapshot-status');
 if(!banner){banner=document.createElement('aside');banner.id='snapshot-status';banner.setAttribute('aria-label','Data date and refresh status');document.querySelector('.nav').after(banner);}
 const attempt=REFRESH.lastAttempt||{},failed=refreshError==='Update service unavailable'||attempt.status==='failed',state=usingFallback?'Saved fallback snapshot':failed?'Last valid snapshot retained':refreshError?'Publication status unavailable':REFRESH.lastSuccessfulRefresh?'Last verified publication':'Refresh connection awaiting verification';
 banner.innerHTML='<div class="refresh-top"><span><b>Data reviewed</b> '+esc(snapshot)+'</span><span><b>Published</b> '+esc(centralTime(REFRESH.lastSuccessfulRefresh))+'</span></div>'+(usingFallback||failed?'<p class="refresh-published">Latest update delayed; displaying the last valid edition.</p>':'');
 try{if(window.DeliveryAudit)window.DeliveryAudit.mount();}catch(error){console.error('Delivery audit mount failed',error);}

 const footer=document.getElementById('refresh-note');if(footer)footer.textContent=state+'. Each observation retains its own source and reporting cutoff.';
 const mastheadTime=document.getElementById('edition-date');if(mastheadTime){mastheadTime.textContent=snapshot;mastheadTime.removeAttribute('datetime');}

 document.querySelectorAll('.nav-tab').forEach(b=>{let stamp=b.querySelector('.tab-time');if(!stamp){stamp=document.createElement('small');stamp.className='tab-time';b.append(stamp);}stamp.textContent='Snapshot · '+snapshot;});
 document.querySelectorAll('[data-navigation-time]').forEach(stamp=>{stamp.textContent='Snapshot · '+snapshot;});
 prepareNavigationAnchors();
 document.querySelectorAll('.page').forEach(page=>{
  const nodes=page.querySelectorAll('section.panel,.summary-total,.scope-card,.daily-brief,.evidence-brief-card,.coverage-summary,.summary-next,.next-row');
  nodes.forEach(node=>{
   if(node.dataset.independentTimestamps==='true')return;
   let cutoff='Mixed source dates; see the dated records below.';
   if(page.id==='polling'||node.classList.contains('scope-card')||node.classList.contains('evidence-brief-card'))cutoff='Field and release dates are shown for each original poll; publication hours are unverified unless supplied.';
   if(node.classList.contains('summary-total'))cutoff='Publisher dated '+fullDate(DATA.statewide.as_of)+'. Mixed county cutoffs; publication time not supplied.';
   if(node.classList.contains('summary-counties')||node.querySelector('#county-all-bars'))cutoff=sharedCountyCutoff(node.querySelector('#county-all-bars')?DATA.counties.map(c=>c.name):primary)+'. Reporting hour unverified unless supplied.';
   if(node.classList.contains('summary-daily'))cutoff='Completed daily counts only. Exact observation dates and county report cutoffs appear on each chart.';
   if(node.classList.contains('daily-brief')){const name=node.querySelector('h3')?.textContent;const c=DATA.counties.find(c=>c.name===name);cutoff=c?.latest?.cutoff||cutoff;}
   if(node.querySelector('#county-details')||node.querySelector('#county-daily')){
    const c=DATA.counties.find(c=>c.name===countyName);const r=document.getElementById('county-source')?.value==='latest'?c?.latest:c;
    cutoff=r?fullDate(r.cutoff):'No verified source cutoff for this selection.';
   }
   if(page.id==='history'){const name=document.getElementById('history-county')?.value;const yr=document.getElementById('history-year')?.value;const rows=(DATA.history[name]||[]).filter(r=>r.count!=null&&(yr==='all'||String(r.year)===yr));cutoff=rows.length?rows.map(r=>fullDate(r.cutoff)).join(' · '):'No verified historical cutoff for this selection.';}
   if(node.classList.contains('coverage-summary')||node.id==='coverage-roster')cutoff='Coverage register: '+DATA.coverage.built_at+'; source observations retain their own dates.';
   if(node.querySelector('.composition-stack'))cutoff='Publisher dated '+fullDate(DATA.statewide.as_of)+'. Mixed county cutoffs; publication time not supplied.';
   if(node.querySelector('.county-kpis')&&page.id==='evidence')cutoff='Original baseline: October 19, 2026, first-day in-person voting. Reporting hour not verified.';
   if(node.classList.contains('summary-next')||node.classList.contains('next-row'))cutoff='Election Day: November 3, 2026; then counting and certification. This calendar does not advance the displayed research review time.';
   let stamp=node.querySelector(':scope > .section-time');
   if(!stamp){stamp=document.createElement('div');stamp.className='section-time';node.prepend(stamp);}
   stamp.innerHTML='<span><b>Snapshot</b> '+esc(snapshot)+'</span><span><b>Source / period</b> '+esc(cutoff)+'</span>';
  });
 });
}
document.addEventListener('change',()=>queueMicrotask(refreshTimeLabels));
document.addEventListener('click',e=>{if(e.target.closest('[data-county],[data-open],.nav-tab'))queueMicrotask(refreshTimeLabels);});

// Publication checks are read-only; source research and writes run unattended on their own schedule.
const controlOrder=['overview-mode','overview-metric','overview-sort','county-source','county-mode','county-compare-sort','history-county','history-year','coverage-status','coverage-search'];
function captureView(){return {tab:activeTab,section:activeSection,county:countyName,scroll:window.scrollY,focus:document.activeElement?.id,controls:Object.fromEntries(controlOrder.map(id=>[id,document.getElementById(id)?.value]))}}
function restoreView(view){for(const id of controlOrder){const el=document.getElementById(id),value=view.controls[id];if(!el||value===undefined)continue;if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))continue;el.value=value;if(el.onchange)el.onchange({target:el});if(el.oninput)el.oninput({target:el});}showTab(view.tab,false,{section:view.section,history:'none',focus:false,closeMenus:false});window.scrollTo({top:view.scroll,behavior:'instant'});if(view.focus)document.getElementById(view.focus)?.focus({preventScroll:true});}
function validSnapshot(d){return d&&typeof d.reviewed_at==='string'&&d.statewide&&Number.isFinite(d.statewide.total)&&Array.isArray(d.counties)&&Array.isArray(d.polls)&&Array.isArray(d.signals)&&d.history;}
function renderSnapshot(d){const view=DATA?captureView():null;DATA=d;SNAPSHOT_VERSION=d.snapshot_version??d.version??d.reviewed_at;document.getElementById('footer-snapshot').textContent='Data review · '+DATA.reviewed_at;renderOverview();renderCounty();renderPolling();renderHistory();renderEvidence();wireCoverage();wireTabs();wireCountyLinks();buildNavigation();prepareNavigationAnchors();$('#loading').hidden=true;if(view)restoreView(view);else {const requested=parseNavigationHash(location.hash);showTab(requested.page,Boolean(requested.section),{section:requested.section,history:'none',focus:false});}try{refreshTimeLabels();}catch(error){console.error('Time-label refresh failed',error);}try{window.ReportingTransparency?.mount();}catch(error){console.error('Reporting transparency mount failed',error);}try{window.DeliveryAudit?.mount();}catch(error){console.error('Delivery audit mount failed',error);}if(typeof CustomEvent==='function')document.dispatchEvent?.(new CustomEvent('civic:render'));}
async function getJSON(url){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Snapshot service unavailable');return await r.json()}finally{clearTimeout(timeout)}}
async function refreshSnapshot(initial=false){
 if(refreshInFlight||(!initial&&document.hidden))return;
 refreshInFlight=true;
 try{
  const [dataResult,statusResult]=await Promise.allSettled([getJSON('/api/snapshot'),getJSON('/api/refresh-status')]);
  if(dataResult.status!=='fulfilled'||!validSnapshot(dataResult.value))throw Error('No verified snapshot received');
  const d=dataResult.value,version=d.snapshot_version??d.version??d.reviewed_at;
  const explicitVersion=d.snapshot_version??d.version;
  let status=statusResult.status==='fulfilled'?statusResult.value:null;
  const matchingStatus=value=>explicitVersion&&value&&(value.snapshot_version??value.version)===explicitVersion;
  // A publication can land between the two reads. Pin metadata to the data
  // actually accepted, never display another edition's successful refresh time.
  if(explicitVersion&&!matchingStatus(status)){
   try{status=await getJSON('/api/refresh-status?version='+encodeURIComponent(explicitVersion));}catch{status=null;}
  }
  REFRESH=matchingStatus(status)?status:{};
  usingFallback=false;refreshError=matchingStatus(status)?null:'Publication status unavailable';
  if(!DATA||version!==SNAPSHOT_VERSION)renderSnapshot(d);else refreshTimeLabels();
 }catch(error){
  refreshError='Update service unavailable';
  if(!DATA){
   try{const fallback=await getJSON('/fallback-data.json');if(!validSnapshot(fallback))throw Error('Invalid saved snapshot');usingFallback=true;REFRESH={};renderSnapshot(fallback);}
   catch(error){console.error('Snapshot render failed',error);$('#loading').innerHTML='<b>The evidence snapshot could not be loaded.</b><br>Please reload this page. No unverified substitute data has been shown.';}
  }else refreshTimeLabels();
 }finally{refreshInFlight=false}
}
refreshSnapshot(true);
setInterval(()=>refreshSnapshot(),60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSnapshot();});
