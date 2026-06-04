export type ParseAuthNeed = 'rarely' | 'sometimes' | 'often';

export interface ParseAuthProfile {
  id: string;
  label: string;
  domains: string[];
  authUrl: string;
  need: ParseAuthNeed;
  cookieHint: string;
  manualSteps: string[];
}

export const PARSE_AUTH_PROFILES: ParseAuthProfile[] = [
  {
    id: 'douyin',
    label: '抖音',
    domains: ['douyin.com', 'iesdouyin.com'],
    authUrl: 'https://www.douyin.com/',
    need: 'sometimes',
    cookieHint: '公开短链通常可直接解析；私密、地区限制或风控内容可能需要登录态。',
    manualSteps: ['打开抖音网页版并登录', '按 F12 打开开发者工具', '在 Network 中刷新页面，复制任意请求的 Cookie 请求头'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    domains: ['tiktok.com'],
    authUrl: 'https://www.tiktok.com/',
    need: 'sometimes',
    cookieHint: '部分地区、年龄限制或账号可见内容可能需要登录态和代理。',
    manualSteps: ['打开 TikTok 网页版并登录', '打开开发者工具 Network', '复制请求头里的 Cookie 字段'],
  },
  {
    id: 'xiaohongshu',
    label: '小红书',
    domains: ['xiaohongshu.com', 'xhslink.com'],
    authUrl: 'https://www.xiaohongshu.com/',
    need: 'often',
    cookieHint: '小红书经常需要登录态；授权失效时请重新登录官方网页。',
    manualSteps: ['打开小红书网页版并登录', '进入需要解析的笔记页面', '在 Network 中复制页面请求的 Cookie 请求头'],
  },
  {
    id: 'bilibili',
    label: 'Bilibili',
    domains: ['bilibili.com', 'b23.tv'],
    authUrl: 'https://www.bilibili.com/',
    need: 'rarely',
    cookieHint: '公开视频通常无需 Cookie；会员、互动或账号可见内容不应绕过权限。',
    manualSteps: ['打开 Bilibili 网页版并登录', '打开开发者工具 Application/Cookies 或 Network', '复制 bilibili.com 的 Cookie'],
  },
  {
    id: 'weibo',
    label: '微博',
    domains: ['weibo.com', 'weibo.cn'],
    authUrl: 'https://weibo.com/',
    need: 'sometimes',
    cookieHint: '登录可见、长文或反爬限制内容可能需要 Cookie。',
    manualSteps: ['打开微博网页版并登录', '进入目标微博页面', '复制 Network 请求中的 Cookie 请求头'],
  },
  {
    id: 'kuaishou',
    label: '快手',
    domains: ['kuaishou.com', 'gifshow.com'],
    authUrl: 'https://www.kuaishou.com/',
    need: 'sometimes',
    cookieHint: '公开内容优先直接解析；风控或账号可见内容可能需要登录态。',
    manualSteps: ['打开快手网页版并登录', '打开目标作品页', '复制 Network 请求里的 Cookie 请求头'],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'google.com'],
    authUrl: 'https://www.youtube.com/',
    need: 'rarely',
    cookieHint: '公开视频通常无需 Cookie；年龄限制或私密视频必须确认账号权限与平台条款。',
    manualSteps: ['打开 YouTube 并登录', '进入目标视频页', '复制 youtube.com 请求中的 Cookie 请求头'],
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    domains: ['x.com', 'twitter.com'],
    authUrl: 'https://x.com/',
    need: 'sometimes',
    cookieHint: '登录可见、敏感内容或限流时可能需要登录态。',
    manualSteps: ['打开 X / Twitter 并登录', '进入目标推文', '复制 Network 请求中的 Cookie 请求头'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    domains: ['instagram.com'],
    authUrl: 'https://www.instagram.com/',
    need: 'often',
    cookieHint: 'Instagram 大多需要登录态；请只解析本人有权访问的内容。',
    manualSteps: ['打开 Instagram 并登录', '进入目标帖子或 Reels', '复制 instagram.com 请求中的 Cookie 请求头'],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    domains: ['facebook.com', 'fb.watch'],
    authUrl: 'https://www.facebook.com/',
    need: 'often',
    cookieHint: 'Facebook 内容权限复杂，Cookie 只用于本人账号可访问内容。',
    manualSteps: ['打开 Facebook 并登录', '进入目标内容', '复制 facebook.com 请求中的 Cookie 请求头'],
  },
  {
    id: 'threads',
    label: 'Threads',
    domains: ['threads.net'],
    authUrl: 'https://www.threads.net/',
    need: 'sometimes',
    cookieHint: '部分内容可能需要 Instagram/Threads 登录态。',
    manualSteps: ['打开 Threads 并登录', '进入目标帖子', '复制 threads.net 请求中的 Cookie 请求头'],
  },
  {
    id: 'tieba',
    label: '贴吧',
    domains: ['tieba.baidu.com'],
    authUrl: 'https://tieba.baidu.com/',
    need: 'rarely',
    cookieHint: '公开帖子通常可直接解析；账号可见内容需要确认权限。',
    manualSteps: ['打开贴吧并登录', '进入目标帖子', '复制 tieba.baidu.com 请求中的 Cookie 请求头'],
  },
];

function hostnameFromUrl(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostMatches(hostname: string, domain: string): boolean {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
}

export function detectParseAuthProfile(input: string): ParseAuthProfile | null {
  const text = String(input || '').toLowerCase();
  const urls = text.match(/https?:\/\/[^\s"'<>，。；、)）\]]+/gi) || [];
  const hosts = urls.map(hostnameFromUrl).filter(Boolean);
  return PARSE_AUTH_PROFILES.find((profile) => {
    if (profile.domains.some((domain) => text.includes(domain.toLowerCase()))) return true;
    return hosts.some((host) => profile.domains.some((domain) => hostMatches(host, domain)));
  }) || null;
}

function cookiePairsFromJson(value: unknown): string[] {
  const root = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.cookies)
      ? (value as any).cookies
      : Array.isArray((value as any)?.data)
        ? (value as any).data
        : [];
  return root
    .map((item: any) => {
      const name = String(item?.name || '').trim();
      const rawValue = String(item?.value || '').trim();
      return name && rawValue ? `${name}=${rawValue}` : '';
    })
    .filter(Boolean);
}

function cookiePairsFromNetscape(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(/\t+/);
      if (parts.length < 7) return '';
      const name = parts[5]?.trim();
      const value = parts.slice(6).join('\t').trim();
      return name && value ? `${name}=${value}` : '';
    })
    .filter(Boolean);
}

function cleanCookieHeader(text: string): string {
  return text
    .replace(/^cookie\s*:\s*/i, '')
    .replace(/\r?\n/g, '; ')
    .replace(/;\s*;/g, ';')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^;+|;+$/g, '');
}

