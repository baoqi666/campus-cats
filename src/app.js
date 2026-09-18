// ============================================================
// 校园小猫图鉴 - 前端主程序（原生 JS，零依赖）
// ============================================================

const state = {
  adminTab: 'stats',
  editingCat: null,     // 管理端正在编辑的猫（null=新建）
  uploadCatId: null,    // 上传页预选的猫
  campaignFilter: '全部',
};

// ---------- 小工具 ----------
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) { return d ? String(d).slice(0, 10) : ''; }
function $(sel) { return document.querySelector(sel); }
function setApp(html) { $('#app').innerHTML = html; }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2600);
}
function openModal(html) {
  $('#modal-card').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; $('#modal-card').innerHTML = ''; }

// ---------- 路由 ----------
function router() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/cat/')) return renderCatDetail(hash.slice(6));
  if (hash === '#/upload') return renderUpload();
  if (hash === '#/campaigns') return renderCampaigns();
  if (hash.startsWith('#/campaign/')) return renderCampaignDetail(hash.slice(10));
  if (hash === '#/adopt') return renderAdopt();
  if (hash === '#/admin') return renderAdmin();
  return renderHome();
}
function updateNav() {
  const hash = location.hash || '#/';
  document.querySelectorAll('.nav a').forEach(a => {
    const h = a.getAttribute('href');
    a.classList.toggle('active', h === '#/' ? hash === '#/' : hash.startsWith(h));
  });
  $('.brand').textContent = SITE_NAME;
}

