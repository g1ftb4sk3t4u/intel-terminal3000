/* Election Watch / Intel Terminal 3000: independently sourced results, no race projections. */
(() => {
  'use strict';
  const API = 'https://openamerica.io/elections/results.json?year=2026&office=';
  const INTERVAL = 15 * 60 * 1000;
  const OFFICES = ['House','Senate','Governor'];
  const LOCATIONS = {
    AR:[34.75,-92.29],AZ:[33.45,-112.07],CO:[39.74,-104.99],CT:[41.76,-72.68],
    FL:[30.44,-84.28],GA:[33.75,-84.39],IA:[41.59,-93.62],ID:[43.62,-116.2],
    IN:[39.77,-86.16],LA:[30.45,-91.19],MI:[42.73,-84.55],MN:[44.95,-93.09],
    NC:[35.78,-78.64],PA:[40.27,-76.88],RI:[41.82,-71.41],SC:[34,-81.03],
    TX:[30.27,-97.74],UT:[40.76,-111.89],VA:[37.54,-77.44],VT:[44.26,-72.58],
    WA:[47.04,-122.9],WV:[38.35,-81.63]
  };
  const state = { view:'overview', office:'House', feeds:{}, news:[], map:null, markers:null, timer:null, lastCheck:null, message:'' };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—';
  const time = date => date ? new Date(date).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'Not reported';
  const current = () => document.body.dataset.intelPage === 'elections';
  const root = () => document.getElementById('dashboardContainer');
  const badge = (p) => p === 'D' ? 'Dem' : p === 'R' ? 'Rep' : p === 'I' ? 'Ind' : p || '—';
  const byState = key => String(key).slice(0,2).toUpperCase();
  const getRaces = () => Object.entries(state.feeds[state.office]?.races || {});
  function shell() {
    if(!root()) return;
    root().className = 'dashboard-container election-workspace';
    root().innerHTML = `
      <div class="election-app">
        <section class="election-hero">
          <div><span class="election-eyebrow">INTEL TERMINAL 3000 / CIVIC INTELLIGENCE</span>
          <h2>ELECTION WATCH <span>2026</span></h2>
          <p>U.S. midterm election operations desk · November 3, 2026</p></div>
          <div class="election-hero-actions"><span id="electionStatus">Awaiting source check</span><button type="button" id="electionRefresh">↻ Refresh now</button></div>
        </section>
        <nav class="election-tabs" aria-label="Election dashboards">
          <button type="button" data-election-view="overview">National overview</button>
          <button type="button" data-election-view="house">House races</button>
          <button type="button" data-election-view="senate">Senate races</button>
          <button type="button" data-election-view="governor">Governors</button>
          <button type="button" data-election-view="news">News wire</button>
        </nav>
        <section class="election-metrics">
          <article><small>Tracked results</small><strong id="electionRaceCount">—</strong><span>Selected office · partial states</span></article>
          <article><small>Votes recorded</small><strong id="electionVoteCount">—</strong><span>In currently listed races</span></article>
          <article><small>Source reports</small><strong id="electionAsOf">—</strong><span>Latest state update</span></article>
          <article><small>Refresh cadence</small><strong>15 min</strong><span id="electionLastCheck">Next after first fetch</span></article>
        </section>
        <section class="election-main-grid">
          <div class="election-panel election-map-panel">
            <header><div><small>GEOGRAPHIC SITUATIONAL AWARENESS</small><h3>Reporting-state map</h3></div>
              <select id="electionOffice" aria-label="Election office"><option value="House">U.S. House</option><option value="Senate">U.S. Senate</option><option value="Governor">Governors</option></select></header>
            <div id="electionMap" aria-label="Map of states with available unofficial results"></div>
            <div class="election-map-caption">Pins locate states supported by the data provider, not individual districts. Color indicates availability, not party preference, winner, or outcome. <a href="https://openamerica.io/elections/api/" target="_blank" rel="noopener noreferrer">Coverage &amp; methodology</a>.</div>
          </div>
          <div class="election-panel election-races-panel">
            <header><div><small>OFFICIAL COUNTS / UNOFFICIAL RESULTS</small><h3 id="electionListTitle">Reported races</h3></div><span class="election-mini" id="electionCountStatus">Awaiting data</span></header>
            <div class="election-race-list" id="electionRaceList"><p class="election-empty">Retrieving public election-office counts…</p></div>
          </div>
        </section>
        <section class="election-panel election-news-panel">
          <header><div><small>ELECTION NEWS / LINKED SOURCES</small><h3>Latest election-related headlines</h3></div><a href="https://news.google.com/search?q=2026%20US%20midterm%20election&hl=en-US&gl=US&ceid=US%3Aen" target="_blank" rel="noopener noreferrer">Open news search ↗</a></header>
          <div id="electionNews" class="election-news-grid"><p class="election-empty">Scanning the existing Intel Terminal news collector…</p></div>
          <div class="election-news-links"><a href="https://apnews.com/hub/election-2026" target="_blank" rel="noopener noreferrer">AP Elections</a><a href="https://www.reuters.com/world/us/" target="_blank" rel="noopener noreferrer">Reuters U.S.</a><a href="https://www.usa.gov/election-results" target="_blank" rel="noopener noreferrer">Official results directory</a></div>
        </section>
        <footer class="election-footnote">Results: official state election offices via <a href="https://openamerica.io/elections/api/" target="_blank" rel="noopener noreferrer">Open America</a>. Only supported state and office feeds are included. Missing states do not mean zero votes. A candidate leading is not a declared winner. Figures may be revised and are not certified results. This page checks every 15 minutes while open; data providers update on their own schedules.</footer>
      </div>`;
    root().querySelector('#electionRefresh').addEventListener('click', () => refresh(true));
    root().querySelector('#electionOffice').addEventListener('change', e => {state.office=e.target.value; update();});
    root().querySelectorAll('[data-election-view]').forEach(b => b.addEventListener('click', () => {
      state.view=b.dataset.electionView;
      if (state.view==='house') state.office='House';
      if (state.view==='senate') state.office='Senate';
      if (state.view==='governor') state.office='Governor';
      update();
    }));
    state.map=null; state.markers=null;
    if (typeof L !== 'undefined') {
      state.map=L.map('electionMap',{scrollWheelZoom:false,zoomControl:true}).setView([39,-97],4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
        attribution:'© OpenStreetMap contributors © CARTO',maxZoom:10
      }).addTo(state.map);
      state.markers=L.layerGroup().addTo(state.map);
      setTimeout(()=>state.map?.invalidateSize(),100);
    } else {
      document.getElementById('electionMap').textContent='Map provider unavailable. Source data remains available in the race list.';
    }
    update();
  }
  function update() {
    if (!current() || !root()?.classList.contains('election-workspace')) return;
    root().querySelectorAll('[data-election-view]').forEach(b => b.classList.toggle('active',b.dataset.electionView===state.view));
    root().querySelector('#electionOffice').value=state.office;
    const data=state.feeds[state.office], races=getRaces(), total=races.reduce((acc,[,r])=>acc+(Number(r.total)||0),0);
    const newest=data?.as_of;
    root().querySelector('#electionRaceCount').textContent=data ? fmt(races.length) : '—';
    root().querySelector('#electionVoteCount').textContent=data ? fmt(total) : '—';
    root().querySelector('#electionAsOf').textContent=newest ? new Date(newest).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Not posted';
    root().querySelector('#electionAsOf').title=time(newest);
    root().querySelector('#electionLastCheck').textContent=state.lastCheck ? 'Last checked '+state.lastCheck.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Not checked yet';
    root().querySelector('#electionStatus').textContent=state.message || (data?.stale?'Source marked stale':data?.live?'Source reports live counts':data?.counting?'Counts available':'Awaiting results');
    root().querySelector('#electionListTitle').textContent=state.office==='Governor'?'Governor contests':state.office+' contests';
    root().querySelector('#electionCountStatus').textContent=data ? (data.stale?'STALE SOURCE':data.live?'UPDATING':'SOURCE CHECKED') : 'NO SOURCE';
    const sorted=races.slice().sort((a,b)=> (Number(b[1]?.total)||0)-(Number(a[1]?.total)||0));
    const list=root().querySelector('#electionRaceList');
    if (!data) list.innerHTML='<p class="election-empty">Results feed unavailable. Use the official-source links below for the latest returns.</p>';
    else if(!sorted.length) list.innerHTML='<p class="election-empty">No results have been posted for this office in covered states. Check again after polls close.</p>';
    else list.innerHTML=sorted.slice(0,state.view==='overview'?12:100).map(([key,r])=>{
      const cands=(r.cands||[]).slice(0,3);
      return `<article class="election-race"><div class="election-race-head"><strong>${escapeHTML(key)}</strong><span>${fmt(r.total)} votes · ${r.pct_in==null?'Reporting unknown':escapeHTML(r.pct_in)+'% reported'}</span></div>
        ${cands.map(c=>`<div class="election-candidate"><span class="election-party ${c.p==='D'?'dem':c.p==='R'?'rep':''}">${escapeHTML(badge(c.p))}</span><span>${escapeHTML(c.n)}</span><strong>${fmt(c.v)}</strong><span>${c.pct==null?'—':Number(c.pct).toFixed(1)+'%'}</span></div>`).join('')}
        <small>Unofficial count · no race call · state feed</small></article>`;
    }).join('');
    drawMap();
    drawNews();
  }
  function drawMap() {
    if (!state.markers) return;
    state.markers.clearLayers();
    const races=getRaces();
    const grouped={};
    for(const [key,r] of races) { const code=byState(key); (grouped[code] ||= []).push(r); }
    for(const [code,coords] of Object.entries(LOCATIONS)){
      const entries=grouped[code]||[];
      const count=entries.length;
      const votes=entries.reduce((sum,r)=>sum+(Number(r.total)||0),0);
      const marker=L.circleMarker(coords,{radius: count?10:6,weight:2,color:count?'#f1c77e':'#8797ac',fillColor:count?'#c69c43':'#8797ac',fillOpacity:count?.92:.35});
      const popup=document.createElement('div');
      const strong=document.createElement('strong');strong.textContent=code;popup.append(strong);
      const info=document.createElement('p');info.textContent=count ? count+' listed contests · '+fmt(votes)+' votes reported' : 'No contests reported for this office yet';popup.append(info);
      const note=document.createElement('small');note.textContent='No results shown here constitute a race call.';popup.append(note);
      marker.bindPopup(popup).addTo(state.markers);
    }
  }
  function drawNews() {
    const node=root()?.querySelector('#electionNews');if (!node) return;
    if (!state.news.length) {
      node.innerHTML='<p class="election-empty">No election headlines found in the configured Intel Terminal feeds. Use the linked live news sources below; add election-focused RSS sources to your collector for in-panel headlines.</p>';
      return;
    }
    node.innerHTML=state.news.slice(0,state.view==='news'?24:9).map(item=>{
      const href=String(item.url||item.link||'#');
      const safe=/^https?:\/\//i.test(href)?href:'#';
      return `<article class="election-news-item"><small>${escapeHTML(item.source_name||item.source||item.category||'News feed')} · ${escapeHTML(item.published_at||item.published||item.created_at ? time(item.published_at||item.published||item.created_at) : 'Time unavailable')}</small>
      <a target="_blank" rel="noopener noreferrer" href="${escapeHTML(safe)}">${escapeHTML(item.title||'Open headline')}</a></article>`;
    }).join('');
  }
  async function fetchNews() {
    try {
      const response=await fetch('/api/articles?limit=250',{cache:'no-store'});
      if (!response.ok) throw Error('News collector '+response.status);
      const payload=await response.json();
      const items=Array.isArray(payload)?payload:Array.isArray(payload.articles)?payload.articles:[];
      state.news=items.filter(a=> /\b(elect(?:ion|oral)|midterm|ballot|vote|voting|polling place|senate race|house race|governor race|counting votes)\b/i.test([a.title,a.summary,a.category].join(' '))).sort((a,b)=>new Date(b.published_at||b.published||0)-new Date(a.published_at||a.published||0));
    } catch(err) {state.news=[];console.warn('Election news: collector unavailable',err);}
  }
  async function refresh(manual=false) {
    if(!current()) return;
    state.message='Checking public sources…'; update();
    const checks=await Promise.allSettled(OFFICES.map(async office=>{
      const response=await fetch(API+encodeURIComponent(office),{mode:'cors',cache:'no-cache'});
      if (!response.ok) throw Error(office+': HTTP '+response.status);
      const json=await response.json();
      if(json.api!==1 || json.year!==2026 || json.office.toLowerCase()!==office.toLowerCase() || typeof json.races!=='object') throw Error('Unexpected results schema for '+office);
      state.feeds[office]=json;
    }));
    await fetchNews();
    state.lastCheck=new Date();
    const failures=checks.filter(r=>r.status==='rejected');
    state.message=failures.length ? failures.length+' of 3 results feeds unavailable' : 'Feeds checked · '+state.lastCheck.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (failures.length) console.warn('Election data failures:',failures.map(r=>r.reason));
    update();
  }
  function open() {
    document.querySelectorAll('.page-btn').forEach(b=>b.classList.toggle('active',b.dataset.page==='elections'));
    document.body.dataset.intelPage='elections';
    shell();
    refresh();
    clearInterval(state.timer);
    state.timer=setInterval(()=>{if(current()) refresh();},INTERVAL);
  }
  function init() {
    const nav=document.getElementById('pageNav');
    if(!nav || !window.switchPage) return;
    if(!nav.querySelector('[data-page="elections"]')) {
      const button=document.createElement('button');
      button.className='page-btn';
      button.dataset.page='elections';
      button.innerHTML='<span class="page-icon" aria-hidden="true">★</span><span class="page-label">Election Watch</span>';
      button.addEventListener('click',()=>window.switchPage('elections'));
      const custom=nav.querySelector('[data-page="custom"]');
      nav.insertBefore(button,custom||null);
    }
    const original=window.switchPage;
    window.switchPage=function(page,...rest){
      if(page==='elections') {open();return Promise.resolve();}
      clearInterval(state.timer);state.timer=null;
      if(state.map){state.map.remove();state.map=null;state.markers=null;}
      return original.call(this,page,...rest);
    };
    if(new URLSearchParams(location.search).get('view')==='elections' || location.hash==='#elections') window.switchPage('elections');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();