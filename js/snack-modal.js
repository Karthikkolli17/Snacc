const _noImgColors = ['#1a2a4a','#3a1a1a','#1a3a1a','#2a1a3a','#3a2a1a','#1a3a3a'];
const _vibeLabels  = { eat: 'Would Eat Again', mid: 'Mid', never: 'Never Again' };

document.body.insertAdjacentHTML('beforeend', `
<div class="snack-backdrop" id="snack-backdrop">
  <div class="snack-modal" id="snack-modal">
    <button class="snack-close" id="snack-close">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="snack-top">
      <div class="snack-img-col">
        <div class="snack-img-col-bg" id="snack-img-bg"></div>
        <img id="snack-img" alt="" style="display:none"/>
      </div>
      <div class="snack-info-col">
        <p class="snack-info-brand" id="snack-info-brand"></p>
        <h2 class="snack-info-name" id="snack-info-name"></h2>
        <p class="snack-info-count" id="snack-info-count"></p>
        <div id="snack-bars"></div>
      </div>
    </div>
    <div class="snack-logs" id="snack-logs"></div>
  </div>
</div>
`);

const _backdrop = document.getElementById('snack-backdrop');
const _modal    = document.getElementById('snack-modal');

function _closeSnackModal() { _backdrop.classList.remove('open'); }
document.getElementById('snack-close').addEventListener('click', _closeSnackModal);
_backdrop.addEventListener('click', e => { if (e.target === _backdrop) _closeSnackModal(); });
document.getElementById('snack-close').addEventListener('mouseenter', () => document.body.classList.add('hovering'));
document.getElementById('snack-close').addEventListener('mouseleave', () => document.body.classList.remove('hovering'));

function _timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return Math.floor(diff/604800) + 'w ago';
}

async function openSnackModal(snack) {
  const imgBg  = document.getElementById('snack-img-bg');
  const img    = document.getElementById('snack-img');
  const barsEl = document.getElementById('snack-bars');
  const logsEl = document.getElementById('snack-logs');

  imgBg.style.backgroundColor = _noImgColors[(snack.name||'').charCodeAt(0) % _noImgColors.length];
  if (snack.image) { img.src = snack.image; img.style.display = 'block'; }
  else { img.style.display = 'none'; }

  document.getElementById('snack-info-brand').textContent = snack.brand || '';
  document.getElementById('snack-info-name').textContent  = snack.name;
  document.getElementById('snack-info-count').textContent = '';
  barsEl.innerHTML = '';
  logsEl.innerHTML = '';

  _backdrop.classList.add('open');
  _modal.scrollTop = 0;

  const { data } = await sb
    .from('ratings')
    .select('vibe, logged_at, users(username)')
    .eq('name', snack.name)
    .order('logged_at', { ascending: false });

  if (!data || !data.length) {
    document.getElementById('snack-info-count').textContent = 'No ratings yet';
    return;
  }

  const counts = { eat: 0, mid: 0, never: 0 };
  data.forEach(r => { if (r.vibe in counts) counts[r.vibe]++; });
  const total = data.length;
  document.getElementById('snack-info-count').textContent = total + (total === 1 ? ' person tried this' : ' people tried this');

  ['eat','mid','never'].forEach(vibe => {
    const count = counts[vibe];
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const row   = document.createElement('div');
    row.className = 'snack-bar-row';
    row.innerHTML = `
      <span class="snack-bar-label">${_vibeLabels[vibe]}</span>
      <span class="snack-bar-count">${count}</span>
      <div class="snack-bar-track"><div class="snack-bar-fill"></div></div>`;
    barsEl.appendChild(row);
    setTimeout(() => row.querySelector('.snack-bar-fill').style.width = pct + '%', 60);
  });

  logsEl.innerHTML = '<p class="snack-logs-label">Recent logs</p>';
  data.slice(0, 6).forEach(r => {
    const item = document.createElement('div');
    item.className = 'snack-log-item';
    item.innerHTML = `
      <span class="snack-log-user">${r.users?.username ? '@' + r.users.username : '—'}</span>
      <span class="snack-log-time">${_timeAgo(r.logged_at)}</span>`;
    logsEl.appendChild(item);
  });
}
