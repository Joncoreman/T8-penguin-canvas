import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadRhToolboxUtils = async () => import('../src/utils/rhToolbox.ts');
const loadRhToolboxManifest = async () => import('../src/data/rhToolboxManifest.ts');

test('RH toolbox node is registered as a visible executable RH node', () => {
  const registry = readFileSync(new URL('../src/config/nodeRegistry.ts', import.meta.url), 'utf8');
  const ports = readFileSync(new URL('../src/config/portTypes.ts', import.meta.url), 'utf8');
  const types = readFileSync(new URL('../src/types/canvas.ts', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');
  const actionBar = readFileSync(new URL('../src/components/NodeActionBar.tsx', import.meta.url), 'utf8');
  const loop = readFileSync(new URL('../src/components/nodes/LoopNode.tsx', import.meta.url), 'utf8');

  assert.match(registry, /type:\s*'rh-toolbox'[\s\S]*label:\s*'RH工具箱'[\s\S]*category:\s*'rh'/);
  assert.match(ports, /'rh-toolbox':\s*\{\s*inputs:\s*\['text', 'image', 'video', 'audio'\],\s*outputs:\s*\['text', 'image', 'video', 'audio'\]\s*\}/);
  assert.match(types, /\|\s*'rh-toolbox'/);
  assert.match(canvas, /const RHToolboxNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/RHToolboxNode'\), 'RHToolboxNode'\)/);
  assert.match(canvas, /'rh-toolbox': RHToolboxNode/);
  assert.match(canvas, /'rh-toolbox':\s*\{/);
  assert.match(canvas, /'rh-tools', 'rh-toolbox'/);
  assert.match(actionBar, /'rh-tools', 'rh-toolbox'/);
  assert.match(loop, /'rh-tools', 'rh-toolbox'/);
});

test('RH toolbox manifest keeps draft tools disabled until webappId is supplied', async () => {
  const { RH_TOOLBOX_MANIFEST } = await loadRhToolboxManifest();
  const {
    filterRhToolboxTools,
    listRhToolboxTools,
    normalizeRhToolboxManifest,
  } = await loadRhToolboxUtils();

  const manifest = normalizeRhToolboxManifest(RH_TOOLBOX_MANIFEST);

  assert.equal(manifest.schema, 't8-rh-toolbox-manifest');
  assert.equal(manifest.categories.length, 4);
  assert.equal(listRhToolboxTools(manifest).length, 0);
  assert.equal(listRhToolboxTools(manifest, { includeDisabled: true }).length, 4);
  assert.deepEqual(
    filterRhToolboxTools(manifest, { capability: 'image.cutout', includeDisabled: true }).map((tool) => tool.id),
    ['image-cutout-template'],
  );
});

test('RH toolbox builds nodeInfoList from configured mappings without per-tool code', async () => {
  const {
    buildRhToolboxNodeInfoList,
    classifyRhToolboxOutputs,
    normalizeRhToolboxManifest,
    pickRhToolboxInputs,
  } = await loadRhToolboxUtils();

  const manifest = normalizeRhToolboxManifest({
    schema: 't8-rh-toolbox-manifest',
    version: 1,
    categories: [{ id: 'image-tools', name: '图像工具' }],
    tools: [
      {
        id: 'cutout',
        title: '抠图',
        categoryId: 'image-tools',
        webappId: '200000',
        enabled: true,
        capabilities: ['image.cutout'],
        inputSchema: [
          { key: 'image', kind: 'image', rhNodeId: '7', fieldName: 'image', required: true },
          { key: 'prompt', kind: 'text', rhNodeId: '30', fieldName: 'prompt', required: false },
        ],
        fixedParams: [{ rhNodeId: '31', fieldName: 'mode', value: 'transparent', valueType: 'text' }],
        userParams: [
          {
            key: 'strength',
            label: '强度',
            kind: 'number',
            rhNodeId: '32',
            fieldName: 'strength',
            defaultValue: 0.8,
          },
        ],
        outputSchema: [{ key: 'out', kind: 'image', role: 'replace-source' }],
      },
    ],
  });
  const tool = manifest.tools[0];

  const picked = pickRhToolboxInputs(tool, {
    images: ['/files/input/a.png'],
    texts: ['主体抠图'],
  });
  assert.equal(picked.missing.length, 0);

  const nodeInfoList = buildRhToolboxNodeInfoList(tool, {
    inputValues: { ...picked.values, image: 'rh-uploaded-a.png' },
    userParamValues: { strength: 0.6 },
  });

  assert.deepEqual(nodeInfoList, [
    { nodeId: '7', fieldName: 'image', fieldValue: 'rh-uploaded-a.png', valueType: 'image' },
    { nodeId: '30', fieldName: 'prompt', fieldValue: '主体抠图', valueType: 'text' },
    { nodeId: '32', fieldName: 'strength', fieldValue: 0.6, valueType: 'number' },
    { nodeId: '31', fieldName: 'mode', fieldValue: 'transparent', valueType: 'text' },
  ]);

  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).imageUrls, ['/files/output/a.png']);
  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).videoUrls, ['/files/output/b.mp4']);
  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).audioUrls, ['/files/output/c.wav']);
});

