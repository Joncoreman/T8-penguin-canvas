import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('prompt editor shortcut is registered globally', () => {
  const shortcuts = read('../src/utils/keyboardShortcuts.ts');

  assert.match(shortcuts, /id:\s*'editor\.expand-prompt'/);
  assert.match(shortcuts, /label:\s*'放大编辑提示词'/);
  assert.match(shortcuts, /defaults:\s*\[\{\s*key:\s*'Enter',\s*alt:\s*true\s*\}\]/);
});

test('shared prompt editor components expose modal and textarea affordances', () => {
  const modal = read('../src/components/PromptExpandModal.tsx');
  const textarea = read('../src/components/PromptTextarea.tsx');

  assert.match(modal, /data-canvas-floating-ui="prompt-expand-editor"/);
  assert.match(modal, /flex min-h-0 flex-1 flex-col p-4/);
  assert.match(modal, /Ctrl\+Enter 完成/);
  assert.match(modal, /Esc 取消/);
  assert.match(modal, /readOnly \? '当前字段为只读，可查看或复制。'/);
  assert.match(modal, /editorKind\?:\s*PromptExpandEditorKind/);
  assert.match(modal, /格式化 JSON/);
  assert.match(modal, /校验 JSON/);
  assert.match(modal, /整理列表/);

  assert.match(textarea, /PromptExpandModal/);
  assert.match(textarea, /data-prompt-expand-trigger/);
  assert.match(textarea, /matchesAnyShortcut\(expandCombos,\s*event\.nativeEvent\)/);
  assert.match(textarea, /shortcuts\['editor\.expand-prompt'\]/);
  assert.match(textarea, /editorKind=\{editorKind\}/);
  assert.match(textarea, /composingRef/);
  assert.match(textarea, /isImeCompositionInput/);
  assert.match(textarea, /onBeforeInput=\{handleBeforeInput\}/);
  assert.match(textarea, /onCompositionEnd=\{handleCompositionEnd\}/);
});

test('mention prompt input keeps media mentions in expanded editor', () => {
  const mention = read('../src/components/nodes/MentionPromptInput.tsx');

  assert.match(mention, /title\?:\s*string/);
  assert.match(mention, /expandable\?:\s*boolean/);
  assert.match(mention, /PromptExpandModal/);
  assert.match(mention, /data-prompt-expand-trigger/);
  assert.match(mention, /matchesAnyShortcut\(expandShortcuts,\s*e\.nativeEvent\)/);
  assert.match(mention, /isImeCompositionInput/);
  assert.match(mention, /onBeforeInput=\{\(event\) =>/);
  assert.match(mention, /if \(isImeCompositionInput\(event\.nativeEvent\)\) composingRef\.current = true/);
  assert.match(mention, /zIndex:\s*expandable \? 10050 : 10120/);
  assert.match(mention, /height:\s*expandable \? style\?\.height : '100%'/);
  assert.match(mention, /minHeight:\s*expandable \? \(style\?\.minHeight \?\? 56\) : '100%'/);
  assert.match(mention, /'display:inline-block'/);
  assert.match(mention, /'width:24px'/);
  assert.match(mention, /'height:24px'/);
  assert.match(mention, /'vertical-align:middle'/);
  assert.match(mention, /const content = document\.createElement\('span'\)/);
  assert.match(mention, /span\.replaceChildren\(content\)/);
  assert.match(mention, /expandable=\{false\}/);
  assert.match(mention, /setDraftMentions\(nextMentions\)/);
});

test('core generation nodes use expanded prompt editing', () => {
  const image = read('../src/components/nodes/ImageNode.tsx');
  const video = read('../src/components/nodes/VideoNode.tsx');
  const seedance = read('../src/components/nodes/SeedanceNode.tsx');
  const audio = read('../src/components/nodes/AudioNode.tsx');
  const llm = read('../src/components/nodes/LLMNode.tsx');
  const panorama = read('../src/components/nodes/Panorama3DNode.tsx');

  assert.match(image, /import PromptTextarea from '\.\.\/PromptTextarea'/);
  assert.match(image, /title="图像 Prompt"/);
  assert.match(image, /title="ComfyUI 正向 Prompt"/);
  assert.match(image, /title="ComfyUI 负向 Prompt"/);
  assert.match(image, /title="图像扩展模型 System Prompt"/);

  assert.match(video, /title="视频 Prompt"/);
  assert.match(seedance, /title="SD2\.0 Prompt"/);
  assert.match(audio, /title="音频歌词 \/ 提示词"/);
  assert.match(llm, /title="LLM 系统提示词"/);
  assert.match(llm, /title="LLM 用户输入"/);
  assert.match(panorama, /title="3D 全景提示词"/);
});

test('dynamic RH and ComfyUI text parameters use expanded prompt editing', () => {
  const runningHub = read('../src/components/nodes/RunningHubNode.tsx');
  const rhTools = read('../src/components/nodes/RHToolsNode.tsx');
  const comfyStore = read('../src/components/nodes/ComfyUIStoreNode.tsx');

  assert.match(runningHub, /import PromptTextarea from '\.\.\/PromptTextarea'/);
  assert.match(runningHub, /title=\{`RunningHub 参数 · \$\{it\.fieldName \|\| '文本'\} #\$\{it\.nodeId \|\| ''\}`\}/);
  assert.match(runningHub, /<PromptTextarea[\s\S]*readOnly/);

  assert.match(rhTools, /import PromptTextarea from '\.\.\/PromptTextarea'/);
  assert.match(rhTools, /title=\{`RH 工具箱参数 · \$\{it\.fieldName \|\| '文本'\} #\$\{it\.nodeId \|\| ''\}`\}/);
  assert.match(rhTools, /<PromptTextarea[\s\S]*readOnly/);

  assert.match(comfyStore, /import PromptTextarea from '\.\.\/PromptTextarea'/);
  assert.match(comfyStore, /title=\{`ComfyUI 参数 · \$\{param\.label\}`\}/);
  assert.match(comfyStore, /onValueChange=\{\(value\) => setParam\(param\.key,\s*value\)\}/);
});

test('configuration JSON and list editors reuse expanded prompt editing', () => {
  const apiSettings = read('../src/components/ApiSettings.tsx');
  const comfyMaker = read('../src/components/nodes/ComfyUIAppMakerNode.tsx');
  const rhMaker = read('../src/components/nodes/RHToolboxMakerNode.tsx');
  const rhEditor = read('../src/components/nodes/RHToolEditorModal.tsx');

  assert.match(apiSettings, /import PromptTextarea from '\.\/PromptTextarea'/);
  assert.match(apiSettings, /title="ComfyUI Workflow JSON"/);
  assert.match(apiSettings, /title="ComfyUI fields JSON"/);
  assert.match(apiSettings, /editorKind="json"/);
  assert.match(apiSettings, /editorKind="lines"/);
  assert.match(apiSettings, /title=\{`\$\{provider\.label \|\| protocolLabel\} 图像模型`\}/);

  assert.match(comfyMaker, /import PromptTextarea from '\.\.\/PromptTextarea'/);
  assert.match(comfyMaker, /title="ComfyUI Workflow JSON"/);
  assert.match(comfyMaker, /title="ComfyUI 自动映射排除规则"/);

  assert.match(rhMaker, /title="RH 工具能力标签"/);
  assert.match(rhMaker, /title="RH 工具 manifest JSON"/);
  assert.match(rhMaker, /readOnly/);

  assert.match(rhEditor, /title="RH 超市应用简介"/);
});