// ---------- 首页：猫列表 ----------
async function renderHome() {
  setApp('<div class="loading">加载中…</div>');
  let cats = [];
  try { cats = await listCats(); } catch (e) { setApp('<div class="card center muted">加载失败：' + esc(e.message) + '</div>'); return; }
  const filters = `
    <div class="card">
      <div class="row">
        <select id="f-gender" class="field" style="margin:0">
          <option>全部</option><option>公</option><option>母</option><option>未知</option>
        </select>
        <select id="f-status" class="field" style="margin:0">
          <option>全部</option><option>在校</option><option>已领养</option><option>失踪</option><option>去世</option>
        </select>
        <input id="f-q" placeholder="搜索昵称…" class="field" style="margin:0" />
      </div>
    </div>`;
  const cards = cats.length ? cats.map(catCardHTML).join('') : '<div class="card center muted">还没有猫咪档案，去管理端录入第一只吧。</div>';
  setApp(filters + '<div class="grid">' + cards + '</div>');

  const reload = async () => {
    const gender = $('#f-gender').value, status = $('#f-status').value, q = $('#f-q').value.trim();
    let list = [];
    try { list = await listCats({ gender, status, q }); } catch (e) { toast('筛选失败'); return; }
    const grid = $('#app').querySelector('.grid');
    grid.innerHTML = list.length ? list.map(catCardHTML).join('') : '<div class="card center muted">没有匹配的猫咪。</div>';
  };
  $('#f-gender').onchange = reload;
  $('#f-status').onchange = reload;
  $('#f-q').oninput = debounce(reload, 250);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function catCardHTML(c) {
  const initial = esc((c.name || '?').slice(0, 1));
  const cover = c.cover_url
    ? `<img class="cat-cover" src="${esc(c.cover_url)}" alt="${esc(c.name)}" loading="lazy" />`
    : `<div class="cat-cover placeholder">${initial}</div>`;
  const statusTag = c.status === '已领养' ? 'adopt' : c.status === '去世' ? 'gone' : c.status === '失踪' ? 'miss' : '';
  return `<div class="card cat-card" onclick="location.hash='#/cat/${c.id}'">
    ${cover}
    <h3>${esc(c.name)}</h3>
    <div class="cat-meta">${esc(c.gender || '')} · ${esc(c.breed || '未知品种')} <span class="tag ${statusTag}">${esc(c.status)}</span></div>
  </div>`;
}

// ---------- 猫详情 ----------
async function renderCatDetail(id) {
  setApp('<div class="loading">加载中…</div>');
  let d;
  try { d = await getCat(id); } catch (e) { setApp('<div class="card center muted">加载失败：' + esc(e.message) + '</div>'); return; }
  const c = d.cat;
  const initial = esc((c.name || '?').slice(0, 1));
  const cover = c.cover_url ? `<img class="cat-cover" style="aspect-ratio:16/9" src="${esc(c.cover_url)}" alt="${esc(c.name)}" />` : `<div class="cat-cover placeholder" style="aspect-ratio:16/9">${initial}</div>`;

  const locHTML = d.locations.length
    ? d.locations.map(l => `<div class="tl-item"><b>${esc(l.area_name)}</b> ${l.frequency ? `<span class="tag">${esc(l.frequency)}</span>` : ''}<div class="muted">${esc(l.note || '')}</div></div>`).join('')
    : '<div class="muted">暂无记录</div>';

  const relHTML = d.relationships.length
    ? d.relationships.map(r => {
        const otherId = r.cat_a === id ? r.cat_b : r.cat_a;
        const name = d.relationshipNames[otherId] || '某猫';
        return `<div class="tl-item"><span class="tag">${esc(r.rel_type)}</span> <a href="#/cat/${otherId}">${esc(name)}</a><div class="muted">${esc(r.note || '')}</div></div>`;
      }).join('')
    : '<div class="muted">暂无记录</div>';

  const types = ['绝育', '疫苗', '驱虫', '病史'];
  const healthHTML = types.map(t => {
    const items = d.health.filter(h => h.rec_type === t);
    if (!items.length) return '';
    return `<h4 style="margin:14px 0 6px">${t}</h4><div class="timeline">` +
      items.map(h => `<div class="tl-item"><div class="tl-date">${fmtDate(h.rec_date) || '日期未知'}</div><div>${esc(h.detail || '')}</div>${h.vet ? `<div class="muted">机构：${esc(h.vet)}</div>` : ''}</div>`).join('') +
      `</div>`;
  }).join('') || '<div class="muted">暂无记录</div>';

  const photoWall = d.sightings.flatMap(s => (s.photo_urls || []))
    .map(u => `<img src="${esc(u)}" alt="猫咪照片" loading="lazy" />`).join('');
  const photosHTML = photoWall ? `<div class="photos" style="margin-top:8px">${photoWall}</div>` : '<div class="muted">还没有公开照片</div>';

  const campHTML = d.campaigns.length
    ? d.campaigns.map(cp => `<a class="card" href="#/campaign/${cp.id}" style="display:block"><b>${esc(cp.title)}</b><div class="muted">${esc(cp.status)}</div></a>`).join('')
    : '<div class="muted">暂无筹款</div>';

  setApp(`
    <div class="card">${cover}
      <h2 style="margin:12px 0 4px">${esc(c.name)}</h2>
      <div class="muted">${esc(c.gender || '性别未知')} · ${esc(c.breed || '品种未知')} · 状态 <span class="tag">${esc(c.status)}</span></div>
      ${c.personality ? `<p>${esc(c.personality)}</p>` : ''}
      <button class="btn primary block" onclick="state.uploadCatId='${c.id}';location.hash='#/upload'">上传这只猫的照片</button>
      ${c.status === '在校' ? `<button class="btn block" onclick="openAdoptionModal('${c.id}')">申请领养这只猫</button>` : ''}
    </div>

    <div class="card"><h3>常出没地点</h3>${locHTML}</div>
    <div class="card"><h3>健康记录</h3>${healthHTML}</div>
    <div class="card"><h3>猫际关系</h3>${relHTML}</div>
    <div class="card"><h3>照片墙</h3>${photosHTML}</div>
    <div class="card"><h3>关联筹款</h3>${campHTML}</div>
    <button class="btn ghost block" onclick="location.hash='#/'">返回列表</button>
  `);
}

// ---------- 上传 ----------
async function renderUpload() {
  let cats = [];
  try { cats = await listCats(); } catch (e) {}
  const opts = ['<option value="">新猫（待管理员建档）</option>']
    .concat(cats.map(c => `<option value="${c.id}" ${state.uploadCatId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`)).join('');
  setApp(`
    <div class="card">
      <h2>上传校园小猫</h2>
      <p class="sub">拍到校园里的小猫？上传照片，管理员确认后会展示在对应猫咪档案里。</p>
      <div class="field"><label>关联猫咪</label><select id="u-cat">${opts}</select></div>
      <div class="field"><label>照片（可多张）</label><input id="u-photos" type="file" accept="image/*" multiple /></div>
      <div class="field"><label>发现地点</label><input id="u-loc" placeholder="例如：一食堂门口" /></div>
      <div class="field"><label>备注</label><textarea id="u-note" placeholder="外貌、状态、是否亲人…"></textarea></div>
      <div class="field"><label>你的称呼（选填）</label><input id="u-name" placeholder="匿名小猫观察员" /></div>
      <button class="btn primary block" id="u-submit">提交</button>
    </div>
  `);
  $('#u-submit').onclick = async () => {
    const files = $('#u-photos').files;
    if (!files.length) { toast('请先选择至少一张照片'); return; }
    const btn = $('#u-submit'); btn.disabled = true; btn.textContent = '上传中…';
    try {
      const urls = await uploadPhotos(files);
      await createSighting({
        cat_id: $('#u-cat').value || null,
        photo_urls: urls,
        location_note: $('#u-loc').value.trim(),
        note: $('#u-note').value.trim(),
        reporter_name: $('#u-name').value.trim() || '匿名',
      });
      toast('已提交，等待管理员审核');
      state.uploadCatId = null;
      location.hash = '#/';
    } catch (e) { toast('提交失败：' + e.message); btn.disabled = false; btn.textContent = '提交'; }
  };
}

// ---------- 筹款列表 ----------
async function renderCampaigns() {
  setApp('<div class="loading">加载中…</div>');
  let list = [];
  try { list = await listCampaigns(); } catch (e) { setApp('<div class="card center muted">加载失败：' + esc(e.message) + '</div>'); return; }
  const cards = list.length ? list.map(campaignCardHTML).join('') : '<div class="card center muted">暂无筹款项目。</div>';
  setApp('<h2 style="margin:4px 0 14px">为患病小猫筹款</h2><div class="grid">' + cards + '</div>');
}
function campaignCardHTML(cp) {
  const goal = Number(cp.goal_amount) || 0;
  return `<div class="card cat-card" onclick="location.hash='#/campaign/${cp.id}'">
    ${cp.cover_url ? `<img class="cat-cover" src="${esc(cp.cover_url)}" alt="${esc(cp.title)}" loading="lazy"/>` : `<div class="cat-cover placeholder">筹</div>`}
    <h3>${esc(cp.title)}</h3>
    <div class="cat-meta">${esc(cp.cats?.name || '通用救助')} · <span class="tag">${esc(cp.status)}</span></div>
    <div class="progress" style="margin-top:8px"><span style="width:${goal ? '40' : '0'}%"></span></div>
    <div class="muted" style="font-size:12px;margin-top:4px">目标 ¥${goal}</div>
  </div>`;
}

// ---------- 筹款详情 ----------
async function renderCampaignDetail(id) {
  setApp('<div class="loading">加载中…</div>');
  let d;
  try { d = await getCampaign(id); } catch (e) { setApp('<div class="card center muted">加载失败：' + esc(e.message) + '</div>'); return; }
  const cp = d.campaign;
  const goal = Number(cp.goal_amount) || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((d.raised / goal) * 100)) : 0;
  const donHTML = d.donations.length
    ? d.donations.map(x => `<div class="tl-item"><b>${x.anonymous ? '匿名' : esc(x.donor_name || '好心人')}</b> 捐助 ¥${Number(x.amount)}
        ${x.message ? `<div class="muted">${esc(x.message)}</div>` : ''}<div class="tl-date">${fmtDate(x.created_at)}</div></div>`).join('')
    : '<div class="muted">还没有人捐款，成为第一个吧。</div>';
  const qr = DONATION_QR_URL ? `<img class="qr" src="${esc(DONATION_QR_URL)}" alt="收款码" />` : '';
  setApp(`
    <div class="card">
      ${cp.cover_url ? `<img class="cat-cover" style="aspect-ratio:16/9" src="${esc(cp.cover_url)}" alt="${esc(cp.title)}"/>` : ''}
      <h2 style="margin:12px 0 4px">${esc(cp.title)}</h2>
      <div class="muted">${esc(cp.cats?.name || '通用救助')} · ${esc(cp.status)}</div>
      <p>${esc(cp.reason || '')}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="progress-meta"><span>已筹 ¥${d.raised}</span><span>目标 ¥${goal}（${pct}%）</span></div>
      ${cp.deadline ? `<div class="muted" style="margin-top:6px">截止：${fmtDate(cp.deadline)}</div>` : ''}
    </div>
    <div class="card">
      <h3>如何捐款</h3>
      ${qr}
      <p class="muted">${esc(DONATION_NOTE)}</p>
      <p class="muted">付款后进度由管理员在确认到账后更新，本页不直接收付款。</p>
    </div>
    <div class="card"><h3>捐款记录</h3><div class="timeline">${donHTML}</div></div>
    <button class="btn ghost block" onclick="location.hash='#/campaigns'">返回筹款列表</button>
  `);
}

