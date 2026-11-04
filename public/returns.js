/* Election-night returns panel. Independent stream: /api/returns (Texas SOS counts) and /api/calls
   (outlet projections register). Counts and calls are never mixed: a call is shown with its outlet,
   time and link; a count is shown with its SOS data version and reporting state. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toLocaleString('en-US');
  const pct = v => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(1) + '%';
  const party = p => ({ REP: 'R', DEM: 'D', LIB: 'L', GRE: 'G', IND: 'I', W: 'W' }[p] || p || '');
  const pclass = p => ({ REP: 'rt-r', DEM: 'rt-d' }[p] || 'rt-o');
  const central = iso => { const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); };
  // SOS publishes 'Nov 04, 2026 01:28:46' in UTC with no zone marker; show it in Central, keep the raw string on hover.
  const sosTime = s => { const m = /^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim()); if (!m) return esc(s); const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1]); if (mo < 0) return esc(s); const d = new Date(Date.UTC(+m[3], mo, +m[2], +m[4], +m[5], +m[6])); return `<span title="SOS clock: ${esc(s)} UTC">${central(d.toISOString())}</span>`; };
  const countyName = s => String(s || '').replace(/\bMclennan\b/, 'McLennan').replace(/\bDewitt\b/, 'DeWitt').replace(/\bMcmullen\b/, 'McMullen').replace(/\bMcculloch\b/, 'McCulloch');
  let mount = null, timer = null;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }

  function raceTable(r) {
    const rows = r.candidates.slice(0, 4).map(c => `<tr><td><span class="rt-chip ${pclass(c.party)}">${esc(party(c.party))}</span> ${esc(c.name)}</td><td class="num">${n(c.votes)}</td><td class="num">${pct(c.pct)}</td><td class="num muted">${n(c.early_votes)}</td></tr>`).join('');
    return `<div class="rt-race"><h4>${esc(r.office)} <span class="muted">(SOS partial)</span></h4><table><thead><tr><th>Candidate</th><th class="num">Votes</th><th class="num">Share</th><th class="num">Early</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="rt-foot">SOS partial: ${n(r.total_votes)} votes counted · current margin ${n(r.margin_votes)} votes</p></div>`;
  }

  // SOS statewide figures are a partial sum of the counties that have uploaded to the SOS platform. Large
  // counties post to their own sites (and to the AP) before they appear here, so the SOS partial can lean the
  // opposite way from every outlet. Say so, and put the aggregator's statewide figures beside the SOS ones.
  function aggregatorTables(v) {
    const comps = ((v && v.comparisons) || []).filter(c => c.state === 'TX' && c.aggregator && (c.rows || []).length);
    if (!comps.length) return '';
    const at = v.aggregator && v.aggregator.fetched_at;
    const tables = comps.map(c => {
      const rows = (c.rows || []).filter(r => r.in_aggregator && r.aggregator_votes > 0).sort((a, b) => b.aggregator_votes - a.aggregator_votes).slice(0, 4);
      const tr = rows.map(r => `<tr><td>${chip(r.party)} ${esc(r.candidate)}</td><td class="num">${n(r.aggregator_votes)}</td><td class="num">${pct(r.aggregator_pct)}</td></tr>`).join('');
      const lead = rows[0], second = rows[1];
      return `<div class="rt-race"><h4>${esc(c.contest)} — statewide</h4><table><thead><tr><th>Candidate</th><th class="num">Votes</th><th class="num">Share</th></tr></thead><tbody>${tr}</tbody></table>
        <p class="rt-foot">${pct(c.aggregator.percent_reporting)} reporting · ${n(c.aggregator.total_votes)} votes · margin ${lead && second ? n(lead.aggregator_votes - second.aggregator_votes) : '—'} · ${c.aggregator.called ? 'called by civicAPI' : 'not called'}</p></div>`;
    }).join('');
    return `<h4>Statewide count — county-direct aggregator (civicAPI)</h4><p class="rt-foot">Counts as reported by county election authorities and aggregated by civicAPI; this is the same county-direct basis wire services use, and it runs ahead of the Secretary of State's platform while large counties upload. Fetched ${at ? central(at) : '—'}. Unofficial; not a Civic Telemetry call.</p><div class="rt-grid">${tables}</div>`;
  }

  function crossCheck(d, v) {
    const rep = d.reporting || {}, cr = rep.counties || {};
    const missing = (d.counties || []).filter(c => !(c.races || []).some(r => r.total_votes > 0)).map(c => countyName(c.county));
    const comps = ((v && v.comparisons) || []).filter(c => c.state === 'TX' && c.official && c.aggregator);
    const partial = cr.reported != null && cr.total && cr.reported < cr.total;
    if (!partial && !comps.some(c => (c.flags || []).length)) return '';
    const rows = comps.map(c => {
      const off = (c.official.candidates || []).filter(x => !x.write_in).slice(0, 2);
      const agg = c.aggregator || {};
      const aggRows = (c.rows || []).filter(r => off.some(o => o.name === r.candidate));
      const cells = off.map(o => { const a = aggRows.find(r => r.candidate === o.name) || {}; return `<tr><td><span class="rt-chip ${pclass(o.party)}">${esc(party(o.party))}</span> ${esc(o.name)}</td><td class="num">${pct(o.pct)}</td><td class="num">${pct(a.aggregator_pct)}</td><td class="num ${Math.abs(a.gap_points || 0) >= 0.5 ? 'rt-gap' : 'muted'}">${a.gap_points == null ? '—' : (a.gap_points > 0 ? '+' : '') + Number(a.gap_points).toFixed(1)}</td></tr>`; }).join('');
      return `<div class="rt-race"><h4>${esc(c.contest)}</h4><table><thead><tr><th>Candidate</th><th class="num">SOS partial</th><th class="num">Aggregator</th><th class="num">Gap (pts)</th></tr></thead><tbody>${cells}</tbody></table>
        <p class="rt-foot">SOS ${n(c.official.total_votes)} votes from ${n(cr.reported)} of ${n(cr.total)} counties · aggregator ${n(agg.total_votes)} votes, ${pct(agg.percent_reporting)} reporting${v && v.aggregator && v.aggregator.fetched_at ? ' (fetched ' + central(v.aggregator.fetched_at) + ')' : ''}${(c.flags || []).length ? ' · <b>flagged: ' + esc((c.flags || []).join(', ')) + '</b>' : ''}</p></div>`;
    }).join('');
    return `<h4>Official Secretary of State feed — partial</h4><div class="callout rt-crosscheck"><strong>Read the SOS numbers as a partial.</strong> ${n(cr.reported)} of ${n(cr.total)} counties have uploaded results to the Secretary of State's platform.${missing.length ? ' Not yet in the SOS feed: <b>' + esc(missing.join(', ')) + '</b>.' : ''} Large counties publish to their own sites and to wire services before they reach SOS, so the SOS statewide share can differ sharply from what outlets show. The verification stream compares the SOS partial with the county-direct aggregator below; a gap over 0.5 points is flagged, not hidden.</div>
      ${rows ? '<h4>SOS partial vs aggregator (statewide)</h4><div class="rt-grid">' + rows + '</div>' : ''}`;
  }

  function countyTable(d) {
    const key = d.key_races.filter(r => /SENATOR|GOVERNOR/.test(r.office) && !/LIEUTENANT/.test(r.office)).map(r => r.race_id);
    const head = d.key_races.filter(r => key.includes(r.race_id)).map(r => `<th>${esc(r.office.replace('U. S. ', 'U.S. ').replace(/\s+$/, ''))}</th>`).join('');
    const senateVotes = c => { const r = (c.races || []).find(x => x.race_id === key[0]); return r ? r.total_votes : null; };
    const rows = d.counties.slice().sort((a, b) => (senateVotes(b) || 0) - (senateVotes(a) || 0)).map(c => {
      const sv = senateVotes(c);
      const cells = key.map(id => { const r = c.races.find(x => x.race_id === id); if (!r || !r.leader) return '<td class="muted">—</td>'; return `<td><span class="rt-chip ${pclass(r.leader.party)}">${esc(party(r.leader.party))}</span> ${esc(r.leader.name.split('/')[0])} <span class="muted">+${n(r.margin_votes)}</span></td>`; }).join('');
      return `<tr><td>${esc(countyName(c.county))}</td><td class="num">${sv ? n(sv) : '<span class="muted">not in SOS feed yet</span>'}</td>${cells}</tr>`;
    }).join('');
    return `<table class="rt-counties"><thead><tr><th>County</th><th class="num">Votes in U.S. Senate race</th>${head}</tr></thead><tbody>${rows}</tbody></table><p class="rt-foot">A county shows "not in SOS feed yet" until its results reach the Secretary of State's platform; counties publish to their own sites first.</p>`;
  }

  function compactRaces(d, pred, title, label, ac) {
    const rs = (d.races || []).filter(pred);
    if (!rs.length) return '';
    const rows = rs.map(r => {
      const l = r.leader, cs = r.candidates || [];
      const top = cs.slice(0, 2).map(c => `${esc(party(c.party))} ${esc(c.name)} ${n(c.votes)}`).join(' · ');
      const code = r.office.replace('U. S. REPRESENTATIVE DISTRICT', 'TX-').replace(/\s+/g, '').replace(/^TX-0?/, 'TX-');
      const call = ac && ac.house && ac.house[code];
      const callCell = ac ? `<td>${call ? chip(call.party) + ' ' + esc(call.name) + ' <span class="muted">civicAPI</span>' : '<span class="muted">not called</span>'}</td>` : '';
      return `<tr><td>${esc(r.office.replace('U. S. REPRESENTATIVE DISTRICT', 'TX-').replace(/\s+/g, ' '))}</td><td>${l ? chip(l.party) + ' ' + esc(l.name) : '<span class="muted">—</span>'}</td><td class="num">${n(r.margin_votes)}</td><td class="num">${n(r.total_votes)}</td>${callCell}<td class="muted">${top}</td></tr>`;
    }).join('');
    return `<details class="rt-more"><summary>${esc(title)} (${rs.length})</summary><div class="nt-scroll"><table><thead><tr><th>${esc(label)}</th><th>Leader</th><th class="num">Margin</th><th class="num">Votes</th>${ac ? '<th>Called (civicAPI)</th>' : ''}<th>Top two</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }
  const chip = p => `<span class="rt-chip ${pclass(p)}">${esc(party(p))}</span>`;

  // civicAPI decision-desk calls for Texas races (from /api/national). Labelled as civicAPI's calls; they are not
  // outlet projections (the register below) and not counts.
  function aggregatorCalls(nat) {
    const out = { senate: null, governor: null, house: {}, asOf: {} };
    if (!nat || !nat.chambers) return out;
    const sen = nat.chambers.senate, gov = nat.chambers.governors, house = nat.chambers.house;
    const tx = ch => ((ch && ch.regions) || []).find(r => r.code === 'TX');
    out.senate = tx(sen) && tx(sen).called; out.asOf.senate = sen && sen.last_updated;
    out.governor = tx(gov) && tx(gov).called; out.asOf.governor = gov && gov.last_updated;
    ((house && house.regions) || []).filter(r => /^TX-/.test(r.code)).forEach(r => { if (r.called) out.house[r.code.replace(/^TX-0?/, 'TX-')] = r.called; });
    out.asOf.house = house && house.last_updated; out.carried = { senate: !!(sen && sen.carried), governor: !!(gov && gov.carried), house: !!(house && house.carried) };
    return out;
  }
  function aggregatorCallsHTML(ac) {
    if (!ac || !ac.asOf) return '';
    const houseList = Object.entries(ac.house).sort((a, b) => Number(a[0].slice(3)) - Number(b[0].slice(3)));
    const row = (race, call, asOf, carried) => `<tr><td>${esc(race)}</td><td>${call ? chip(call.party) + ' ' + esc(call.name) : '<span class="muted">not called</span>'}</td><td class="muted">${asOf ? central(asOf) : '—'}${carried ? ' · last-known' : ''}</td></tr>`;
    return `<h4>civicAPI decision-desk calls — Texas</h4><p class="rt-foot">Calls made by the aggregator's own desk, shown with the aggregator's source clock. Not an outlet projection, not an official result, not a Civic Telemetry call.</p>
      <table><thead><tr><th>Race</th><th>civicAPI call</th><th>Source updated</th></tr></thead><tbody>${row('U.S. Senate', ac.senate, ac.asOf.senate, ac.carried.senate)}${row('Governor', ac.governor, ac.asOf.governor, ac.carried.governor)}${houseList.map(([k, v]) => row('U.S. House ' + k, v, ac.asOf.house, ac.carried.house)).join('')}</tbody></table>
      <p class="rt-foot">${houseList.length} of 38 Texas U.S. House districts called by civicAPI${houseList.length ? '' : ' so far'}.</p>`;
  }

  function callsTable(c) {
    if (!c || !Array.isArray(c.calls) || !c.calls.length) return '<p class="rt-foot">No race calls recorded. A call is an outlet\'s projection, never a count; this register lists outlet, time and link when one is recorded.</p>';
    const rows = c.calls.map(x => `<tr><td>${esc(x.race)}</td><td>${esc(x.called_for)}</td><td>${esc(x.outlet)}</td><td>${x.called_at ? central(x.called_at) : '—'}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">source ↗</a>` : '—'}</td></tr>`).join('');
    return `<table><thead><tr><th>Race</th><th>Called for</th><th>Outlet</th><th>Time</th><th>Link</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function render(d, c, v, nat) {
    if (!mount) return;
    if (!d || d.status !== 'active') {
      const why = d && d.status === 'awaiting_activation' ? 'The Secretary of State activates election-night returns after polls close (7 p.m. Central). This panel switches on automatically; counts will appear here with the SOS data version and reporting progress.'
        : d && d.status === 'unreachable' ? 'The Secretary of State returns feed could not be reached at the last check.' : 'Returns stream unavailable.';
      mount.innerHTML = `<div class="rt-head"><h3>Election night returns</h3><span class="badge">${esc((d && d.status) || 'unavailable')}</span></div><p>${why}</p><p class="rt-foot">Source: <a href="https://results.texas-election.com/" target="_blank" rel="noopener">Texas Secretary of State — Election Night Returns ↗</a>${d && d.checked_at ? ' · checked ' + central(d.checked_at) : ''}</p>`;
      return;
    }
    const rep = d.reporting || {};
    const bar = (x, label) => { const a = x && x.reported, b = x && x.total; const w = (a && b) ? Math.round(100 * a / b) : 0; return `<div class="rt-bar"><span>${label}</span><div><i style="width:${w}%"></i></div><b>${n(a)} / ${n(b)}</b></div>`; };
    mount.innerHTML = `<div class="rt-head"><h3>Election night returns</h3><span class="badge">unofficial · SOS data v${esc(d.source.data_version)}</span></div>
      <p class="rt-foot">${esc(d.election && d.election.name)} · SOS last updated ${sosTime(d.sos_last_updated)} · fetched ${central(d.fetched_at)}${d.carried ? ' · <b>last-known</b> — SOS platform did not answer at ' + central(d.last_checked_at) + (d.source_error && d.source_error.detail && d.source_error.detail.status ? ' (HTTP ' + esc(d.source_error.detail.status) + ')' : '') + '; figures are the last successful fetch' : ''}</p>
      ${bar(rep.counties, 'Counties uploaded to SOS')}${(rep.precincts && rep.precincts.total >= 1000) ? bar(rep.precincts, 'Precincts reporting') : ''}${(rep.polling_locations && rep.polling_locations.total) ? bar(rep.polling_locations, 'Polling locations reporting') : ''}
      ${aggregatorTables(v)}
      ${crossCheck(d, v)}
      <div class="rt-grid">${d.key_races.map(raceTable).join('')}</div>
      ${compactRaces(d, r => r.category === 'federal' && /^U\. S\. REPRESENTATIVE/.test(r.office), 'U.S. House — all Texas districts (SOS partial; civicAPI call column)', 'District', aggregatorCalls(nat))}
      ${compactRaces(d, r => r.category === 'statewide' && !d.key_races.some(k => k.race_id === r.race_id), 'Other statewide races', 'Office')}
      <h4>Monitored counties</h4>${countyTable(d)}
      ${aggregatorCallsHTML(aggregatorCalls(nat))}
      <h4>Race calls (outlet projections)</h4>${callsTable(c)}
      <p class="rt-foot">${d.rules.map(esc).join(' ')} Source: <a href="${esc(d.source.url)}" target="_blank" rel="noopener">${esc(d.source.name)} ↗</a>. Every fetched payload is archived by hash; see <a href="/returns/${esc(d.version)}.json">this version</a>.</p>`;
  }

  let noticesCache = null;
  function noticesHTML(nt) {
    const list = ((nt && nt.sources) || []).filter(s => (s.panels || []).includes('returns'));
    if (!list.length) return '';
    return `<details class="rt-notices"><summary>Sources and required notices (${list.length})</summary><ul>${list.map(s => `<li><b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a></b> <span class="badge">${esc(s.review_status)}</span><br>${esc(s.notice)}<br><span class="muted">${esc(s.attribution)}</span></li>`).join('')}</ul></details>`;
  }
  async function refresh() {
    let d = null, c = null;
    try { d = await getJSON('/api/returns'); } catch (e) { d = { status: 'unavailable' }; }
    try { c = await getJSON('/api/calls'); } catch (e) { c = null; }
    let v = null; try { v = await getJSON('/api/verification'); } catch (e) { v = null; }
    let nat = null; try { nat = await getJSON('/api/national'); } catch (e) { nat = null; }
    if (!noticesCache) { try { noticesCache = await getJSON('/api/notices'); } catch (e) { noticesCache = null; } }
    render(d, c, v, nat);
    window.CT_RETURNS_FETCHED = (d && d.status === 'active') ? d.fetched_at : null;
    const mt = document.getElementById('edition-date'); if (mt && window.CT_RETURNS_FETCHED) mt.textContent = 'Returns fetched ' + central(window.CT_RETURNS_FETCHED) + ' · analysis reviewed ' + (typeof DATA !== 'undefined' && DATA ? DATA.reviewed_at : '');
    if (mount && noticesCache) mount.insertAdjacentHTML('beforeend', noticesHTML(noticesCache));
    const congress = document.getElementById('ct-congress');
    if (mount && congress && !congress.hidden) mount.hidden = true;
  }

  function mountPanel() {
    if (mount) return;
    const anchor = document.getElementById('snapshot-status') || document.querySelector('.nav');
    if (!anchor) return;
    mount = document.createElement('section');
    mount.id = 'returns-panel';
    mount.className = 'rt-panel';
    mount.setAttribute('aria-label', 'Election night returns');
    anchor.after(mount);
    refresh();
    timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }

  window.ReturnsPanel = { mount: mountPanel, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mountPanel, 800));
  else setTimeout(mountPanel, 800);
})();
