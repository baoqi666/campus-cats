// ============================================================
// 配置：部署前请填入你的 Supabase 项目信息
//   1) 打开 https://app.supabase.com 新建项目（免费）
//   2) Project Settings -> API，复制 URL 和 anon public key
//   3) 替换下面两个值
// ============================================================
const SUPABASE_URL = 'https://qlvpjmqzfimgpubybjya.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_S9gYK4XJJ0kQWdV7pUI18Q_LLnr4vXN';

// 站点名称（显示在页眉 / 标题）
const SITE_NAME = '校园小猫图鉴';

// 捐款收款二维码图片地址（在“筹款”详情页展示给用户扫码付款）
// 可把二维码上传到 Supabase Storage 后粘贴其公开 URL，留空则不显示
const DONATION_QR_URL = '';

// 收款说明（例如：微信/支付宝扫码，或转账至 XXX）
const DONATION_NOTE = '实际付款请扫码或转账至猫协收款账户，管理员确认到账后更新进度。';