// ============================================================
// 领养申请（用户端）
// ============================================================
async function renderAdopt() {
  setApp('<div class="loading">加载中…</div>');
  let cats = [];
  try { cats = await listCats({ status: '在校' }); } catch (e) { setApp('<div class="card center muted">加载失败：' + esc(e.message) + '</div>'); return; }
  const cards = cats.length ? cats.map(c => `
    <div class="card cat-card">
      ${c.cover_url ? `<img class="cat-cover" src="${esc(c.cover_url)}" alt="${esc(c.name)}" loading="lazy"/>` : `<div class="cat-cover placeholder">${esc((c.name || '?').slice(0, 1))}</div>`}
      <h3>${esc(c.name)}</h3>
      <div class="cat-meta">${esc(c.gender || '')} · ${esc(c.breed || '未知品种')}</div>
      <button class="btn primary block" onclick="openAdoptionModal('${c.id}')">申请领养</button>
    </div>`).join('') : '<div class="card center muted">暂时没有可领养的猫咪。</div>';
  setApp('<div class="hero"><h2>带它回家</h2><p class="sub">以下猫咪正在寻找温暖的家，戳「申请领养」填写意向，管理员会与你联系。</p></div><div class="grid">' + cards + '</div>');
}

function openAdoptionModal(catId) {
  openModal(`
    <h2>领养申请</h2>
    <p class="sub">提交后管理员会审核并与你联系，请留下有效联系方式。</p>
    <div class="field"><label>你的称呼</label><input id="a-name" placeholder="例如：小李" /></div>
    <div class="field"><label>联系方式（手机 / 微信）</label><input id="a-contact" placeholder="方便管理员联系你" /></div>
    <div class="field"><label>领养意向</label><textarea id="a-reason" placeholder="为什么想领养它、家里环境如何…"></textarea></div>
    <div class="field"><label>养猫经验</label><textarea id="a-exp" placeholder="是否养过猫、能否负责医疗与绝育…"></textarea></div>
    <button class="btn primary block" id="a-submit">提交申请</button>
  `);
  $('#a-submit').onclick = async () => {
    const name = $('#a-name').value.trim(), contact = $('#a-contact').value.trim();
    if (!name || !contact) { toast('请填写称呼和联系方式'); return; }
    const btn = $('#a-submit'); btn.disabled = true;
    try {
      await createAdoptionApplication({
        cat_id: catId || null, applicant_name: name, contact,
        reason: $('#a-reason').value.trim() || null, experience: $('#a-exp').value.trim() || null,
      });
      toast('申请已提交，等待审核'); closeModal();
    } catch (e) { toast('提交失败：' + e.message); btn.disabled = false; }
  };
}

