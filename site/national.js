/* National layer panel (U.S. Congress view). Streams: /api/national (civicAPI backbone), /api/verification
   (official state feeds compared against the aggregator), /api/calls (outlet projections register) and
   /api/notices (the attribution and notice each source requires). Counts, aggregator calls and outlet calls
   are three different things and are labelled as three different things. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toLocaleString('en-US');
  const pct = v => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(1) + '%';
  const pclass = p => ({ REP: 'rt-r', DEM: 'rt-d' }[p] || 'rt-o');
  const chip = p => `<span class="rt-chip ${pclass(p)}">${esc(({ REP: 'R', DEM: 'D', LIB: 'L', GRE: 'G', IND: 'I' })[p] || p || '')}</span>`;
  const central = iso => { const d = new Date(iso); return isNaN(d) ? esc(iso || '') : d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); };
  let mount = null, timer = null;
  async function getJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); }

  function balance(ch, label) {
    if (!ch || ch.status !== 'active') return `<div class="nt-balance"><h4>${esc(label)}</h4><p class="rt-foot">Stream unavailable.</p></div>`;
    const calls = ch.calls_by_party || {};
    const parts = Object.keys(calls).sort().map(p => `${chip(p)} ${n(calls[p])}`).join(' &nbsp; ');
    const err = ch.source_error || {};
    const why = err.kind === 'http' ? 'HTTP ' + esc(err.status) : err.kind === 'timeout' ? 'timed out' : err.kind ? esc(err.kind) : 'unreachable';
    const carried = ch.carried ? ` · <b>last-known</b> — aggregator ${why} on the latest fetch; figures from ${central(ch.carried_from_fetch)}` : '';
    return `<div class="nt-balance ${(ch.stale || ch.carried) ? 'nt-stale' : ''}"><h4>${esc(label)}</h4>
      <div class="nt-big">${ch.regions_called} <small>of ${ch.regions_total} called</small></div>
      <div class="nt-parts">${parts || '<span class="muted">No calls yet</span>'}</div>
      <p class="rt-foot">Reporting ${pct(ch.percent_reporting)} · source updated ${central(ch.last_updated)}${ch.stale ? ' · <b>stale</b>' : ''}${carried}</p></div>`;
  }

  function stateTable(ch, title) {
    if (!ch || ch.status !== 'active') return '';
    const rows = ch.regions.map(r => {
      const l = r.leader, c = r.called;
      return `<tr><td>${esc(r.name)}</td><td>${l ? chip(l.party) + ' ' + esc(l.name) : '<span class="muted">—</span>'}</td><td class="num">${n(r.margin_votes)}</td><td class="num">${pct(r.percent_reporting)}</td><td>${c ? chip(c.party) + ' ' + esc(c.name) + ' <span class="muted">by civicAPI</span>' : '<span class="muted">not called</span>'}</td></tr>`;
    }).join('');
    return `<h4>${esc(title)}</h4><div class="nt-scroll"><table><thead><tr><th>State</th><th>Leader</th><th class="num">Margin</th><th class="num">Reporting</th><th>Call</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function houseSummary(ch) {
    if (!ch || ch.status !== 'active') return '';
    const called = ch.regions.filter(r => r.called);
    const rows = called.slice(0, 60).map(r => `<tr><td>${esc(r.code)}</td><td>${chip(r.called.party)} ${esc(r.called.name)}</td><td class="num">${pct(r.percent_reporting)}</td></tr>`).join('');
    return `<h4>U.S. House · ${called.length} of ${ch.regions_total} districts called by civicAPI</h4>${called.length ? `<details class="nt-details"><summary>Called districts (first ${Math.min(60, called.length)})</summary><div class="nt-scroll"><table><thead><tr><th>District</th><th>Called for</th><th class="num">Reporting</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : '<p class="rt-foot">No House district has been called yet.</p>'}`;
  }

  function verificationTable(v) {
    if (!v || !Array.isArray(v.comparisons) || !v.comparisons.length) return `<h4>Official feeds vs. aggregator</h4><p class="rt-foot">Verification stream unavailable.</p>`;
    const rows = v.comparisons.map(c => {
      const o = c.official || {}, a = c.aggregator || {};
      const flags = (c.flags || []).map(f => `<span class="nt-flag">${esc(f.split(':')[0].replace(/_/g, ' '))}</span>`).join(' ');
      return `<tr><td>${esc(c.state)} ${esc(c.office)}</td><td class="num">${n(o.total_votes)}</td><td class="num">${o.precincts ? n(o.precincts.reported) + ' / ' + n(o.precincts.total) : '—'}</td><td class="num">${n(a.total_votes)}</td><td>${esc(c.status)} ${flags}</td></tr>`;
    }).join('');
    const not = v.not_ingested ? Object.entries(v.not_ingested).map(([s, why]) => `<li><b>${esc(s)}</b>: ${esc(why)}</li>`).join('') : '';
    return `<h4>Official state feeds vs. aggregator</h4><div class="nt-scroll"><table><thead><tr><th>Race</th><th class="num">Official votes</th><th class="num">Precincts</th><th class="num">civicAPI votes</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="rt-foot">Official figures come from each state's own feed; aggregator figures from civicAPI. A flag means the two disagree by more than ${esc(v.gap_threshold_points)} points, list different candidates, or the aggregator's call does not match the official leader. Flags are shown, never resolved by us.</p>${not ? `<ul class="rt-foot nt-list">${not}</ul>` : ''}`;
  }

  function callsTable(c) {
    if (!c || !Array.isArray(c.calls) || !c.calls.length) return '<h4>Race calls by news outlets</h4><p class="rt-foot">No outlet call recorded yet. Each entry names the outlet, the time and links to its report.</p>';
    const rows = c.calls.map(x => `<tr><td>${esc(x.race)}</td><td>${esc(x.called_for)}</td><td>${esc(x.outlet)}${x.source_family ? ` <span class="muted">(${esc(x.source_family)} data)</span>` : ''}</td><td>${x.called_at ? central(x.called_at) : '—'}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">report ↗</a>` : '—'}</td></tr>`).join('');
    return `<h4>Race calls by news outlets</h4><div class="nt-scroll"><table><thead><tr><th>Race</th><th>Called for</th><th>Outlet</th><th>Time</th><th>Link</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function notices(nt, panels) {
    const list = ((nt && nt.sources) || []).filter(s => (s.panels || []).some(p => panels.includes(p)));
    if (!list.length) return '';
    return `<h4>Sources and required notices</h4><ul class="nt-notices">${list.map(s => `<li><b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a></b> <span class="badge">${esc(s.review_status)}</span><br>${esc(s.notice)}<br><span class="muted">${esc(s.attribution)} · licence: ${esc(s.license)}</span></li>`).join('')}</ul>`;
  }

  function render(d, v, c, nt) {
    if (!mount) return;
    const page = document.getElementById('ct-congress');
    if (!d || d.status !== 'active') {
      mount.innerHTML = `<div class="rt-head"><h3>National results</h3><span class="badge">${esc((d && d.status) || 'unavailable')}</span></div><p class="rt-foot">The national results stream could not be read at the last check.</p>${notices(nt, ['national'])}`;
      page && page.classList.remove('ct-live');
      return;
    }
    page && page.classList.add('ct-live');
    const ch = d.chambers || {};
    const anyStale = Object.values(ch).some(x => x.stale);
    const carriedKeys = Object.keys(ch).filter(k => ch[k] && ch[k].carried);
    const downKeys = Object.keys(ch).filter(k => ch[k] && ch[k].status !== 'active');
    mount.innerHTML = `<div class="rt-head"><h3>National results</h3><span class="badge">unofficial · via civicAPI · checked ${central(d.fetched_at)}</span></div>
      ${anyStale ? '<p class="callout"><strong>Stale feed.</strong> One or more chambers have not updated within the stale window since polls began closing. Figures shown are last-known, not live.</p>' : ''}
      ${carriedKeys.length ? `<p class="callout"><strong>Aggregator intermittent.</strong> civicAPI did not answer for ${esc(carriedKeys.join(', '))} on the latest check (after retries). Those cards show the last successfully fetched figures, labelled with their fetch time; they refresh automatically when the aggregator answers again.</p>` : ''}
      ${downKeys.length ? `<p class="callout"><strong>No data yet for ${esc(downKeys.join(', '))}.</strong> civicAPI has not answered for this chamber and nothing earlier is held to show.</p>` : ''}
      <div class="nt-grid">${balance(ch.senate, 'U.S. Senate')}${balance(ch.house, 'U.S. House')}${balance(ch.governors, 'Governors')}</div>
      ${stateTable(ch.senate, 'U.S. Senate by state')}
      ${stateTable(ch.governors, 'Governors by state')}
      ${houseSummary(ch.house)}
      ${verificationTable(v)}
      ${callsTable(c)}
      <p class="rt-foot">${(d.rules || []).map(esc).join(' ')}</p>
      ${notices(nt, ['national', 'verification'])}`;
    const badge = page && page.querySelector('header .badge'); if (badge) badge.textContent = 'Live · unofficial returns';
    const lede = page && page.querySelector('header p'); if (lede) lede.textContent = 'Senate, House and governor returns nationwide, with official state feeds checked against the aggregator. Return to Texas at any time.';
  }

  async function refresh() {
    let d = null, v = null, c = null, nt = null;
    try { d = await getJSON('/api/national'); } catch (e) { d = { status: 'unavailable' }; }
    try { v = await getJSON('/api/verification'); } catch (e) { v = null; }
    try { c = await getJSON('/api/calls'); } catch (e) { c = null; }
    try { nt = await getJSON('/api/notices'); } catch (e) { nt = null; }
    render(d, v, c, nt);
  }

  function mountPanel() {
    if (mount) return;
    const page = document.getElementById('ct-congress');
    if (!page) { setTimeout(mountPanel, 500); return; }
    mount = document.createElement('section');
    mount.id = 'national-panel'; mount.className = 'rt-panel nt-panel'; mount.setAttribute('aria-label', 'National results');
    const header = page.querySelector('header');
    header ? header.after(mount) : page.prepend(mount);
    refresh();
    timer = setInterval(() => { if (!document.hidden && !page.hidden) refresh(); }, 60000);
  }
  window.NationalPanel = { mount: mountPanel, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mountPanel, 900));
  else setTimeout(mountPanel, 900);
})();
