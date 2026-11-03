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
  let mount = null, timer = null;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }

  function raceTable(r) {
    const rows = r.candidates.slice(0, 4).map(c => `<tr><td><span class="rt-chip ${pclass(c.party)}">${esc(party(c.party))}</span> ${esc(c.name)}</td><td class="num">${n(c.votes)}</td><td class="num">${pct(c.pct)}</td><td class="num muted">${n(c.early_votes)}</td></tr>`).join('');
    return `<div class="rt-race"><h4>${esc(r.office)}</h4><table><thead><tr><th>Candidate</th><th class="num">Votes</th><th class="num">Share</th><th class="num">Early</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="rt-foot">Total ${n(r.total_votes)} · leader margin ${n(r.margin_votes)} votes</p></div>`;
  }

  function countyTable(d) {
    const key = d.key_races.filter(r => /SENATOR|GOVERNOR/.test(r.office) && !/LIEUTENANT/.test(r.office)).map(r => r.race_id);
    const head = d.key_races.filter(r => key.includes(r.race_id)).map(r => `<th>${esc(r.office.replace('U. S. ', 'U.S. ').replace(/\s+$/, ''))}</th>`).join('');
    const rows = d.counties.slice().sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0)).map(c => {
      const cells = key.map(id => { const r = c.races.find(x => x.race_id === id); if (!r || !r.leader) return '<td class="muted">—</td>'; return `<td><span class="rt-chip ${pclass(r.leader.party)}">${esc(party(r.leader.party))}</span> ${esc(r.leader.name.split('/')[0])} <span class="muted">+${n(r.margin_votes)}</span></td>`; }).join('');
      return `<tr><td>${esc(c.county)}</td><td class="num">${n(c.total_votes)}</td>${cells}</tr>`;
    }).join('');
    return `<table class="rt-counties"><thead><tr><th>County</th><th class="num">Votes counted</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function callsTable(c) {
    if (!c || !Array.isArray(c.calls) || !c.calls.length) return '<p class="rt-foot">No race calls recorded. A call is an outlet\'s projection, never a count; this register lists outlet, time and link when one is recorded.</p>';
    const rows = c.calls.map(x => `<tr><td>${esc(x.race)}</td><td>${esc(x.called_for)}</td><td>${esc(x.outlet)}</td><td>${x.called_at ? central(x.called_at) : '—'}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">source ↗</a>` : '—'}</td></tr>`).join('');
    return `<table><thead><tr><th>Race</th><th>Called for</th><th>Outlet</th><th>Time</th><th>Link</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function render(d, c) {
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
      <p class="rt-foot">${esc(d.election && d.election.name)} · SOS last updated ${esc(d.sos_last_updated)} · fetched ${central(d.fetched_at)}</p>
      ${bar(rep.counties, 'Counties reporting')}${bar(rep.precincts, 'Precincts reporting')}
      <div class="rt-grid">${d.key_races.map(raceTable).join('')}</div>
      <h4>Monitored counties</h4>${countyTable(d)}
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
    if (!noticesCache) { try { noticesCache = await getJSON('/api/notices'); } catch (e) { noticesCache = null; } }
    render(d, c);
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