// ============================================================
// 管理端
// ============================================================
async function renderAdmin() {
  if (!isLoggedIn()) return renderLogin();
  const tabs = [
    ['stats', '统计'], ['cats', '猫咪'], ['sightings', '目击审核'], ['campaigns', '筹款'], ['adopt', '领养审核'],
  ];
  const seg = tabs.map(([k, v]) => `<button data-action="admin-tab" data-tab="${k}" class="${state.adminTab === k ? 'active' : ''}">${v}</button>`).join('');
  setApp(`
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <b>管理后台</b>
        <button class="btn sm danger" data-action="admin-logout">退出登录</button>
      </div>
      <div class="seg" style="margin-top:12px">${seg}</div>
      <div id="admin-body"><div class="loading">加载中…</div></div>
    </div>
  `);
  await renderAdminTab();
}
function renderLogin() {
  setApp(`
    <div class="card" style="max-width:420px;margin:40px auto">
      <h2>管理员登录</h2>
      <p class="sub">使用在 Supabase <code>admins</code> 表中登记的邮箱登录。</p>
      <div class="field"><label>邮箱</label><input id="l-email" type="email" placeholder="admin@example.com" /></div>
      <div class="field"><label>密码</label><input id="l-pass" type="password" placeholder="Supabase 账号密码" /></div>
      <button class="btn primary block" id="l-submit">登录</button>
      <p class="muted" style="margin-top:10px">还没有账号？在 Supabase Auth 里新建用户，并把邮箱加入 <code>admins</code> 表。</p>
    </div>
  `);
  $('#l-submit').onclick = async () => {
    const btn = $('#l-submit'); btn.disabled = true;
    try { await adminLogin($('#l-email').value.trim(), $('#l-pass').value); toast('登录成功'); renderAdmin(); }
    catch (e) { toast(e.message); btn.disabled = false; }
  };
}

