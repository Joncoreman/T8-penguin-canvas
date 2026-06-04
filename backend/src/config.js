const path = require('path');
const fs = require('fs');
const os = require('os');

// T8-penguin-canvas 后端配置
// 运行模式:
//   - 开发: backend/src/config.js 底下的 PROJECT_DIR 即项目根
//   - 打包: 主进程 electron/main.cjs 会注入 T8PC_PACKAGED=1 与 T8PC_USER_DATA=<userData>
//             数据/输入/输出/缩略图都位于该 userData 下,近可读写;
//             前端静态产物位于 T8PC_FRONTEND_DIST(默认 resources/frontend)。
const IS_PACKAGED = process.env.T8PC_PACKAGED === '1';
const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const USER_DATA = process.env.T8PC_USER_DATA && process.env.T8PC_USER_DATA.trim().length > 0
  ? process.env.T8PC_USER_DATA
  : PROJECT_DIR;
const DATA_ROOT = IS_PACKAGED ? USER_DATA : PROJECT_DIR;
const USER_HOME_DIR = os.homedir() || process.env.USERPROFILE || process.env.HOME || PROJECT_DIR;
const LEGACY_WINDOWS_DEFAULT_ROOT = 'D:\\zhenzhen';
const DEFAULT_ZHENZHEN_ROOT = process.platform === 'win32'
  ? LEGACY_WINDOWS_DEFAULT_ROOT
  : path.join(USER_HOME_DIR, 'zhenzhen');
const DEFAULT_RESOURCE_LIBRARY_DIR = path.join(DEFAULT_ZHENZHEN_ROOT, 'resources');
const DEFAULT_THEME_TEMPLATE_DIR = path.join(DEFAULT_ZHENZHEN_ROOT, 'theme-templates');

const config = {
  // 服务器
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || 18766, // 注意:与主项目 18765 错开
  APP_VERSION: '2.0.2',
  NODE_ENV: process.env.NODE_ENV || (IS_PACKAGED ? 'production' : 'development'),
  IS_PACKAGED,

  // 数据 / 资源目录
  // 开发模式: 项目根下 data/input/output/thumbnails
  // 打包模式: %APPDATA%/T8-PenguinCanvas/data ...走 userData
  BASE_DIR: DATA_ROOT,
  DATA_DIR: path.join(DATA_ROOT, 'data'),
  INPUT_DIR: path.join(DATA_ROOT, 'input'),
  OUTPUT_DIR: path.join(DATA_ROOT, 'output'),
  THUMBNAILS_DIR: path.join(DATA_ROOT, 'thumbnails'),

  // 数据文件
  CANVAS_FILE: path.join(DATA_ROOT, 'data', 'canvas_list.json'),
  SETTINGS_FILE: path.join(DATA_ROOT, 'data', 'settings.json'),
  RH_APPS_FILE: path.join(DATA_ROOT, 'data', 'rh_apps.json'),
  // v1.2.10+ RH 工具节点专用数据（与 rh_apps.json 完全分开）
  RH_TOOL_CATEGORIES_FILE: path.join(DATA_ROOT, 'data', 'rh_tool_categories.json'),
  RH_TOOL_APPS_FILE: path.join(DATA_ROOT, 'data', 'rh_tool_apps.json'),
  // 前端静态产物目录(打包后由 Express 同进程托管)
  FRONTEND_DIST: process.env.T8PC_FRONTEND_DIST || (IS_PACKAGED ? '' : path.join(PROJECT_DIR, 'dist')),

  // 缩略图配置
  THUMBNAIL_SIZE: 160,
  THUMBNAIL_QUALITY: 80,

  // 业务配置
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  // 三套 API Key 默认值(均可在 settings 中覆盖)
  // 贞贞工坊 / LLM 独立 Key 强制走 https://ai.t8star.org
  ZHENZHEN_BASE_URL: 'https://ai.t8star.org',
  RH_BASE_URL: 'https://www.runninghub.cn',

  // v1.2.10.2: 全局生成素材自动保存到本地的默认路径
  //   用户可在「API 设置 → 文件自动保存路径」覆盖。
  //   不存在时启动会自动创建; 写入失败仅 console.warn, 不阻断业务。
  DEFAULT_LOCAL_SAVE_DIR: DEFAULT_ZHENZHEN_ROOT,
  // v1.3.1: 画布自动保存导出路径默认同本地素材保存路径。
  //   实际文件会写入 <path>/T8-penguin-canvas/canvases/*.json。
  DEFAULT_CANVAS_AUTO_SAVE_DIR: DEFAULT_ZHENZHEN_ROOT,
  // v1.3.4: 资源库默认路径。资源文件与 resource_library.json 元数据均保存在此路径,
  //   用户更换版本后只要设置同一路径即可继续读取资源库。
  DEFAULT_RESOURCE_LIBRARY_DIR,
  // v1.3.6: 主题模板目录。自定义模板 JSON 保存在这里，内置模板仍打包在前端代码里。
  DEFAULT_THEME_TEMPLATE_DIR,
  // 本地 Eagle API 默认地址。仅允许本机地址，避免桌面端变成远端请求代理。
  DEFAULT_EAGLE_API_BASE: 'http://127.0.0.1:41595',
  // 用于旧版本配置迁移：Windows 继续沿用 D:\zhenzhen，非 Windows 遇到旧硬编码默认值时迁移到用户目录。
  LEGACY_WINDOWS_DEFAULT_ROOT,
};

// 提前创建打包后的数据目录(避免首次启动报错)
if (IS_PACKAGED) {
  for (const dir of [config.DATA_DIR, config.INPUT_DIR, config.OUTPUT_DIR, config.THUMBNAILS_DIR]) {
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
}

module.exports = config;