test('RH toolbox service exposes a single callable runner for future quick actions', () => {
  const service = readFileSync(new URL('../src/services/rhToolbox.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');

  assert.match(service, /export async function runRhToolboxTool/);
  assert.match(service, /uploadRhAsset/);
  assert.match(service, /submitRh/);
  assert.match(service, /queryRh/);
  assert.match(component, /runRhToolboxTool/);
  assert.match(component, /MaterialPreviewSection/);
});

test('RH toolbox maker is dev-only and guarded from packaged builds', () => {
  const registry = readFileSync(new URL('../src/config/nodeRegistry.ts', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');
  const ports = readFileSync(new URL('../src/config/portTypes.ts', import.meta.url), 'utf8');
  const postBuild = readFileSync(new URL('../electron/_post_build.cjs', import.meta.url), 'utf8');
  const features = readFileSync(new URL('../features.json', import.meta.url), 'utf8');

  assert.match(registry, /import\.meta\.env\?\.DEV[\s\S]*type:\s*'rh-toolbox-maker'[\s\S]*label:\s*'RH工具箱制作器'/);
  assert.match(canvas, /import\.meta\.env\?\.DEV[\s\S]*lazyCanvasNode\(\(\) => import\('\.\/nodes\/RHToolboxMakerNode'\), 'RHToolboxMakerNode'\)/);
  assert.match(canvas, /import\.meta\.env\?\.DEV \? \{ 'rh-toolbox-maker': RHToolboxMakerNode \} : \{\}/);
  assert.match(ports, /import\.meta\.env\?\.DEV[\s\S]*'rh-toolbox-maker':\s*\{\s*inputs:\s*\[\],\s*outputs:\s*\['text'\]\s*\}/);
  assert.match(postBuild, /checkNoRhToolboxMaker/);
  assert.match(postBuild, /RHToolboxMakerNode/);
  assert.match(postBuild, /RH工具箱制作器/);
  assert.match(features, /RH工具箱制作器/);
});

test('RH toolbox developer manifest helpers are source-gated for dev runtime', () => {
  const devUtils = readFileSync(new URL('../src/utils/rhToolboxDeveloper.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/rhToolbox.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');

  assert.match(devUtils, /RH_TOOLBOX_DEVELOPER_STORAGE_KEY/);
  assert.match(devUtils, /function isRhToolboxDeveloperRuntime\(\)/);
  assert.match(devUtils, /import\.meta as any\)\?\.env\?\.DEV/);
  assert.match(devUtils, /export function mergeRhToolboxManifestWithDeveloperDrafts/);
  assert.match(devUtils, /export function saveRhToolboxDeveloperTool/);
  assert.doesNotMatch(service, /RH_TOOLBOX_DEVELOPER_STORAGE_KEY|mergeRhToolboxManifestWithDeveloperDrafts/);
  assert.match(component, /if \(!import\.meta\.env\.DEV\)/);
  assert.match(component, /import\('\.\.\/\.\.\/utils\/rhToolboxDeveloper'\)/);
});
