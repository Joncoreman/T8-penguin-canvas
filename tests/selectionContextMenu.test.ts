import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

test('multi-selection context menu hides align actions behind a hover submenu', () => {
  const canvas = read('../src/components/Canvas.tsx');
  const menuStart = canvas.indexOf('data-canvas-floating-ui="node-menu"');
  const submenuStart = canvas.indexOf('data-canvas-floating-ui="selection-align-submenu"');
  const quickAddStart = canvas.indexOf('{/* 画布空白区右键菜单', submenuStart);

  assert.ok(menuStart > 0, 'selection context menu should exist');
  assert.ok(submenuStart > menuStart, 'alignment submenu should be rendered after the top-level menu');
  assert.ok(quickAddStart > submenuStart, 'submenu should stay inside the selection menu render block');

  const firstLevelMenu = canvas.slice(menuStart, submenuStart);
  const submenu = canvas.slice(submenuStart, quickAddStart);

  assert.match(firstLevelMenu, /aria-label="打开对齐和整理方式"/);
  assert.match(firstLevelMenu, /<span className="flex-1">对齐 \/ 整理<\/span>/);
  assert.doesNotMatch(firstLevelMenu, /水平等距|垂直等距|吸附网格|整理网格/);

  assert.match(submenu, /role="menu"/);
  assert.match(submenu, /对齐方式/);
  assert.match(submenu, /整理方式/);
  assert.match(submenu, /alignButton\('distribute-x', '水平等距'/);
  assert.match(submenu, /alignButton\('arrange-grid', '整理网格'/);
  assert.match(canvas, /selectionContextSubmenuCloseTimerRef/);
  assert.match(canvas, /const alignSubmenuOpensLeft = menuLeft \+ menuWidth \+ alignSubmenuWidth > window\.innerWidth - 8/);
});