async function renderAdminTab() {
  const body = $('#admin-body'); if (!body) return;
  if (state.adminTab === 'stats') {
    let s = {}; try { s = await dashboardStats(); } catch (e) { body.innerHTML = '<div class="muted">统计加载失败</div>'; return; }
    body.innerHTML = `
      <div class="grid">
        <div class="card"><h3>${s.cats || 0}</h3><div class="muted">猫咪档案</div></div>
        <div class="card"><h3>${s.neutered || 0}</h3><div class="muted">绝育记录</div></div>
        <div class="card"><h3>${s.campaigns || 0}</h3><div class="muted">筹款项目</div></div>
        <div class="card"><h3>${s.donations || 0}</h3><div class="muted">捐款笔数</div></div>
        <div class="card"><h3>${s.sightings || 0}</h3><div class="muted">目击上传</div></div>
        <div class="card"><h3>${s.pendingSightings || 0}</h3><div class="muted">待审核目击</div></div>
      </div>`;
  } else if (state.adminTab === 'cats') {
    let cats = []; try { cats = await listCats(); } catch (e) { body.innerHTML = '<div class="muted">加载失败</div>'; return; }
    const rows = cats.map(c => `<div class="tl-item"><b>${esc(c.name)}</b> <span class="tag">${esc(c.status)}</span>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" data-action="edit-cat" data-id="${c.id}">编辑</button>
        <button class="btn sm danger" data-action="delete-cat" data-id="${c.id}">删除</button>
      </div></div>`).join('');
    body.innerHTML = `<button class="btn primary block" data-action="new-cat" style="margin-bottom:12px">+ 新建猫咪</button><div class="timeline">${rows || '<div class="muted">暂无</div>'}</div>`;
  } else if (state.adminTab === 'sightings') {
    let list = []; try { list = await listSightings('待审核'); } catch (e) { body.innerHTML = '<div class="muted">加载失败</div>'; return; }
    if (!list.length) { body.innerHTML = '<div class="muted">没有待审核的目击。</div>'; return; }
    body.innerHTML = list.map(s => `
      <div class="card">
        <div class="muted">上报人：${esc(s.reporter_name || '匿名')} · ${fmtDate(s.created_at)}</div>
        <div class="photos" style="margin:8px 0">${(s.photo_urls || []).map(u => `<img src="${esc(u)}" alt="照片"/>`).join('') || '<span class="muted">无照片</span>'}</div>
        <div class="muted">${esc(s.location_note || '')} ${esc(s.note || '')}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm primary" data-action="approve-sight" data-id="${s.id}">通过并发布</button>
          <button class="btn sm" data-action="sight-to-cat" data-id="${s.id}">转为新猫</button>
          <button class="btn sm danger" data-action="reject-sight" data-id="${s.id}">拒绝</button>
        </div>
      </div>`).join('');
  } else if (state.adminTab === 'campaigns') {
    let list = []; try { list = await listCampaigns(); } catch (e) { body.innerHTML = '<div class="muted">加载失败</div>'; return; }
    const rows = list.map(c => `<div class="tl-item"><b>${esc(c.title)}</b> <span class="tag">${esc(c.status)}</span>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" data-action="edit-camp" data-id="${c.id}">编辑</button>
        <button class="btn sm" data-action="add-donation" data-id="${c.id}">记录捐款</button>
        <button class="btn sm danger" data-action="delete-camp" data-id="${c.id}">删除</button>
      </div></div>`).join('');
    body.innerHTML = `<button class="btn primary block" data-action="new-camp" style="margin-bottom:12px">+ 新建筹款</button><div class="timeline">${rows || '<div class="muted">暂无</div>'}</div>`;
  } else if (state.adminTab === 'adopt') {
    let list = []; try { list = await listAdoptionApplications(); } catch (e) { body.innerHTML = '<div class="muted">加载失败</div>'; return; }
    if (!list.length) { body.innerHTML = '<div class="muted">还没有领养申请。</div>'; return; }
    body.innerHTML = list.map(a => `
      <div class="card">
        <div class="muted">猫咪：${esc(a.cats?.name || '通用')} · ${fmtDate(a.created_at)} · <span class="tag">${esc(a.status)}</span></div>
        <div style="margin:6px 0"><b>${esc(a.applicant_name)}</b> · 联系：${esc(a.contact)}</div>
        <div class="muted">意向：${esc(a.reason || '')}</div>
        <div class="muted">养猫经验：${esc(a.experience || '未填')}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm primary" data-action="approve-adopt" data-id="${a.id}">通过</button>
          <button class="btn sm" data-action="adopt-done" data-id="${a.id}" data-cat="${a.cat_id || ''}">标记已领养</button>
          <button class="btn sm danger" data-action="reject-adopt" data-id="${a.id}">拒绝</button>
        </div>
      </div>`).join('');
  }
}

