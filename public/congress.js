/* Optional congressional interactive preview. Synthetic sample data and local
   scenario overrides are isolated from the live Texas data and publishing API. */
(()=>{
 'use strict';
 const qs=s=>document.querySelector(s),byId=id=>document.getElementById(id);
 const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
 const names=['Solid D','Leaning D','Toss-up','Leaning R','Solid R'];
 const colors=['#3879ed','#9ac4ff','#f4c85a','#efacb0','#de596a'];
 const tileRows=[['ME',11,0],['WI',4,1],['VT',9,1],['NH',10,1],['WA',0,2],['ID',1,2],['MT',2,2],['ND',3,2],['MN',4,2],['IL',5,2],['MI',6,2],['NY',9,2],['MA',10,2],['OR',0,3],['NV',1,3],['WY',2,3],['SD',3,3],['IA',4,3],['IN',5,3],['OH',6,3],['PA',7,3],['NJ',8,3],['CT',9,3],['RI',10,3],['CA',0,4],['UT',1,4],['CO',2,4],['NE',3,4],['MO',4,4],['KY',5,4],['WV',6,4],['VA',7,4],['MD',8,4],['DE',9,4],['AZ',1,5],['NM',2,5],['KS',3,5],['AR',4,5],['TN',5,5],['NC',6,5],['SC',7,5],['OK',3,6],['LA',4,6],['MS',5,6],['AL',6,6],['GA',7,6],['HI',0,7],['AK',1,7],['TX',3,7],['FL',8,7]];
 function fixture(chamber,counts){
   const rows=[];let n=0;
   counts.forEach((count,rating)=>{for(let i=0;i<count;i++,n++)rows.push(Object.freeze({id:chamber+'-'+n,state:states[n%50],label:'Sample seat '+(n+1),rating}));});
   return Object.freeze(rows);
 }
 const BASE=Object.freeze({senate:fixture('senate',[40,8,7,8,37]),house:fixture('house',[185,25,25,20,180])});
 const overrides={senate:new Map(),house:new Map()};
 let chamber='senate',mode='published',selected='senate-0',stateFilter='all',layer='texas';
 const effective=s=>mode==='scenario'&&overrides[chamber].has(s.id)?overrides[chamber].get(s.id):s.rating;
 const counts=()=>BASE[chamber].reduce((a,s)=>(a[effective(s)]++,a),[0,0,0,0,0]);
 const originalHash=JSON.stringify(BASE);
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
 page.innerHTML=`<header><div><div class="ct-kicker">U.S. CONGRESS / OPTIONAL COVERAGE LAYER</div><h1 id="ct-title" tabindex="-1">The balance of power.</h1><p>Explore the chamber. Test a scenario. Return to Texas at any time.</p></div><span class="badge amber">Interactive preview · sample data</span></header>
 <div class="callout"><strong>Illustrative data only.</strong> Seat allocations, state assignments and colors are synthetic design fixtures. They are not current ratings, polling, race calls or election results.</div>
 <div class="ct-mode-switch" role="group" aria-label="Display mode"><button type="button" id="ct-published" aria-pressed="true">Sample baseline</button><button type="button" id="ct-scenario" aria-pressed="false">Build your scenario</button></div>
 <div class="ct-scenario-notice" id="ct-scenario-notice" hidden><strong>YOUR SCENARIO</strong> · Local to this visit. Changes redraw your graphics only. Published evidence stays unchanged. <span id="ct-change-total"></span></div>
 <div class="ct-controls"><label>Chamber<select id="ct-chamber"><option value="senate">U.S. Senate</option><option value="house">U.S. House</option></select></label><label>State focus<select id="ct-state"><option value="all">All states</option>${states.map(s=>'<option>'+s+'</option>').join('')}</select></label><button type="button" class="ct-action" id="ct-clear-state">Clear state focus</button></div>
 <div class="ct-chart-grid"><section class="panel"><div class="section-head"><div><h2 id="ct-chamber-title">Senate</h2><p id="ct-threshold"></p></div><span class="ct-status" id="ct-chart-status"></span></div><div id="ct-chamber-graphic"></div><div class="ct-counts" id="ct-counts"></div><div class="ct-legend">${names.map((s,i)=>'<span><i style="--c:'+colors[i]+'"></i>'+s+'</span>').join('')}</div><p class="ct-small">Each dot represents one sample seat. A white ring marks your selection; a dashed gold ring marks a local scenario change.</p></section>
 <aside class="panel"><div class="ct-kicker">SELECT A SEAT</div><h2>Inspect, then explore.</h2><p>Click a seat, choose one below, or focus a state on the map.</p><label>Sample seat<select id="ct-seat-select"></select></label><div class="ct-selection"><div id="ct-selected-line" class="ct-selected-line" aria-live="polite"></div><p class="ct-small" id="ct-seat-help"></p><div id="ct-editor" hidden><label>Your scenario rating<select id="ct-rating">${names.map((s,i)=>'<option value="'+i+'">'+s+'</option>').join('')}</select></label><button type="button" class="ct-action ct-reset" id="ct-reset-seat">Restore this seat</button><button type="button" class="ct-action ct-reset" id="ct-reset">Reset entire scenario</button></div></div><div class="ct-help"><strong>Texas remains the flagship.</strong><p class="ct-small">The national layer adds context. Our detailed Texas coverage retains its existing layout and controls.</p><button type="button" class="ct-text-link" data-ct-layer="texas">Return to Texas Deep Dive →</button></div></aside></div>
 <section class="panel"><div class="section-head"><div><h2>Find the battlegrounds.</h2><p>State tile map · ${' '}schematic geography for this prototype</p></div><span id="ct-map-status" class="ct-status"></span></div><div class="ct-map" id="ct-map"></div><p class="ct-small" id="ct-map-help"></p></section>
 <section class="ct-verification"><h2>Your controls. The same evidence.</h2><p>View switches and state filters change presentation. Scenario assignments are held in this tab’s memory and disappear on reload. They never enter the source records, published totals or other visitors’ views.</p><p class="ct-small" id="ct-integrity" role="status"></p></section>
 <section class="panel" id="ct-methodology"><h2>Sources & methodology</h2><div class="ct-source-wrap"><table class="ct-source-table"><thead><tr><th>Measure</th><th>This prototype</th><th>Published layer requirement</th></tr></thead><tbody><tr><td>Race ratings</td><td>Synthetic fixtures</td><td>Named source, original category and rating date</td></tr><tr><td>Polls</td><td>No national polling loaded</td><td>Original release, pollster, sponsor, field dates and methods</td></tr><tr><td>Vote returns</td><td>No national vote returns loaded</td><td>Traceable source, reporting cutoff and preliminary status</td></tr><tr><td>Race calls</td><td>No calls in this prototype</td><td>Named calling organization and timestamp</td></tr><tr><td>Freshness</td><td>Interactive preview; no national data feed</td><td>Separate source cutoff, review and publication clocks</td></tr><tr><td>Scenarios</td><td>Browser memory only</td><td>Clearly labeled local assumptions; never published evidence</td></tr></tbody></table></div><p class="ct-small">Production Senate graphics will distinguish seats not up for election and retain their contribution to control totals. House maps will show individual districts; a single statewide winner will never stand in for House district outcomes. State summaries use multiple colors when their seats differ.</p><button type="button" class="ct-text-link" data-ct-layer="sources">Open Texas sources & methodology →</button></section>`;
 byId('main').append(page);
 function syncLayerVisibility(){
   const national=layer==='congress';
   page.hidden=!national;byId('dashboard-navigation').hidden=national;
   qs('.election-context').hidden=national;
   qs('.institutional-footer').hidden=national;
   const texasStatus=byId('snapshot-status');if(texasStatus)texasStatus.hidden=national;
   const texasReturns=byId('returns-panel');if(texasReturns)texasReturns.hidden=national;
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
 // Reapply view visibility without touching either dataset or scenario overrides.
 document.addEventListener('civic:render',()=>{syncLayerVisibility();draw();});
 function draw(){
   const texasBefore=JSON.stringify(DATA);
   const list=BASE[chamber],visible=list.filter(s=>stateFilter==='all'||s.state===stateFilter);
   if(!visible.some(s=>s.id===selected))selected=visible[0]?.id||list[0].id;
   const seat=list.find(s=>s.id===selected),scenario=mode==='scenario',c=counts();
   byId('ct-chamber-title').textContent=chamber==='senate'?'U.S. Senate':'U.S. House';
   byId('ct-threshold').textContent=chamber==='senate'?'100 sample seats · 51 for outright majority; 50 + the vice president can control':'435 sample seats · 218 for a full-chamber majority';
   byId('ct-chart-status').textContent=scenario?'YOUR SCENARIO':'ILLUSTRATIVE BASELINE';
   byId('ct-map-status').textContent=scenario?'YOUR SCENARIO':'ILLUSTRATIVE BASELINE';
   byId('ct-scenario-notice').hidden=!scenario;byId('ct-editor').hidden=!scenario;
   byId('ct-published').setAttribute('aria-pressed',String(!scenario));byId('ct-scenario').setAttribute('aria-pressed',String(scenario));
   byId('ct-change-total').textContent=overrides.senate.size+overrides.house.size+' changed sample seats across both chambers.';
   byId('ct-seat-help').textContent=scenario?'Choose a rating to redraw your scenario. You can restore one seat or reset both chambers.':'Inspecting this seat does not change its rating. Choose “Build your scenario” to test an alternative.';
   byId('ct-selected-line').textContent=seat.label+' · '+seat.state+' · '+names[effective(seat)];
   byId('ct-seat-select').innerHTML=visible.map(s=>'<option value="'+s.id+'"'+(s.id===selected?' selected':'')+'>'+s.label+' · '+s.state+'</option>').join('');
   byId('ct-rating').value=String(effective(seat));byId('ct-reset-seat').disabled=!overrides[chamber].has(selected);byId('ct-reset').disabled=!overrides.senate.size&&!overrides.house.size;
   byId('ct-clear-state').disabled=stateFilter==='all';
   byId('ct-counts').innerHTML=c.map((n,i)=>'<div style="--c:'+colors[i]+'"><b>'+n+'</b>'+names[i]+'</div>').join('');
   const rings=chamber==='senate'?[12,16,20,24,28]:[44,51,58,65,72,79,66],points=[];
   rings.forEach((n,j)=>{const r=140+j*(164/(rings.length-1));for(let i=0;i<n;i++){const a=Math.PI*(1-i/(n-1));points.push({a,x:340+r*Math.cos(a),y:330-r*Math.sin(a)});}});points.sort((a,b)=>b.a-a.a);
   const radius=chamber==='senate'?7:3.9;
   byId('ct-chamber-graphic').innerHTML='<svg class="ct-chamber-svg" viewBox="0 0 680 370" role="img" aria-label="'+(scenario?'Your scenario':'Illustrative baseline')+', '+list.length+' sample seats. Use the seat selector to inspect or edit.">'+points.map((p,i)=>{const s=list[i];return '<circle class="ct-seat'+(s.id===selected?' ct-selected':'')+(scenario&&overrides[chamber].has(s.id)?' ct-modified':'')+(stateFilter!=='all'&&s.state!==stateFilter?' ct-dim':'')+'" data-ct-seat="'+s.id+'" cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="'+radius+'" fill="'+colors[effective(s)]+'"><title>'+s.label+' · '+s.state+' · '+names[effective(s)]+'</title></circle>';}).join('')+'<text x="340" y="285" text-anchor="middle" fill="#f3f0e8" font-size="44" font-family="Georgia">'+list.length+'</text><text x="340" y="312" text-anchor="middle" fill="#b3bfcd" font-size="12">'+(scenario?'YOUR SCENARIO':'SAMPLE SEATS')+'</text></svg>';
   byId('ct-map').innerHTML=tileRows.map(([s,x,y])=>{const ratings=[...new Set(list.filter(z=>z.state===s).map(effective))].sort();return '<button type="button" data-ct-state="'+s+'" style="grid-column:'+(x+1)+';grid-row:'+(y+1)+'" aria-pressed="'+(stateFilter===s)+'" aria-label="Focus '+s+', sample seat ratings: '+ratings.map(r=>names[r]).join(', ')+'">'+s+'<span class="ct-map-stripe" aria-hidden="true">'+ratings.map(r=>'<i style="--c:'+colors[r]+'"></i>').join('')+'</span></button>';}).join('');
   byId('ct-map-help').textContent='Each state tile shows the distinct sample seat ratings in that state. Multiple colors mean different seat ratings, not a statewide winner. Choose a state to highlight its seats. '+(stateFilter==='all'?'All states are shown.':'Focused on '+stateFilter+'.');
   byId('ct-integrity').textContent=JSON.stringify(BASE)===originalHash&&JSON.stringify(DATA)===texasBefore?'Baseline and Texas data integrity: unchanged. Scenario controls cannot publish data.':'Baseline integrity check failed.';
 }
 byId('ct-published').onclick=()=>{mode='published';draw();};byId('ct-scenario').onclick=()=>{mode='scenario';draw();};
 byId('ct-chamber').onchange=e=>{chamber=e.target.value;draw();};
 byId('ct-state').onchange=e=>{stateFilter=e.target.value;draw();};
 byId('ct-clear-state').onclick=()=>{stateFilter='all';byId('ct-state').value='all';draw();};
 byId('ct-seat-select').onchange=e=>{selected=e.target.value;draw();};
 byId('ct-rating').onchange=e=>{if(mode!=='scenario')return;const seat=BASE[chamber].find(s=>s.id===selected),r=Number(e.target.value);if(r===seat.rating)overrides[chamber].delete(selected);else overrides[chamber].set(selected,r);draw();};
 byId('ct-reset-seat').onclick=()=>{overrides[chamber].delete(selected);draw();};
 byId('ct-reset').onclick=()=>{overrides.senate.clear();overrides.house.clear();draw();};
 page.addEventListener('click',e=>{const dot=e.target.closest('[data-ct-seat]'),tile=e.target.closest('[data-ct-state]');if(dot){selected=dot.dataset.ctSeat;const s=BASE[chamber].find(z=>z.id===selected);if(stateFilter!=='all'&&s.state!==stateFilter){stateFilter=s.state;byId('ct-state').value=stateFilter;}draw();}if(tile){stateFilter=tile.dataset.ctState;byId('ct-state').value=stateFilter;draw();}});
 draw();reconcile();
})();
