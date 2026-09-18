// 初始化 Supabase 客户端（supabase-js 通过 CDN 以全局变量 supabase 提供）
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
