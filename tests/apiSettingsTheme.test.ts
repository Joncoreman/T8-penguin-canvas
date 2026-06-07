import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const apiSettingsSource = readFileSync(new URL('../src/components/ApiSettings.tsx', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');
const defaultTemplatesSource = readFileSync(new URL('../src/theme/defaultTemplates.ts', import.meta.url), 'utf8');
const themeTemplateManagerSource = readFileSync(new URL('../src/components/ThemeTemplateManager.tsx', import.meta.url), 'utf8');
const featuresSource = readFileSync(new URL('../features.json', import.meta.url), 'utf8');

test('ApiSettings uses semantic theme classes for cross-theme readability', () => {
  const requiredClasses = [
    't8-api-settings-modal',
    't8-api-settings-body',
    't8-api-settings-toggle',
    't8-api-settings-badge',
    't8-api-settings-provider-card',
    't8-api-settings-provider-panel',
    't8-api-settings-section',
    't8-api-settings-guide',
    't8-api-settings-input',
  ];

  for (const className of requiredClasses) {
    assert.match(apiSettingsSource, new RegExp(className), `${className} should be used by ApiSettings`);
    assert.match(indexCss, new RegExp(`\\.${className}\\b`), `${className} should be defined in index.css after Tailwind utilities`);
  }
});

test('ApiSettings theme CSS is backed by T8 tokens instead of hard-coded white panels', () => {
  const cssBlock = indexCss.slice(indexCss.indexOf('/* API settings semantic theme adapter */'));
  assert.ok(cssBlock.length > 0, 'API settings semantic theme adapter should exist');
  assert.match(cssBlock, /--t8-bg-panel/);
  assert.match(cssBlock, /--t8-text-main/);
  assert.match(cssBlock, /--t8-text-muted/);
  assert.match(cssBlock, /--t8-border/);
  assert.match(cssBlock, /--t8-accent/);
});

test('ApiSettings advanced provider fields stay mounted while typing and ModelScope exposes token links', () => {
  assert.doesNotMatch(
    apiSettingsSource,
    /const\s+FormBlock\s*=/,
    'advanced provider sections must not define a React component inside renderAdvancedProviderForm',
  );
  assert.match(apiSettingsSource, /function\s+AdvancedProviderFormBlock/);
  assert.match(apiSettingsSource, /https:\/\/www\.modelscope\.cn\/my\/access\/token/);
  assert.match(apiSettingsSource, /https:\/\/www\.modelscope\.ai\/my\/access\/token/);
  assert.match(apiSettingsSource, /获取 Token · 国内/);
  assert.match(apiSettingsSource, /获取 Token · 国外/);
  assert.match(apiSettingsSource, /ModelScope LoRA/);
  assert.match(apiSettingsSource, /中文模型库/);
  assert.match(apiSettingsSource, /https:\/\/www\.modelscope\.cn\/aigc\/models/);
});

test('ApiSettings Jimeng CLI panel explains install, login, and executable path', () => {
  assert.match(apiSettingsSource, /如何安装即梦 CLI/);
  assert.match(apiSettingsSource, /curl -s https:\/\/jimeng\.jianying\.com\/cli \| bash/);
  assert.match(apiSettingsSource, /dreamina login/);
  assert.match(apiSettingsSource, /C:\\Users\\&lt;用户名&gt;\\bin\\dreamina\.exe/);
  assert.match(apiSettingsSource, /测试连接/);
});

test('ApiSettings ComfyUI panel supports workflow JSON upload and auto-mapping exclude rules', () => {
  assert.match(apiSettingsSource, /handleComfyWorkflowFile/);
  assert.match(apiSettingsSource, /上传 JSON/);
  assert.match(apiSettingsSource, /applyComfySampleWorkflow/);
  assert.match(apiSettingsSource, /载入样例/);
  assert.match(apiSettingsSource, /buildComfyWorkflowImportChecklist/);
  assert.match(apiSettingsSource, /自动映射排除规则（可选）/);
  assert.match(apiSettingsSource, /filterComfyFieldsByExcludeRules/);
  assert.match(apiSettingsSource, /parseComfyFieldExcludeRules/);
  assert.match(apiSettingsSource, /comfyExcludeRulesRaw/);
  assert.match(apiSettingsSource, /排除采样器参数/);
});

test('ApiSettings Volcengine panel separates Ark API Key from AK/SK credentials', () => {
  assert.match(apiSettingsSource, /方舟 Ark API Key（生成用，不是 AK\/SK）/);
  assert.match(apiSettingsSource, /请输入方舟 Ark API Key，不要填 Access Key ID \/ Secret/);
  assert.match(apiSettingsSource, /3\. 火山 AK\/SK（可选，素材签名）/);
  assert.match(apiSettingsSource, /Access Key ID（AK，素材签名）/);
  assert.match(apiSettingsSource, /Secret Access Key（SK，素材签名）/);
  assert.match(apiSettingsSource, /目前它只作为素材签名类能力的预留凭证/);
  assert.match(apiSettingsSource, /Seedance2\.0 开通提醒/);
  assert.match(apiSettingsSource, /doubao-seedance-2-0-260128/);
  assert.match(apiSettingsSource, /doubao-seedance-2-0-fast-260128/);
  assert.match(apiSettingsSource, /ModelNotOpen \/ HTTP 404/);
});

test('Dragon Ball theme defaults to bundled mp3 music and packaging validates the asset', () => {
  const postBuild = readFileSync(new URL('../electron/_post_build.cjs', import.meta.url), 'utf8');
  const musicAsset = new URL('../src/assets/theme-music/dragonball-makafushigi-adventure.mp3', import.meta.url);
  const hiddenMusicAsset = new URL('../src/assets/theme-music/dragonball-shenron-cha-la-head-cha-la.mp3', import.meta.url);

  assert.equal(existsSync(musicAsset), true);
  assert.equal(existsSync(hiddenMusicAsset), true);
  assert.match(defaultTemplatesSource, /dragonBallThemeMusicUrl = new URL\('\.\.\/assets\/theme-music\/dragonball-makafushigi-adventure\.mp3'/);
  assert.match(defaultTemplatesSource, /dragonBallShenronHiddenMusicUrl = new URL\('\.\.\/assets\/theme-music\/dragonball-shenron-cha-la-head-cha-la\.mp3'/);
  assert.match(defaultTemplatesSource, /id: DRAGON_BALL_TEMPLATE_ID[\s\S]*source: 'url'[\s\S]*url: dragonBallThemeMusicUrl/);
  assert.match(defaultTemplatesSource, /title: '摩诃不思议 Adventure'/);
  assert.match(defaultTemplatesSource, /hiddenTitle: 'CHA-LA HEAD-CHA-LA'/);
  assert.match(defaultTemplatesSource, /hiddenUrl: dragonBallShenronHiddenMusicUrl/);
  assert.match(themeTemplateManagerSource, /dragonBallThemeMusicUrl/);
  assert.match(themeTemplateManagerSource, /dragonBallShenronHiddenMusicUrl/);
  assert.match(themeTemplateManagerSource, /visualStyle === 'dragon-ball'[\s\S]*source: 'url'[\s\S]*url: dragonBallThemeMusicUrl/);
  assert.match(themeTemplateManagerSource, /visualStyle === 'dragon-ball'[\s\S]*hiddenUrl: dragonBallShenronHiddenMusicUrl/);
  assert.match(postBuild, /checkFrontendAsset\('dragonball-makafushigi-adventure-', '\.mp3'\)/);
  assert.match(postBuild, /checkFrontendAsset\('dragonball-shenron-cha-la-head-cha-la-', '\.mp3'\)/);
  assert.match(featuresSource, /"dragon-ball-style": "dragonball-makafushigi-adventure\.mp3"/);
  assert.match(featuresSource, /"dragon-ball-shenron-hidden": "dragonball-shenron-cha-la-head-cha-la\.mp3"/);
});
