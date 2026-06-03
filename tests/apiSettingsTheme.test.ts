import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSettingsSource = readFileSync(new URL('../src/components/ApiSettings.tsx', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');

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
  assert.match(apiSettingsSource, /自动映射排除规则（可选）/);
  assert.match(apiSettingsSource, /filterComfyFieldsByExcludeRules/);
  assert.match(apiSettingsSource, /parseComfyFieldExcludeRules/);
  assert.match(apiSettingsSource, /comfyExcludeRulesRaw/);
  assert.match(apiSettingsSource, /排除采样器参数/);
});