export function normalizeCookieInput(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^\s*[\[{]/.test(raw)) {
    try {
      const pairs = cookiePairsFromJson(JSON.parse(raw));
      if (pairs.length) return pairs.join('; ');
    } catch {
      // Keep falling through to header parsing.
    }
  }

  const curlHeader = raw.match(/(?:-H|--header)\s+(["'])Cookie\s*:\s*([\s\S]*?)\1/i);
  if (curlHeader?.[2]) return cleanCookieHeader(curlHeader[2]);

  const headerLine = raw.match(/(?:^|\n)\s*Cookie\s*:\s*([^\n\r]+)/i);
  if (headerLine?.[1]) return cleanCookieHeader(headerLine[1]);

  const netscapePairs = cookiePairsFromNetscape(raw);
  if (netscapePairs.length) return netscapePairs.join('; ');

  return cleanCookieHeader(raw);
}

export function hasUsableCookie(input: string): boolean {
  const cookie = normalizeCookieInput(input);
  return /(^|;\s*)[^=;\s]+=[^;]+/.test(cookie);
}

export function buildCookieGuide(profile: ParseAuthProfile | null): string {
  const target = profile || {
    label: '目标平台',
    manualSteps: ['打开目标平台网页版并登录', '打开浏览器开发者工具的 Network 面板', '刷新页面后复制请求里的 Cookie 请求头'],
    cookieHint: '仅在平台明确需要登录态时使用 Cookie。',
  };
  return [
    `${target.label} Cookie 获取指南`,
    '',
    target.cookieHint,
    '',
    ...target.manualSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '安全提醒：Cookie 等同登录凭证，只能在可信本机使用；不要分享给他人，不要用于绕过付费、DRM、私密内容或平台权限。',
  ].join('\n');
}
