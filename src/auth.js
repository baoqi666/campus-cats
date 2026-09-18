// ============================================================
// 登录 / 管理员状态
// ============================================================

let currentAdmin = null; // { email }

async function checkIsAdmin() {
  const { data } = await sb.rpc('is_admin');
  return !!data;
}

async function adminLogin(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const ok = await checkIsAdmin();
  if (!ok) {
    await sb.auth.signOut();
    throw new Error('该邮箱不是管理员，请联系站长添加。');
  }
  currentAdmin = { email };
  return currentAdmin;
}

async function adminLogout() {
  await sb.auth.signOut();
  currentAdmin = null;
}

function isLoggedIn() {
  return !!currentAdmin;
}

// 监听登录态变化（页面加载时也会触发一次）
function initAuth(onChange) {
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      const ok = await checkIsAdmin();
      currentAdmin = ok ? { email: session.user.email } : null;
    } else {
      currentAdmin = null;
    }
    onChange(currentAdmin);
  });
}
