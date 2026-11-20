/* U.S. Congress coverage layer: layer navigation and the page frame for the National results
   panel (national.js). The pre-election interactive preview (synthetic sample seats, scenario
   editor, schematic tile map) was removed in the post-election wind-down; this layer now carries
   only sourced, labelled aggregator data. */
(()=>{
 'use strict';
 const qs=s=>document.querySelector(s),byId=id=>document.getElementById(id);
 let layer='texas';
 const nav=document.createElement('nav');nav.className='ct-layer-nav';nav.setAttribute('aria-label','Coverage layers');
 nav.innerHTML='<button type="button" data-ct-layer="texas" aria-pressed="true">Texas Deep Dive</button><button type="button" data-ct-layer="congress" aria-pressed="false">U.S. Congress</button><button type="button" data-ct-layer="sources" aria-pressed="false">Sources & methodology</button>';
 byId('dashboard-navigation').before(nav);
 // Keep the existing Texas artwork and copy. Add a smaller U.S. emblem to its left.
 const brand=qs('.brand');brand.dataset.ctLayer='texas';
 const tx=qs('.texas-mark');const group=document.createElement('div');group.className='ct-emblem-group';
 const us=document.createElement('a');us.className='ct-emblem-link';us.href='#us-congress';us.dataset.ctLayer='congress';us.setAttribute('aria-label','Open U.S. Congress overview');
 us.innerHTML='<img src="us-congress-emblem.svg?v='+encodeURIComponent(uiRelease)+'" alt="" width="100" height="90" decoding="async"><span>U.S. CONGRESS</span>';
 const txLink=document.createElement('a');txLink.className='ct-texas-link';txLink.href='#overview';txLink.dataset.ctLayer='texas';txLink.setAttribute('aria-label','Open Texas Deep Dive');txLink.setAttribute('aria-current','page');
 tx.before(group);group.append(us,txLink);txLink.append(tx);
 const page=document.createElement('section');page.id='ct-congress';page.className='ct-congress';page.hidden=true;page.setAttribute('aria-labelledby','ct-title');
 page.innerHTML=`<header><div><div class="ct-kicker">U.S. CONGRESS / OPTIONAL COVERAGE LAYER</div><h1 id="ct-title" tabindex="-1">The balance of power.</h1><p>Senate, House and governor returns nationwide, with official state feeds checked against the aggregator. Return to Texas at any time.</p></div><span class="badge amber">Unofficial · aggregator data</span></header>
 <div class="callout">Results on this tab come from civicAPI, an unofficial aggregator, with official state feeds compared where we could ingest them (Arizona, California, Florida, Minnesota, North Carolina, Oregon and Texas). States certify on their own schedules; this site does not track certification outside Texas.</div>
 <aside class="panel ct-help"><strong>Texas remains the flagship.</strong><p class="ct-small">The national layer adds context. Our detailed Texas coverage retains its existing layout and controls.</p><button type="button" class="ct-text-link" data-ct-layer="texas">Return to Texas Deep Dive →</button></aside>
 <section class="panel" id="ct-methodology"><h2>Sources & methodology</h2><div class="ct-source-wrap"><table class="ct-source-table"><thead><tr><th>Measure</th><th>This page</th><th>Published layer requirement</th></tr></thead><tbody><tr><td>Polls</td><td>No national polling loaded</td><td>Original release, pollster, sponsor, field dates and methods</td></tr><tr><td>Vote returns</td><td>National results panel via civicAPI (unofficial; source update time and fetch time shown per chamber)</td><td>Traceable source, reporting cutoff and preliminary status</td></tr><tr><td>Race calls</td><td>civicAPI decision-desk calls, labelled as such, in the National results panel; outlet projections in the race-calls register when recorded</td><td>Named calling organization and timestamp</td></tr><tr><td>Freshness</td><td>The page re-reads the data every minute; the data is fetched from civicAPI at least hourly. Each chamber shows the aggregator's own last-update time. “Percent reporting” is the aggregator's estimate of expected votes; it fell on Nov 4 when the aggregator revised those estimates.</td><td>Separate source cutoff, review and publication clocks</td></tr></tbody></table></div><button type="button" class="ct-text-link" data-ct-layer="sources">Open Texas sources & methodology →</button></section>`;
 byId('main').append(page);
 function syncLayerVisibility(){
   const national=layer==='congress';
   page.hidden=!national;byId('dashboard-navigation').hidden=national;
   qs('.election-context').hidden=national;
   qs('.institutional-footer').hidden=national;
   const texasStatus=byId('snapshot-status');if(texasStatus)texasStatus.hidden=national;
   const texasReturns=byId('returns-panel');if(texasReturns)texasReturns.hidden=national;
   const texasLede=qs('.review-lede');if(texasLede)texasLede.hidden=national;
   if(national){document.querySelectorAll('.page').forEach(p=>p.hidden=true);byId('loading').hidden=true;}
   nav.querySelectorAll('[data-ct-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ctLayer===layer)));
   if(national)us.setAttribute('aria-current','page');else us.removeAttribute('aria-current');
   if(!national)txLink.setAttribute('aria-current','page');else txLink.removeAttribute('aria-current');
 }
 function switchLayer(next,focus=true,options={}){
   layer=next;
   const route=next==='congress'?'#us-congress':options.route||(next==='sources'?'#evidence':'#overview');
   if(next!=='congress'){
     const parsed=parseNavigationHash(route);
     showTab(parsed.page,false,{section:parsed.section,history:'none',focus:false});
     byId('loading').hidden=Boolean(DATA);
   }
   syncLayerVisibility();
   if(next==='congress'&&window.NationalPanel)window.NationalPanel.refresh();
   if(options.history!=='none'&&location.hash!==route)history.pushState(null,'',route);
   if(focus){
     const heading=next==='congress'?byId('ct-title'):document.getElementById(next==='sources'?'evidence':'overview')?.querySelector('h1');
     heading?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
   }
 }
 document.addEventListener('click',e=>{
   const b=e.target.closest('[data-ct-layer]');
   if(!b||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   e.preventDefault();switchLayer(b.dataset.ctLayer);
 });
 const reconcile=()=>switchLayer(location.hash==='#us-congress'?'congress':location.hash.startsWith('#evidence')?'sources':'texas',false,{history:'none',route:location.hash||'#overview'});
 window.addEventListener('hashchange',reconcile);
 window.addEventListener('popstate',reconcile);
 // The Texas service may render a new edition while the Congress view is open.
 // Reapply view visibility without touching either dataset.
 document.addEventListener('civic:render',syncLayerVisibility);
 reconcile();
})();
