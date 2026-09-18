// ============================================================
// 数据访问层：所有与 Supabase 的交互都集中在这里
// ============================================================

// ---------- 猫咪 ----------
async function listCats({ gender, status, q } = {}) {
  let qb = sb.from('cats').select('*').order('created_at', { ascending: false });
  if (gender && gender !== '全部') qb = qb.eq('gender', gender);
  if (status && status !== '全部') qb = qb.eq('status', status);
  if (q) qb = qb.ilike('name', `%${q}%`);
  const { data, error } = await qb;
  if (error) throw error;
  return data || [];
}

async function getCat(id) {
  const { data, error } = await sb.from('cats').select('*').eq('id', id).single();
  if (error) throw error;
  const [loc, relA, health, sight, camp] = await Promise.all([
    sb.from('cat_locations').select('*').eq('cat_id', id).order('created_at'),
    sb.from('cat_relationships').select('*').eq('cat_a', id).order('created_at'),
    sb.from('health_records').select('*').eq('cat_id', id).order('rec_date', { ascending: false }),
    sb.from('sightings').select('*').eq('cat_id', id).eq('status', '已发布').order('created_at', { ascending: false }),
    sb.from('campaigns').select('*').eq('cat_id', id).order('created_at', { ascending: false }),
  ]);
  const { data: relB } = await sb.from('cat_relationships').select('*').eq('cat_b', id);
  const rels = [...(relA.data || []), ...(relB || [])];
  const otherIds = [...new Set(rels.map(r => (r.cat_a === id ? r.cat_b : r.cat_a)))];
  let names = {};
  if (otherIds.length) {
    const { data: cats } = await sb.from('cats').select('id,name').in('id', otherIds);
    names = Object.fromEntries((cats || []).map(c => [c.id, c.name]));
  }
  return {
    cat: data,
    locations: loc.data || [],
    relationships: rels,
    relationshipNames: names,
    health: health.data || [],
    sightings: sight.data || [],
    campaigns: camp.data || [],
  };
}

async function createCat(p) {
  const { data, error } = await sb.from('cats').insert(p).select().single();
  if (error) throw error;
  return data;
}
async function updateCat(id, p) {
  const { data, error } = await sb.from('cats').update(p).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function deleteCat(id) {
  const { error } = await sb.from('cats').delete().eq('id', id);
  if (error) throw error;
}

// ---------- 地点 / 关系 / 健康 ----------
async function addLocation(p) { const { data, error } = await sb.from('cat_locations').insert(p).select().single(); if (error) throw error; return data; }
async function deleteLocation(id) { const { error } = await sb.from('cat_locations').delete().eq('id', id); if (error) throw error; }

async function addRelationship(p) { const { data, error } = await sb.from('cat_relationships').insert(p).select().single(); if (error) throw error; return data; }
async function deleteRelationship(id) { const { error } = await sb.from('cat_relationships').delete().eq('id', id); if (error) throw error; }

async function addHealth(p) { const { data, error } = await sb.from('health_records').insert(p).select().single(); if (error) throw error; return data; }
async function deleteHealth(id) { const { error } = await sb.from('health_records').delete().eq('id', id); if (error) throw error; }

// ---------- 目击 / 上传 ----------
async function uploadPhotos(files) {
  const urls = [];
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `public/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('catphotos').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from('catphotos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function createSighting(p) {
  const { data, error } = await sb.from('sightings').insert(p).select().single();
  if (error) throw error;
  return data;
}

async function listSightings(status) {
  let qb = sb.from('sightings').select('*, cats(name)').order('created_at', { ascending: false });
  if (status && status !== '全部') qb = qb.eq('status', status);
  const { data, error } = await qb;
  if (error) throw error;
  return data || [];
}
async function setSightingStatus(id, status) {
  const { error } = await sb.from('sightings').update({ status }).eq('id', id);
  if (error) throw error;
}
async function deleteSighting(id) {
  const { error } = await sb.from('sightings').delete().eq('id', id);
  if (error) throw error;
}

// ---------- 筹款 ----------
async function listCampaigns(status) {
  let qb = sb.from('campaigns').select('*, cats(name)').order('created_at', { ascending: false });
  if (status && status !== '全部') qb = qb.eq('status', status);
  const { data, error } = await qb;
  if (error) throw error;
  return data || [];
}

async function getCampaign(id) {
  const { data, error } = await sb.from('campaigns').select('*, cats(name)').eq('id', id).single();
  if (error) throw error;
  const { data: donations, error: e2 } = await sb.from('donations')
    .select('*').eq('campaign_id', id).order('created_at', { ascending: false });
  if (e2) throw e2;
  const raised = (donations || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  return { campaign: data, donations: donations || [], raised };
}

async function createCampaign(p) {
  const { data, error } = await sb.from('campaigns').insert(p).select().single();
  if (error) throw error;
  return data;
}
async function updateCampaign(id, p) {
  const { data, error } = await sb.from('campaigns').update(p).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function deleteCampaign(id) {
  const { error } = await sb.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}
async function addDonation(p) {
  const { data, error } = await sb.from('donations').insert(p).select().single();
  if (error) throw error;
  return data;
}

// ---------- 仪表盘统计 ----------
async function dashboardStats() {
  const out = {};
  const tables = ['cats', 'campaigns', 'sightings', 'donations'];
  for (const t of tables) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
    out[t] = count || 0;
  }
  const { count: pending } = await sb.from('sightings').select('*', { count: 'exact', head: true }).eq('status', '待审核');
  out.pendingSightings = pending || 0;
  const { count: neutered } = await sb.from('health_records').select('*', { count: 'exact', head: true }).eq('rec_type', '绝育');
  out.neutered = neutered || 0;
  return out;
}

// ---------- 领养申请 ----------
async function listAdoptionApplications(status) {
  let qb = sb.from('adoption_applications').select('*, cats(name)').order('created_at', { ascending: false });
  if (status && status !== '全部') qb = qb.eq('status', status);
  const { data, error } = await qb;
  if (error) throw error;
  return data || [];
}
async function createAdoptionApplication(p) {
  const { data, error } = await sb.from('adoption_applications').insert(p).select().single();
  if (error) throw error;
  return data;
}
async function setAdoptionStatus(id, status) {
  const { error } = await sb.from('adoption_applications').update({ status }).eq('id', id);
  if (error) throw error;
}
