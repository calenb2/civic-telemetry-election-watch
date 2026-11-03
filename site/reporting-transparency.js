/* Reporting review is an independent publication stream: election timestamps never advance here. */
(function () {
  'use strict';
  let current = null, failure = false, inFlight = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const versionPattern = /^rt-[a-f0-9]{64}$/;
  const time = value => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'}).format(date);
  };
  const safeURL = value => {
    if (typeof value !== 'string') return null;
    try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
  };
  const link = (url, label) => { const href = safeURL(url); return href ? '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' <span aria-hidden="true">↗</span></a>' : esc(label); };
  const labels = {official:'Official source',publisher_reproduced:'Publisher reproduction',reported_only:'Reported only',inferred:'Inferred',open:'Open',explained:'Explained',corrected:'Corrected',unresolved:'Unresolved',not_comparable:'Not comparable',retrieved:'Retrieved',partial:'Partial access',blocked:'Access blocked',unavailable:'Unavailable',documented:'Documented time',first_observed:'First observed',unknown:'Time unknown'};
  const label = value => labels[value] || String(value || 'Unknown').replace(/_/g,' ');
  const valid = value => value && (value.status === 'not_initialized' || (value.status === 'published' && versionPattern.test(value.version) && value.ledger && Array.isArray(value.ledger.cases) && Array.isArray(value.ledger.source_checks) && Array.isArray(value.ledger.coverage?.reviewed_counties) && Number.isFinite(Date.parse(value.reviewed_at))));
  const cadence = 'Every 2 hours through Nov 3; every 12 hours from Nov 4 · America/Chicago';
  const stale = value => {
    if (value?.freshness === 'stale') return true;
    if (!value?.reviewed_at) return false;
    const declared = value?.ledger?.schedule?.stale_after_hours;
    if (Number.isFinite(declared) && declared > 0) return Date.now() - Date.parse(value.reviewed_at) > declared * 3600000;
    const period = Date.now() < Date.parse('2026-11-04T00:00:00-06:00') ? 2 : 12;
    return Date.now() - Date.parse(value.reviewed_at) > (period + 1) * 3600000;
  };
  const state = () => failure && current?.status !== 'published' ? 'Reporting review unavailable' : failure || current?.last_attempt?.status === 'failed' ? 'Last successful review retained' : current?.status !== 'published' ? 'Baseline pending' : stale(current) ? 'Review is older than the expected interval' : 'Dated evidence review';
  const icon = '<img src="'+esc(typeof licensedIconSources !== 'undefined' ? licensedIconSources.evidence : '/icons/evidence.svg')+'" alt="" aria-hidden="true" class="rt-icon">';
  const formatNumber = value => Number.isSafeInteger(value) ? value.toLocaleString('en-US') : 'Not verified';
  function timeBlock(value) {
    return '<div class="rt-times"><span><b>Reporting review</b> '+esc(time(value?.reviewed_at))+'</span><span><b>Successful publication</b> '+esc(time(value?.published_at))+'</span></div>';
  }
  function compactHTML(value) {
    const available = value?.status === 'published', counties = available ? new Set(value.ledger.coverage.reviewed_counties).size : null;
    return '<div class="rt-compact-title">'+icon+'<div><span class="eyebrow">REPORTING TRANSPARENCY</span><h2>How the reporting connects.</h2></div></div>' +
      '<p>'+(available ? esc(counties)+' of 254 counties have a source review. Source access does not establish a matched reporting timeline.' : 'A separate evidence log tracks reporting gaps and documented responses. No reporting baseline is available in this view.')+'</p>' +
      timeBlock(value)+'<div class="rt-compact-bottom"><span class="rt-status'+(failure || stale(value) ? ' rt-warning':'')+'">'+esc(state())+'</span><a href="#evidence/reporting-transparency" data-open="evidence" data-scroll="reporting-transparency">Inspect the evidence <span aria-hidden="true">↗</span></a></div>';
  }
  function sourceHTML(source) {
    return '<article class="rt-source"><div class="rt-source-heading"><strong>'+link(source.url, source.label || source.publisher || 'Source')+'</strong><span class="rt-pill">'+esc(label(source.status))+'</span></div>'+
      '<p>'+esc(source.publisher)+' · '+esc(label(source.classification))+'</p><dl class="rt-facts"><div><dt>Checked</dt><dd>'+esc(time(source.checked_at))+'</dd></div><div><dt>Source publication</dt><dd>'+esc(source.publication_time ? time(source.publication_time) : source.publication_date ? source.publication_date+' · time unknown' : 'Date and time unknown')+'</dd></div><div><dt>Observation cutoff</dt><dd>'+esc(source.observation_cutoff || 'Not established')+'</dd></div></dl><p>'+esc(source.notes)+'</p></article>';
  }
  function caseHTML(item, value) {
    const sources = value.ledger.source_checks.filter(s => item.source_ids?.includes(s.id));
    const comparison = item.comparison;
    const metrics = caseMetrics(value, item.id);
    const comparisonHTML = comparison ? '<div class="rt-count-pair">'+['county','state'].map(side => '<div><span>'+ (side==='county'?'County figure':'State figure')+'</span><b>'+formatNumber(comparison[side]?.value)+'</b><small>'+esc(label(comparison[side]?.mode))+' · '+esc(comparison[side]?.voting_date || 'Voting date unknown')+'</small><small>Cutoff: '+esc(comparison[side]?.cutoff_at ? time(comparison[side].cutoff_at) : comparison[side]?.full_day ? 'Completed day; exact hour unknown' : 'Not established')+'</small></div>').join('')+'</div>' : '';
    let metricHTML = '<p class="rt-measure-limit">No comparable reporting interval established.</p>';
    if (metrics && Number.isSafeInteger(metrics.count_gap_county_minus_state)) metricHTML = '<p class="rt-measure-limit"><b>Matched count difference: '+(metrics.count_gap_county_minus_state>0?'+':'')+formatNumber(metrics.count_gap_county_minus_state)+'</b> · county minus state. This is a reporting comparison, not a count of missing ballots.</p>';
    const communications = metrics?.communications || [];
    const communicationHTML = communications.filter(c => c.basis === 'documented' && Number.isFinite(c.minutes)).map(c => '<p class="rt-measure-limit"><b>'+esc(label(c.direction))+' documented response:</b> '+esc(duration(c.minutes * 60))+' · linked communication timestamps.</p>').join('');
    const lag = metrics?.publication_lag;
    let lagHTML = '';
    if (lag?.basis === 'documented_publication' && Number.isFinite(lag.minutes)) lagHTML = '<p class="rt-measure-limit"><b>Documented public appearance gap:</b> '+esc(duration(Math.abs(lag.minutes) * 60))+' · '+(lag.minutes > 0 ? 'state appeared after county' : lag.minutes < 0 ? 'state appeared before county' : 'same documented time')+'.</p>';
    if (lag?.basis === 'observation_windows' && Number.isFinite(lag.minimum_minutes) && Number.isFinite(lag.maximum_minutes)) lagHTML = '<p class="rt-measure-limit"><b>Public appearance interval:</b> '+esc(lag.minimum_minutes)+' to '+esc(lag.maximum_minutes)+' minutes (state minus county). This is a bounded observation window, not an exact transmission time.</p>';
    const eventHTML = (item.events || []).map(event => '<li><span class="rt-event-type">'+esc(label(event.type))+'</span><b>'+esc(event.occurred_at && event.time_basis === 'documented' ? time(event.occurred_at) : time(event.observed_at))+'</b><small>'+esc(label(event.time_basis))+(event.time_basis !== 'documented' ? ' · not proof of publication or transmission time':'')+'</small><p>'+esc(event.note)+'</p></li>').join('');
    return '<article class="rt-case"><div class="rt-case-title"><div><span class="eyebrow">'+esc(item.county)+' COUNTY · '+esc(label(item.evidence_status))+'</span><h3>'+esc(item.title)+'</h3></div><span class="rt-pill rt-'+esc(item.status)+'">'+esc(label(item.status))+'</span></div><p>'+esc(item.summary)+'</p><div class="rt-times"><span><b>First observed</b> '+esc(time(item.first_observed_at))+'</span><span><b>Last checked</b> '+esc(time(item.last_checked_at))+'</span></div>'+comparisonHTML+metricHTML+lagHTML+communicationHTML+'<details data-rt-detail="case-'+esc(item.id)+'"><summary>Timeline and supporting record</summary>'+(eventHTML?'<ol class="rt-timeline">'+eventHTML+'</ol>':'<p>No documented communication events are available.</p>')+'<p class="rt-case-sources">'+sources.map(s=>link(s.url,s.label)).join(' · ')+'</p>'+(item.change_note?'<p><b>Revision note:</b> '+esc(item.change_note)+'</p>':'')+'</details></article>';
  }
  function caseMetrics(value, id) {
    const metrics = value?.metrics?.cases;
    return Array.isArray(metrics) ? metrics.find(item => item.id === id || item.case_id === id) : metrics?.[id] || null;
  }
  function duration(seconds) {
    if (seconds < 60) return seconds+' seconds';
    const hours = Math.floor(seconds/3600), minutes = Math.floor(seconds%3600/60), remainder = Math.floor(seconds%60);
    return [hours?hours+'h':null,minutes?minutes+'m':null,remainder?remainder+'s':null].filter(Boolean).join(' ') || '0 seconds';
  }
  function fullHTML(value) {
    const available = value?.status === 'published', ledger = value?.ledger;
    const sources = available ? ledger.source_checks : [], cases = available ? ledger.cases : [];
    const counties = available ? new Set(ledger.coverage.reviewed_counties).size : null;
    const currentState = state();
    const title = '<div class="section-head"><div><div class="eyebrow">ACCOUNTABILITY · DOCUMENTED EVIDENCE</div><h2>'+icon+'<span>Reporting transparency</span></h2><p>What was reported, when it appeared, and how differences were resolved.</p></div><span class="rt-status'+(failure || stale(value)?' rt-warning':'')+'">'+esc(currentState)+'</span></div>';
    const scheduleState = ledger?.schedule?.enabled === true ? 'Enabled' : ledger?.schedule?.enabled === false ? 'Paused' : 'Not yet confirmed';
    const clocks = timeBlock(value)+'<p class="rt-cadence"><b>Research schedule · '+scheduleState+':</b> '+cadence+'.<br>Publication follows a completed, validated check. Source cutoffs remain attached to each record.</p>';
    const intro = available ? '<p class="rt-lead">'+esc(ledger.summary)+'</p><div class="rt-metrics"><div><b>'+counties+' <small>/ 254</small></b><span>Counties with source reviews</span></div><div><b>'+cases.length+'</b><span>Cases documented in this log</span></div><div><b>'+sources.length+'</b><span>Source checks retained</span></div></div><p class="rt-measure-limit">A source review is not full reconciliation. No logged case does not mean no discrepancies exist. Missing times remain unknown.</p>' : '<div class="rt-empty"><strong>Evidence collection is being established.</strong><p>No reporting baseline is available in this view. Exact county–state communication times have not been established.</p></div>';
    const download = available && versionPattern.test(value.version) ? '<a class="rt-download" href="/reporting-transparency.json?version='+encodeURIComponent(value.version)+'">Download this evidence log <span aria-hidden="true">↓</span></a>' : '';
    const methodology = available && Array.isArray(ledger.methodology) ? ledger.methodology : ['Public appearance, submission, receipt and acknowledgment are different events.','Exact response times require timestamped evidence for both endpoints. Two-hour observations establish windows, not minute-precise delays.','Compare the same county, voting mode, voting date and reporting cutoff. A reporting difference does not establish missing votes.'];
    return title+clocks+intro+(failure?'<p class="rt-warning-note" role="status">The latest publication check could not be verified. '+(available?'The prior evidence and its original dates are retained.':'No unverified evidence has been substituted.')+'</p>':'')+(value?.last_attempt?.status==='failed'?'<p class="rt-warning-note">The last research publication failed'+(value.last_attempt.at?' · '+esc(time(value.last_attempt.at)):'')+'. The last successful review remains visible.</p>':'')+
      '<div class="rt-case-list">'+(cases.length?cases.map(item=>caseHTML(item,value)).join(''):available?'<div class="rt-empty"><strong>No verified case timeline is published yet.</strong><p>Source-access findings are below. No delay, response-time average or blame ranking is inferred from missing records.</p></div>':'')+'</div>'+ 
      '<details class="rt-detail-group" data-rt-detail="sources"><summary>Source checks'+(available?' · '+sources.length:'')+'</summary>'+(sources.length?'<div class="rt-sources">'+sources.map(sourceHTML).join('')+'</div>':'<p>No source checks are published yet.</p>')+'</details><details class="rt-detail-group" data-rt-detail="methods"><summary>How timing and discrepancies are measured</summary><ul>'+methodology.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul><p>Reported-only media claims stay separate from official records. Resolved cases and corrections remain visible. These standards apply to counties, the state and Civic Telemetry alike.</p></details>'+download;
  }
  function replace(node, html) {
    if (!node || node.dataset.rtMarkup === html) return;
    const open = [...node.querySelectorAll('details[open][data-rt-detail]')].map(item=>item.dataset.rtDetail);
    const active = document.activeElement, focusDetail = node.contains(active) ? active.closest('details[data-rt-detail]')?.dataset.rtDetail : null;
    node.innerHTML = html; node.dataset.rtMarkup = html;
    node.querySelectorAll('details[data-rt-detail]').forEach(item=>{if(open.includes(item.dataset.rtDetail))item.open=true;if(focusDetail===item.dataset.rtDetail)item.querySelector('summary')?.focus({preventScroll:true});});
  }
  function mount() {
    const compact = document.getElementById('county-reporting-transparency');
    replace(compact, compactHTML(current));
    const destination = compact?.querySelector('a[data-open]');
    if (destination) destination.onclick = event=>{if(typeof showTab==='function' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();showTab('evidence',true,{section:'reporting-transparency'});}};
    replace(document.getElementById('reporting-transparency'), fullHTML(current));
    document.querySelectorAll('[data-reporting-navigation-time]').forEach(node=>node.textContent='Reporting review · '+time(current?.reviewed_at));
  }
  async function refresh(initial=false) {
    if (inFlight || (!initial && document.hidden)) return;
    inFlight=true;
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('/api/reporting-transparency',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Unavailable');
      const candidate=await response.json();
      if(!valid(candidate))throw Error('Unverified');
      if(current?.status==='published' && (candidate.status!=='published' || Date.parse(candidate.reviewed_at)<Date.parse(current.reviewed_at)))throw Error('Older response');
      current=candidate; failure=false;
    } catch { failure=true; }
    finally {clearTimeout(timeout);inFlight=false;mount();}
  }
  window.ReportingTransparency={mount,refresh};
  // Expose pure renderers only in an explicitly isolated test context.
  if(window.__REPORTING_TEST__)window.ReportingTransparency.test={esc,time,safeURL,valid,compactHTML,fullHTML,sourceHTML,caseHTML,caseMetrics,duration,getCurrent:()=>current,failed:()=>failure,setCurrent:value=>{current=value;failure=false;}};
  mount();refresh(true);
  setInterval(()=>refresh(),60000);
  document.addEventListener('civic:render',mount);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}());