// ---------- 猫编辑模态 ----------
async function openCatModal(id) {
  let cat = { name: '', gender: '未知', breed: '', status: '在校', birth_est: '', personality: '', cover_url: '' };
  if (id) { try { cat = await getCat(id).then(d => d.cat); } catch (e) { toast('读取失败'); return; } }
  state.editingCat = id ? cat : null;
  openModal(`
    <h2>${id ? '编辑猫咪' : '新建猫咪'}</h2>
    <div class="field"><label>昵称</label><input id="c-name" value="${esc(cat.name)}" /></div>
    <div class="row">
      <div class="field" style="flex:1"><label>性别</label><select id="c-gender">${['公','母','未知'].map(g => `<option ${cat.gender===g?'selected':''}>${g}</option>`).join('')}</select></div>
      <div class="field" style="flex:1"><label>状态</label><select id="c-status">${['在校','已领养','失踪','去世'].map(g => `<option ${cat.status===g?'selected':''}>${g}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>品种</label><input id="c-breed" value="${esc(cat.breed || '')}" /></div>
    <div class="field"><label>估计出生日期</label><input id="c-birth" type="date" value="${esc(cat.birth_est || '')}" /></div>
    <div class="field"><label>性格描述</label><textarea id="c-person">${esc(cat.personality || '')}</textarea></div>
    <div class="field"><label>封面图（选填，留空用首字母占位）</label><input id="c-cover" type="file" accept="image/*" /></div>
    <button class="btn primary block" id="c-save">保存</button>
  `);
  $('#c-save').onclick = async () => {
    const btn = $('#c-save'); btn.disabled = true;
    const payload = {
      name: $('#c-name').value.trim(), gender: $('#c-gender').value, status: $('#c-status').value,
      breed: $('#c-breed').value.trim() || null, birth_est: $('#c-birth').value || null, personality: $('#c-person').value.trim() || null,
    };
    if (!payload.name) { toast('请填写昵称'); btn.disabled = false; return; }
    try {
      const file = $('#c-cover').files[0];
      if (file) payload.cover_url = (await uploadPhotos([file]))[0];
      if (state.editingCat) await updateCat(state.editingCat.id, payload);
      else await createCat(payload);
      toast('已保存'); closeModal(); renderAdminTab();
    } catch (e) { toast('保存失败：' + e.message); btn.disabled = false; }
  };
}

// ---------- 筹款编辑模态 ----------
async function openCampaignModal(id) {
  let cats = []; try { cats = await listCats(); } catch (e) {}
  let cp = { title: '', reason: '', goal_amount: '', deadline: '', status: '进行中', cover_url: '', cat_id: '' };
  if (id) { try { cp = await getCampaign(id).then(d => d.campaign); } catch (e) { toast('读取失败'); return; } }
  openModal(`
    <h2>${id ? '编辑筹款' : '新建筹款'}</h2>
    <div class="field"><label>标题</label><input id="p-title" value="${esc(cp.title)}" /></div>
    <div class="field"><label>关联猫咪（选填）</label><select id="p-cat"><option value="">通用救助</option>${cats.map(c => `<option value="${c.id}" ${cp.cat_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label>事由</label><textarea id="p-reason">${esc(cp.reason || '')}</textarea></div>
    <div class="row">
      <div class="field" style="flex:1"><label>目标金额(¥)</label><input id="p-goal" type="number" min="0" value="${esc(cp.goal_amount || '')}" /></div>
      <div class="field" style="flex:1"><label>截止日期</label><input id="p-deadline" type="date" value="${esc(cp.deadline || '')}" /></div>
    </div>
    <div class="field"><label>状态</label><select id="p-status">${['进行中','已暂停','已结束'].map(s => `<option ${cp.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="field"><label>封面图（选填）</label><input id="p-cover" type="file" accept="image/*" /></div>
    <button class="btn primary block" id="p-save">保存</button>
  `);
  $('#p-save').onclick = async () => {
    const btn = $('#p-save'); btn.disabled = true;
    const payload = {
      title: $('#p-title').value.trim(), reason: $('#p-reason').value.trim() || null,
      goal_amount: Number($('#p-goal').value) || 0, deadline: $('#p-deadline').value || null,
      status: $('#p-status').value, cat_id: $('#p-cat').value || null,
    };
    if (!payload.title) { toast('请填写标题'); btn.disabled = false; return; }
    try {
      const file = $('#p-cover').files[0];
      if (file) payload.cover_url = (await uploadPhotos([file]))[0];
      if (id) await updateCampaign(id, payload); else await createCampaign(payload);
      toast('已保存'); closeModal(); renderAdminTab();
    } catch (e) { toast('保存失败：' + e.message); btn.disabled = false; }
  };
}

function openDonationModal(campaignId) {
  openModal(`
    <h2>记录一笔捐款</h2>
    <p class="sub">确认到账后在此登记，进度会自动更新。</p>
    <div class="field"><label>金额(¥)</label><input id="d-amt" type="number" min="0" /></div>
    <div class="field"><label>捐款人</label><input id="d-name" placeholder="好心人 / 匿名" /></div>
    <div class="field"><label>留言</label><textarea id="d-msg"></textarea></div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input id="d-anon" type="checkbox" style="width:auto" /> 匿名</label>
    <button class="btn primary block" id="d-save">保存</button>
  `);
  $('#d-save').onclick = async () => {
    try {
      await addDonation({
        campaign_id: campaignId, amount: Number($('#d-amt').value) || 0,
        donor_name: $('#d-name').value.trim() || '好心人', message: $('#d-msg').value.trim() || null,
        anonymous: $('#d-anon').checked,
      });
      toast('已记录'); closeModal(); renderAdminTab();
    } catch (e) { toast('失败：' + e.message); }
  };
}

// ---------- 全局点击委托 ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'close-modal') return closeModal();
  if (a === 'admin-tab') { state.adminTab = el.dataset.tab; renderAdmin(); return; }
  if (a === 'admin-logout') { await adminLogout(); toast('已退出'); renderAdmin(); return; }
  if (a === 'new-cat') return openCatModal(null);
  if (a === 'edit-cat') return openCatModal(id);
  if (a === 'delete-cat') {
    if (confirm('确认删除这只猫？相关地点/关系/健康记录会一并删除。')) {
      try { await deleteCat(id); toast('已删除'); renderAdminTab(); } catch (e) { toast('失败：' + e.message); }
    }
    return;
  }
  if (a === 'new-camp') return openCampaignModal(null);
  if (a === 'edit-camp') return openCampaignModal(id);
  if (a === 'delete-camp') {
    if (confirm('确认删除该筹款项目？')) { try { await deleteCampaign(id); toast('已删除'); renderAdminTab(); } catch (e) { toast('失败：' + e.message); } }
    return;
  }
  if (a === 'add-donation') return openDonationModal(id);
  if (a === 'approve-sight') { try { await setSightingStatus(id, '已发布'); toast('已发布'); renderAdminTab(); } catch (e) { toast(e.message); } return; }
  if (a === 'reject-sight') { try { await setSightingStatus(id, '已拒绝'); toast('已拒绝'); renderAdminTab(); } catch (e) { toast(e.message); } return; }
  if (a === 'sight-to-cat') {
    try {
      const s = await listSightings('待审核');
      const cur = s.find(x => x.id === id);
      const cat = await createCat({ name: (cur && cur.note ? cur.note.slice(0, 8) : '') || '待命名小猫', status: '在校' });
      await sb.from('sightings').update({ cat_id: cat.id, status: '已发布' }).eq('id', id);
      toast('已转为新猫并发布'); renderAdminTab();
    } catch (e) { toast('失败：' + e.message); }
    return;
  }
  if (a === 'approve-adopt') { try { await setAdoptionStatus(id, '通过'); toast('已通过'); renderAdminTab(); } catch (e) { toast(e.message); } return; }
  if (a === 'reject-adopt') { try { await setAdoptionStatus(id, '拒绝'); toast('已拒绝'); renderAdminTab(); } catch (e) { toast(e.message); } return; }
  if (a === 'adopt-done') {
    try {
      await setAdoptionStatus(id, '已领养');
      if (el.dataset.cat) await updateCat(el.dataset.cat, { status: '已领养' });
      toast('已标记领养，猫咪状态已更新'); renderAdminTab();
    } catch (e) { toast(e.message); }
    return;
  }
});

// ---------- 启动 ----------
window.addEventListener('hashchange', () => { router(); updateNav(); });
window.addEventListener('DOMContentLoaded', () => {
  initAuth(() => {});
  router();
  updateNav();
});
