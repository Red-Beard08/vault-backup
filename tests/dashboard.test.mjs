import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

// Exercise the maintained view with Obsidian's DOM helpers and lifecycle mocked.
class Element {
  constructor(tag = 'div', options = {}) {
    this.tag = tag;
    this.text = options.text ?? '';
    this.children = [];
    this.classes = new Set((options.cls ?? '').split(' ').filter(Boolean));
    this.listeners = {};
  }
  createEl(tag, options) { const child = new Element(tag, options); this.children.push(child); return child; }
  createDiv(options) { return this.createEl('div', options); }
  empty() { this.children = []; this.text = ''; }
  addClass(value) { this.classes.add(value); }
  setText(value) { this.empty(); this.text = value; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
  textContent() { return this.all().map(node => node.text).join('\n'); }
}

const notices = [];
const obsidian = {
  ItemView: class {
    constructor(leaf) {
      this.app = leaf.app;
      this.containerEl = new Element();
      this.headerEl = this.containerEl.createDiv({ text: 'Obsidian view header' });
      this.contentEl = this.containerEl.createDiv({ cls: 'view-content' });
    }
  },
  Modal: class {}, Plugin: class {}, PluginSettingTab: class {}, TFile: class {},
  Notice: class { constructor(message) { notices.push(message); } }
};
const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const bundle = await build({
  stdin: { contents: source + '\nexport { VaultBackupView };', loader: 'ts', resolveDir: fileURLToPath(new URL('../src', import.meta.url)) },
  bundle: true, platform: 'node', format: 'cjs', external: ['obsidian'], write: false
});
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports, Error, Buffer,
  require: name => name === 'obsidian' ? obsidian : require(name)
});
const { VaultBackupView } = module.exports;
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup(overrides = {}) {
  let scans = 0;
  let settingsOpened = 0;
  const manager = {
    validateDestination: () => null,
    snapshots: async () => [],
    conflictFiles: async () => [],
    snapshotBytes: async snapshot => snapshot.entries.reduce((total, entry) => total + entry.size, 0),
    duplicateGroups: async () => { scans++; return []; },
    ...overrides
  };
  const plugin = { manager, settings: { destination: 'D:/Backups', preset: 'full' }, openSettings: () => { settingsOpened++; } };
  const view = new VaultBackupView({ app: {} }, plugin);
  return { view, manager, scans: () => scans, settingsOpened: () => settingsOpened };
}
function button(view, label) { return view.contentEl.all().find(node => node.tag === 'button' && node.text === label); }

test('opening keeps Obsidian chrome and exposes working controls while disk reads wait', async () => {
  const pending = deferred();
  const fixture = setup({ snapshots: () => pending.promise, conflictFiles: () => pending.promise });
  const { view } = fixture;
  await view.onOpen();
  assert.deepEqual(view.containerEl.children, [view.headerEl, view.contentEl]);
  for (const label of ['Backup now', 'Preview changes', 'Duplicate review', 'Conflicts', 'Restore', 'Recovery copy', 'Prune snapshots', 'Refresh', 'Settings']) assert.ok(button(view, label), label);
  assert.match(view.contentEl.textContent(), /Loading snapshot history/);
  button(view, 'Settings').listeners.click();
  await flush();
  assert.equal(fixture.settingsOpened(), 1);
  assert.equal(fixture.scans(), 0);
  pending.resolve([]);
  await flush();
});

test('snapshot history loads independently of a pending conflict scan', async () => {
  const pending = deferred();
  const { view } = setup({ conflictFiles: () => pending.promise, snapshots: async () => [{ meta: { created: '2026-10-01T12:00:00Z', entries: [{ size: 2048 }] } }] });
  const rendered = view.render();
  await flush();
  assert.match(view.contentEl.textContent(), /1 snapshots · 2.0 KB/);
  assert.match(view.contentEl.textContent(), /Conflicts\nLoading/);
  pending.resolve(['preserved.md']);
  await rendered;
  assert.match(view.contentEl.textContent(), /1 preserved files/);
});

test('failed reads show errors, preserve actions, and recover on refresh', async () => {
  const { view, manager } = setup({ snapshots: async () => { throw new Error('drive offline'); }, conflictFiles: async () => { throw new Error('access denied'); } });
  await view.render();
  assert.match(view.contentEl.textContent(), /Could not load snapshot history: drive offline/);
  assert.match(view.contentEl.textContent(), /Could not load: access denied/);
  assert.ok(button(view, 'Settings'));
  manager.snapshots = async () => [];
  manager.conflictFiles = async () => [];
  button(view, 'Refresh').listeners.click();
  await flush();
  assert.match(view.contentEl.textContent(), /No snapshots yet/);
  assert.doesNotMatch(view.contentEl.textContent(), /drive offline|access denied/);
});

test('unconfigured destination shows setup guidance without reading disk', async () => {
  const unexpected = () => { assert.fail('should not read an invalid destination'); };
  const { view } = setup({ validateDestination: () => 'Choose a backup destination in Settings.', snapshots: unexpected, conflictFiles: unexpected });
  await view.render();
  assert.match(view.contentEl.textContent(), /Choose a valid backup destination/);
  assert.doesNotMatch(view.contentEl.textContent(), /Loading/);
  assert.ok(button(view, 'Settings'));
});

test('old loads cannot update a refreshed dashboard', async () => {
  const pending = deferred();
  const { view, manager } = setup({ snapshots: () => pending.promise });
  const first = view.render();
  const oldRoot = view.contentEl.children[0];
  await flush();
  const oldText = oldRoot.textContent();
  manager.snapshots = async () => [];
  await view.render();
  pending.resolve([{ meta: { created: '2026-10-01T12:00:00Z', entries: [{ size: 9999 }] } }]);
  await first;
  assert.equal(oldRoot.textContent(), oldText);
  assert.match(view.contentEl.textContent(), /No snapshots yet/);
});

test('closing prevents pending reads from updating the view', async () => {
  const pending = deferred();
  const { view } = setup({ snapshots: () => pending.promise, conflictFiles: () => pending.promise });
  const rendering = view.render();
  await view.onClose();
  const before = view.contentEl.textContent();
  pending.resolve([]);
  await rendering;
  assert.equal(view.contentEl.textContent(), before);
});

test('failed dashboard actions surface a notice instead of an unhandled rejection', async () => {
  const { view } = setup({ prune: async () => { throw new Error('permission denied'); } });
  await view.render();
  button(view, 'Prune snapshots').listeners.click();
  await flush();
  assert.equal(notices.at(-1), 'Prune snapshots failed: permission denied');
});
