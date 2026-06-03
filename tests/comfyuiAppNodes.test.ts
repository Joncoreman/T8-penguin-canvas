import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const maker = fs.readFileSync('src/components/nodes/ComfyUIAppMakerNode.tsx', 'utf8');
const store = fs.readFileSync('src/components/nodes/ComfyUIStoreNode.tsx', 'utf8');

test('ComfyUI app nodes keep the node shell draggable while controls remain protected', () => {
  assert.match(maker, /<div style=\{rootStyle\} className="relative nowheel">/);
  assert.doesNotMatch(maker, /<div style=\{rootStyle\} className="relative nodrag nowheel">/);
  assert.match(maker, /px-input nodrag nowheel/);
  assert.match(maker, /px-btn nodrag nowheel/);

  assert.match(store, /<div className="relative flex flex-col nowheel" style=\{rootStyle\}>/);
  assert.doesNotMatch(store, /<div className="relative flex flex-col nodrag nowheel" style=\{rootStyle\}>/);
  assert.match(store, /px-input nodrag nowheel/);
  assert.match(store, /px-btn nodrag nowheel/);
});

test('ComfyUI maker and store expose local library management controls', () => {
  assert.match(maker, /comfyMakerHiddenParamKeys/);
  assert.match(maker, /移除此参数/);
  assert.match(maker, /恢复全部已移除参数/);
  assert.match(maker, /comfyMakerExcludeRules/);
  assert.match(maker, /自动映射排除规则（可选）/);
  assert.match(maker, /排除采样器参数/);

  assert.match(store, /comfyuiStoreManageCategories/);
  assert.match(store, /新建分类/);
  assert.match(store, /导出本地自定义应用和分类/);
  assert.match(store, /设置应用分类/);
  assert.match(store, /删除应用/);
});
