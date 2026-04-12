const _noImgColors = ['#1a2a4a','#3a1a1a','#1a3a1a','#2a1a3a','#3a2a1a','#1a3a3a'];
const _vibeLabels  = {
  snack: { eat: 'Would Eat Again', mid: 'Mid', never: 'Never Again' },
  drink: { eat: 'Would Drink Again', mid: 'Mid', never: 'Never Again' },
};

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
        <div class="snack-info-header">
          <p class="snack-info-brand" id="snack-info-brand"></p>
          <h2 class="snack-info-name" id="snack-info-name"></h2>
          <p class="snack-info-count" id="snack-info-count"></p>
        </div>
        <div class="snack-nutrition-inline" id="snack-nutrition"></div>
      </div>
    </div>
    <div class="snack-vibes" id="snack-bars"></div>
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

function _renderNutrition(product) {
  const el = document.getElementById('snack-nutrition');
  if (!el) return;
  const n = product.nutriments || {};
  const serving = product.serving_size || null;
  const hasPer = !!product.serving_quantity;
  const s = hasPer ? '_serving' : '_100g';
  const per = hasPer ? `per serving (${serving})` : 'per 100g';

  const cal     = Math.round(n[`energy-kcal${s}`]     ?? n['energy-kcal_100g']    ?? 0);
  const fat     = +(n[`fat${s}`]                       ?? n['fat_100g']            ?? 0).toFixed(1);
  const satFat  = +(n[`saturated-fat${s}`]             ?? n['saturated-fat_100g']  ?? 0).toFixed(1);
  const sodium  = Math.round((n[`sodium${s}`]          ?? n['sodium_100g']         ?? 0) * 1000);
  const carbs   = +(n[`carbohydrates${s}`]             ?? n['carbohydrates_100g']  ?? 0).toFixed(1);
  const fiber   = +(n[`fiber${s}`]                     ?? n['fiber_100g']          ?? 0).toFixed(1);
  const sugars  = +(n[`sugars${s}`]                    ?? n['sugars_100g']         ?? 0).toFixed(1);
  const protein = +(n[`proteins${s}`]                  ?? n['proteins_100g']       ?? 0).toFixed(1);

  el.innerHTML = `
    <p class="snack-nut-per">${per}</p>
    <div class="nutrition-label">
      <div class="nutrition-title">Nutrition<br>Facts</div>
      <div class="nutrition-bar thick"></div>
      <div class="nutrition-calories-row">
        <span class="nutrition-cal-label">Calories</span>
        <span class="nutrition-cal-val">${cal}</span>
      </div>
      <div class="nutrition-bar thick"></div>
      <div class="nutrition-row"><strong>Total Fat</strong> <span>${fat}g</span></div>
      <div class="nutrition-row indent">Saturated Fat <span>${satFat}g</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Sodium</strong> <span>${sodium}mg</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Total Carbohydrate</strong> <span>${carbs}g</span></div>
      <div class="nutrition-row indent">Dietary Fiber <span>${fiber}g</span></div>
      <div class="nutrition-row indent">Total Sugars <span>${sugars}g</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Protein</strong> <span>${protein}g</span></div>
    </div>`;
}

function _renderStoredNutrition(n, kind) {
  const el = document.getElementById('snack-nutrition');
  if (!el) return;
  const per = n.serving ? `per serving (${n.serving})` : 'per serving';
  const isDrink = kind === 'drink';
  el.innerHTML = `
    <p class="snack-nut-per">${per}</p>
    <div class="nutrition-label">
      <div class="nutrition-title">Nutrition<br>Facts</div>
      <div class="nutrition-bar thick"></div>
      <div class="nutrition-calories-row">
        <span class="nutrition-cal-label">Calories</span>
        <span class="nutrition-cal-val">${n.calories??'—'}</span>
      </div>
      <div class="nutrition-bar thick"></div>
      <div class="nutrition-row"><strong>Total Sugars</strong> <span>${n.sugars!=null?n.sugars+'g':'—'}</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Total Carbohydrate</strong> <span>${n.carbs!=null?n.carbs+'g':'—'}</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Sodium</strong> <span>${n.sodium!=null?n.sodium+'mg':'—'}</span></div>
      ${isDrink ? `
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Caffeine</strong> <span>${n.caffeine!=null?n.caffeine+'mg':'—'}</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Protein</strong> <span>${n.protein!=null?n.protein+'g':'—'}</span></div>
      ` : `
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Total Fat</strong> <span>${n.fat!=null?n.fat+'g':'—'}</span></div>
      <div class="nutrition-row indent">Saturated Fat <span>${n.satFat!=null?n.satFat+'g':'—'}</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row indent">Dietary Fiber <span>${n.fiber!=null?n.fiber+'g':'—'}</span></div>
      <div class="nutrition-bar"></div>
      <div class="nutrition-row"><strong>Protein</strong> <span>${n.protein!=null?n.protein+'g':'—'}</span></div>
      `}
    </div>`;
}

