#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SAFE_ROOT = ROOT.replace(/\\/g, '/');
const allowedDiffFiles = new Set(['features.json']);
const privateKeyword = ['re', 'charge'].join('');
const privateModalName = ['Recharge', 'Modal'].join('');
const deniedPaths = [
  'skill.md',
  'roadmap.md',
  'local-private/',
  'src/private/',
  'backend/src/private/',
  'private/',
  ['backend/src/routes/', privateKeyword, '.js'].join(''),
  ['src/components/', privateModalName, '.tsx'].join(''),
  ['data/', privateKeyword].join(''),
  ['backend/data/', privateKeyword].join(''),
];
const deniedText = [
  privateModalName,
  ['/api', '/', privateKeyword].join(''),
  ['/', 'pay'].join(''),
  ['RE', 'CHARGE'].join(''),
  ['DU', 'LUPAY'].join(''),
  ['AGENT', '_HMAC'].join(''),
  '\u5145\u503c',
];

function git(args) {
  const result = spawnSync('git', ['-c', `safe.directory=${SAFE_ROOT}`, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function stagedFiles() {
  const raw = git(['diff', '--cached', '--name-only', '-z']);
  return raw.split('\0').map((item) => item.trim()).filter(Boolean);
}

function normalizeGitPath(p) {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function main() {
  const files = stagedFiles();
  const failures = [];

  for (const file of files) {
    const normalized = normalizeGitPath(file);
    if (deniedPaths.some((entry) => normalized === entry || normalized.startsWith(entry))) {
      failures.push(`blocked staged path: ${normalized}`);
    }
  }

  for (const file of files) {
    const normalized = normalizeGitPath(file);
    if (allowedDiffFiles.has(normalized)) continue;
    const diff = git(['diff', '--cached', '--', normalized]);
    const addedText = diff
      .split(/\r?\n/)
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .join('\n');
    for (const token of deniedText) {
      if (addedText.includes(token)) {
        failures.push(`blocked staged text token in ${normalized}: ${token}`);
      }
    }
  }

  if (failures.length) {
    console.error('[public-check] failed');
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log('[public-check] ok');
}

main();