async function _fetchNutrition(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status === 1 && data.product?.nutriments) {
      _renderNutrition(data.product);
    }
  } catch {}
}

async function openSnackModal(snack) {
  const kind = snack.kind === 'drink' ? 'drink' : 'snack';
  const imgBg  = document.getElementById('snack-img-bg');
  const img    = document.getElementById('snack-img');
  const barsEl = document.getElementById('snack-bars');
  const logsEl = document.getElementById('snack-logs');
  const nutEl  = document.getElementById('snack-nutrition');

  imgBg.style.backgroundColor = _noImgColors[(snack.name||'').charCodeAt(0) % _noImgColors.length];
  if (snack.image) { img.src = snack.image; img.style.display = 'block'; }
  else { img.style.display = 'none'; }

  document.getElementById('snack-info-brand').textContent = snack.brand || '';
  document.getElementById('snack-info-name').textContent  = snack.name;
  document.getElementById('snack-info-count').textContent = '';
  barsEl.innerHTML = '';
  logsEl.innerHTML = '';
  nutEl.innerHTML  = '';
  document.querySelector('.snack-info-col')?.classList.remove('has-nutrition');

  _backdrop.classList.add('open');
  _modal.scrollTop = 0;

  let query = sb
    .from('ratings')
    .select('vibe, logged_at, barcode, nutrition, kind, country, users(username)')
    .eq('name', snack.name)
    .order('logged_at', { ascending: false });

  query = kind === 'snack' ? query.or('kind.eq.snack,kind.is.null') : query.eq('kind', kind);
  const { data } = await query;

  if (!data || !data.length) {
    document.getElementById('snack-info-count').textContent = kind === 'drink' ? 'No drink ratings yet' : 'No ratings yet';
    return;
  }

  const counts = { eat: 0, mid: 0, never: 0 };
  const countryCounts = {};
  data.forEach(r => {
    if (r.vibe in counts) counts[r.vibe]++;
    if (r.country) countryCounts[r.country] = (countryCounts[r.country]||0) + 1;
  });
  const total = data.length;
  const topCountry = Object.keys(countryCounts).sort((a,b) => countryCounts[b]-countryCounts[a])[0] || null;
  const countText = total + (total === 1 ? ' person logged this' : ' people logged this');
  document.getElementById('snack-info-count').textContent = topCountry
    ? countText + ' / ' + countryFlag(topCountry) + ' ' + countryName(topCountry)
    : countText;

  ['eat','mid','never'].forEach(vibe => {
    const count = counts[vibe];
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const row   = document.createElement('div');
    row.className = 'snack-bar-row';
    row.innerHTML = `
      <span class="snack-bar-label">${_vibeLabels[kind][vibe]}</span>
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
      <span class="snack-log-user">${r.users?.username ? '@' + r.users.username : '—'}${r.country ? ' / '+countryFlag(r.country) : ''}</span>
      <span class="snack-log-time">${_timeAgo(r.logged_at)}</span>`;
    logsEl.appendChild(item);
  });

  const barcode = data.find(r => r.barcode && /^\d+$/.test(r.barcode))?.barcode;
  const storedNutrition = data.find(r => r.nutrition)?.nutrition;

  if (barcode) {
    _fetchNutrition(barcode);
    document.querySelector('.snack-info-col')?.classList.add('has-nutrition');
  } else if (storedNutrition) {
    _renderStoredNutrition(storedNutrition, kind);
    document.querySelector('.snack-info-col')?.classList.add('has-nutrition');
  }
}
