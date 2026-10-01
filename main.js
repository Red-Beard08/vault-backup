/* Vault Backup by Red-Beard */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => VaultBackupPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/dashboard-bridge.ts
function host(app) {
  var _a, _b;
  return (_b = (_a = app.plugins) == null ? void 0 : _a.getPlugin) == null ? void 0 : _b.call(_a, "red-beard-dashboard");
}
function registerWithRetry(app, method, definition) {
  let dispose = () => void 0;
  let timer;
  let attempts = 0;
  const attempt = () => {
    var _a;
    const dashboard = host(app);
    const fn = dashboard == null ? void 0 : dashboard[method];
    if (fn) {
      try {
        dispose = (_a = fn(definition)) != null ? _a : (() => void 0);
      } catch (e) {
      }
      if (timer !== void 0) window.clearTimeout(timer);
      return;
    }
    if (attempts++ < 120) timer = window.setTimeout(attempt, 250);
  };
  attempt();
  return () => {
    if (timer !== void 0) window.clearTimeout(timer);
    dispose();
  };
}
function registerDashboardModule(app, definition) {
  let dispose = () => void 0;
  let timer;
  let attempts = 0;
  const attempt = () => {
    var _a;
    const dashboard = host(app);
    if (dashboard == null ? void 0 : dashboard.registerModule) {
      try {
        dispose = (_a = dashboard.registerModule(definition)) != null ? _a : (() => void 0);
      } catch (e) {
      }
      if (timer !== void 0) window.clearTimeout(timer);
      return;
    }
    if (attempts++ < 120) timer = window.setTimeout(attempt, 250);
  };
  attempt();
  return () => {
    if (timer !== void 0) window.clearTimeout(timer);
    dispose();
  };
}
function registerDashboardWidget(app, definition) {
  return registerWithRetry(app, "registerWidget", definition);
}

// src/main.ts
var import_node_fs = require("node:fs");
var path = __toESM(require("node:path"));
var import_node_crypto = require("node:crypto");
var VIEW = "vault-backup-dashboard";
var DEFAULTS = { destination: "", preset: "content", include: [], exclude: [".trash/**", "*.tmp", "*.log"], scheduleMinutes: 60, changeThreshold: 10, retentionCount: 30, retentionDays: 180, ignoredDuplicates: [], duplicateMasters: {}, duplicateSimilarityThreshold: 0.86, scanHiddenDuplicateFiles: true };
function norm(p) {
  return p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function globMatch(value, rule) {
  const r = norm(rule).trim();
  if (!r) return false;
  const escaped = r.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\xA7\xA7").replace(/\*/g, "[^/]*").replace(/§§/g, ".*").replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`, "i").test(value) || r.endsWith("/**") && value.toLowerCase().startsWith(r.slice(0, -3).toLowerCase() + "/");
}
function selected(p, s) {
  const n = norm(p);
  const ext = path.posix.extname(n).toLowerCase();
  if (s.preset === "markdown" && ext !== ".md") return false;
  if (s.preset === "content" && (n.startsWith(".obsidian/") || n.startsWith(".trash/"))) return false;
  if (s.preset !== "custom" && s.exclude.some((x) => globMatch(n, x))) return false;
  if (s.preset === "custom" && s.include.length && !s.include.some((x) => globMatch(n, x))) return false;
  return !s.exclude.some((x) => globMatch(n, x));
}
function hash(data) {
  return (0, import_node_crypto.createHash)("sha256").update(data).digest("hex");
}
function stamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
}
function formatBytes(n) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
function fileStem(p) {
  return path.posix.basename(p).replace(/\.[^.]+$/, "");
}
function conflictName(p) {
  return /(?:\s+\(\d+\)|\s+\(?(?:conflicted copy|conflict|duplicate|copy)(?:\s+\d+)?\)?)$/i.test(fileStem(p));
}
function baseName(p) {
  return fileStem(p).replace(/(?:\s+\(\d+\)|\s+\(?(?:conflicted copy|conflict|duplicate|copy)(?:\s+\d+)?\)?)$/i, "").trim().toLowerCase();
}
function normalizedContent(s) {
  return s.replace(/^updated:\s.*$/gim, "").replace(/^created:\s.*$/gim, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function contentSimilarity(a, b) {
  const x = normalizedContent(a);
  const y = normalizedContent(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const xt = new Set(x.split(/\W+/).filter((t) => t.length > 2));
  const yt = new Set(y.split(/\W+/).filter((t) => t.length > 2));
  const union = (/* @__PURE__ */ new Set([...xt, ...yt])).size;
  const overlap = [...xt].filter((t) => yt.has(t)).length;
  const lengthRatio = Math.min(x.length, y.length) / Math.max(x.length, y.length);
  return union ? overlap / union * 0.7 + lengthRatio * 0.3 : 0;
}
function duplicateEligible(p, s) {
  const n = norm(p);
  if (!n || n.startsWith(".trash/")) return false;
  return !s.exclude.some((x) => globMatch(n, x));
}
function pairKey(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("|");
}
var BackupManager = class {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  get owner() {
    return this.plugin;
  }
  base() {
    var _a, _b;
    const adapter = this.app.vault.adapter;
    return (_b = (_a = adapter.getBasePath) == null ? void 0 : _a.call(adapter)) != null ? _b : "";
  }
  validateDestination() {
    const d = this.plugin.settings.destination.trim();
    if (!d) return "Choose a backup destination in Settings.";
    const abs = path.resolve(d);
    const base = this.base();
    if (base) {
      const rel = path.relative(path.resolve(base), abs);
      if (!rel || !rel.startsWith("..") && !path.isAbsolute(rel)) return "The backup destination must be outside the vault.";
    }
    return null;
  }
  async inventory() {
    const entries = [];
    for (const file of this.app.vault.getFiles()) {
      if (!selected(file.path, this.plugin.settings)) continue;
      const data = Buffer.from(await this.app.vault.readBinary(file));
      entries.push({ path: norm(file.path), size: data.length, sha256: hash(data), modified: file.stat.mtime });
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }
  async allVaultPaths() {
    const paths = new Set(this.app.vault.getFiles().map((file) => norm(file.path)));
    if (!this.plugin.settings.scanHiddenDuplicateFiles) return [...paths];
    const adapter = this.app.vault.adapter;
    const walk = async (dir) => {
      var _a, _b;
      if (!adapter.list) return;
      try {
        const result = await adapter.list(dir);
        for (const file of (_a = result.files) != null ? _a : []) paths.add(norm(file));
        for (const folder of (_b = result.folders) != null ? _b : []) {
          const next = norm(folder);
          if (next && next !== dir) await walk(next);
        }
      } catch (e) {
      }
    };
    await walk("");
    return [...paths];
  }
  async duplicateInventory() {
    const entries = [];
    for (const filePath of await this.allVaultPaths()) {
      if (!duplicateEligible(filePath, this.plugin.settings)) continue;
      const file = this.app.vault.getAbstractFileByPath(filePath);
      try {
        const data = await this.readEntryBuffer(filePath);
        entries.push({ path: filePath, size: data.length, sha256: hash(data), modified: file instanceof import_obsidian.TFile ? file.stat.mtime : void 0 });
      } catch (e) {
      }
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }
  async readEntryBuffer(entryPath) {
    const file = this.app.vault.getAbstractFileByPath(entryPath);
    if (file instanceof import_obsidian.TFile) return Buffer.from(await this.app.vault.readBinary(file));
    const adapter = this.app.vault.adapter;
    if (adapter.readBinary) return Buffer.from(await adapter.readBinary(entryPath));
    throw new Error(`File unavailable: ${entryPath}`);
  }
  async snapshots() {
    const root = path.join(this.plugin.settings.destination, "Snapshots");
    try {
      const dirs = await import_node_fs.promises.readdir(root, { withFileTypes: true });
      const out = [];
      for (const d of dirs.filter((x) => x.isDirectory())) {
        try {
          const meta = JSON.parse(await import_node_fs.promises.readFile(path.join(root, d.name, "snapshot.json"), "utf8"));
          if (meta == null ? void 0 : meta.entries) out.push({ dir: path.join(root, d.name), meta });
        } catch (e) {
        }
      }
      return out.sort((a, b) => b.meta.created.localeCompare(a.meta.created));
    } catch (e) {
      return [];
    }
  }
  async latest() {
    var _a, _b;
    return (_b = (_a = (await this.snapshots())[0]) == null ? void 0 : _a.meta) != null ? _b : null;
  }
  async duplicateGroups() {
    var _a, _b, _c, _d, _e;
    const ignored = new Set((_a = this.plugin.settings.ignoredDuplicates) != null ? _a : []);
    const entries = (await this.duplicateInventory()).filter((e) => e.size > 0 && !ignored.has(e.path));
    const groups = [];
    const chooseMaster = (files, key) => {
      var _a2, _b2, _c2, _d2;
      const preferred = (_c2 = (_a2 = this.plugin.settings.duplicateMasters) == null ? void 0 : _a2[key]) != null ? _c2 : key.startsWith("hash:") ? (_b2 = this.plugin.settings.duplicateMasters) == null ? void 0 : _b2[key.slice(5)] : void 0;
      return (_d2 = files.find((file) => file.path === preferred)) != null ? _d2 : files.slice().sort((a, b) => Number(conflictName(a.path)) - Number(conflictName(b.path)) || a.path.length - b.path.length || a.path.localeCompare(b.path))[0];
    };
    const byHash = /* @__PURE__ */ new Map();
    entries.forEach((entry) => {
      var _a2;
      const list = (_a2 = byHash.get(entry.sha256)) != null ? _a2 : [];
      list.push(entry);
      byHash.set(entry.sha256, list);
    });
    for (const [key, files] of byHash) {
      if (files.length < 2) continue;
      const master = chooseMaster(files, key);
      const duplicates = files.filter((file) => file.path !== master.path);
      const hasConflictName = files.some((file) => conflictName(file.path));
      groups.push({
        kind: hasConflictName ? "iCloud-style duplicate (exact content)" : "Exact content match",
        key: `hash:${key}`,
        reason: hasConflictName ? "These files are byte-for-byte identical, and at least one filename has an iCloud copy/conflict suffix." : "These files are byte-for-byte identical, even if their folders or filenames differ.",
        confidence: "exact",
        master,
        duplicates
      });
    }
    const textCache = /* @__PURE__ */ new Map();
    const getText = async (entry) => {
      const cached = textCache.get(entry.path);
      if (cached !== void 0) return cached;
      const value = await this.previewText(entry);
      textCache.set(entry.path, value);
      return value;
    };
    const buckets = /* @__PURE__ */ new Map();
    entries.filter((entry) => path.posix.extname(entry.path).toLowerCase() === ".md").forEach((entry) => {
      var _a2;
      const key = baseName(entry.path);
      if (!key) return;
      const list = (_a2 = buckets.get(key)) != null ? _a2 : [];
      list.push(entry);
      buckets.set(key, list);
    });
    for (const [name, files] of buckets) {
      if (files.length < 2) continue;
      const adjacency = /* @__PURE__ */ new Map();
      const similarities = /* @__PURE__ */ new Map();
      for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) {
        const a = files[i], b = files[j];
        if (a.sha256 === b.sha256) continue;
        const similarity = contentSimilarity(await getText(a), await getText(b));
        if (similarity < ((_b = this.plugin.settings.duplicateSimilarityThreshold) != null ? _b : 0.86)) continue;
        const key = pairKey(a.path, b.path);
        similarities.set(key, similarity);
        const aSet = (_c = adjacency.get(a.path)) != null ? _c : /* @__PURE__ */ new Set();
        aSet.add(b.path);
        adjacency.set(a.path, aSet);
        const bSet = (_d = adjacency.get(b.path)) != null ? _d : /* @__PURE__ */ new Set();
        bSet.add(a.path);
        adjacency.set(b.path, bSet);
      }
      const visited = /* @__PURE__ */ new Set();
      for (const start of adjacency.keys()) {
        if (visited.has(start)) continue;
        const component = [];
        const stack = [start];
        visited.add(start);
        while (stack.length) {
          const current = stack.pop();
          const entry = files.find((file) => file.path === current);
          if (entry) component.push(entry);
          for (const next of (_e = adjacency.get(current)) != null ? _e : []) if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
        if (component.length < 2) continue;
        const master = chooseMaster(component, `similar:${component.map((file) => file.path).sort().join("|")}`);
        const duplicates = component.filter((file) => file.path !== master.path);
        if (!duplicates.length) continue;
        const bestSimilarity = Math.max(...similarities.values());
        const conflict = component.some((file) => conflictName(file.path));
        groups.push({
          kind: conflict ? "iCloud-style conflict (similar content)" : "Likely duplicate (small content differences)",
          key: `similar:${component.map((file) => file.path).sort().join("|")}`,
          reason: conflict ? `The normalized filename \u201C${name}\u201D appears in an iCloud-style copy/conflict group, and the notes are ${(bestSimilarity * 100).toFixed(0)}% similar.` : `The normalized filename \u201C${name}\u201D appears more than once, and the notes are ${(bestSimilarity * 100).toFixed(0)}% similar.`,
          confidence: "likely",
          master,
          duplicates,
          similarity: bestSimilarity
        });
      }
    }
    return groups.sort((a, b) => Number(b.confidence === "exact") - Number(a.confidence === "exact") || a.master.path.localeCompare(b.master.path));
  }
  async previewText(entry) {
    if (path.posix.extname(entry.path).toLowerCase() !== ".md" && !entry.path.toLowerCase().endsWith(".json")) return `[Binary file \xB7 ${formatBytes(entry.size)}]`;
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (file instanceof import_obsidian.TFile) return (await this.app.vault.read(file)).slice(0, 6e3);
    const adapter = this.app.vault.adapter;
    if (adapter.read) return (await adapter.read(entry.path)).slice(0, 6e3);
    return "[File unavailable]";
  }
  async openEntry(entry) {
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (file instanceof import_obsidian.TFile) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      return;
    }
    new import_obsidian.Notice("Obsidian cannot open this hidden/config file as a note.");
  }
  async conflictFiles() {
    const root = path.join(this.plugin.settings.destination, "Conflicts");
    const found = [];
    const walk = async (dir) => {
      try {
        for (const item of await import_node_fs.promises.readdir(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) await walk(full);
          else found.push(path.relative(root, full).replace(/\\/g, "/"));
        }
      } catch (e) {
      }
    };
    if (this.plugin.settings.destination) await walk(root);
    return found.sort();
  }
  async snapshotBytes(snapshot) {
    return snapshot.entries.reduce((sum, entry) => sum + entry.size, 0);
  }
  async changes() {
    var _a, _b;
    const current = await this.inventory();
    const previous = await this.latest();
    const old = new Map(((_a = previous == null ? void 0 : previous.entries) != null ? _a : []).map((e) => [e.path, e]));
    const now = new Map(current.map((e) => [e.path, e]));
    return { current, previous, changed: current.filter((e) => old.has(e.path) && old.get(e.path).sha256 !== e.sha256), added: current.filter((e) => !old.has(e.path)), removed: ((_b = previous == null ? void 0 : previous.entries) != null ? _b : []).filter((e) => !now.has(e.path)) };
  }
  async backup() {
    const problem = this.validateDestination();
    if (problem) throw new Error(problem);
    const entries = await this.inventory();
    const id = stamp();
    const stage = path.join(this.plugin.settings.destination, ".staging", id);
    const final = path.join(this.plugin.settings.destination, "Snapshots", id);
    await import_node_fs.promises.mkdir(path.join(stage, "Vault Files"), { recursive: true });
    for (const entry of entries) {
      const target = path.join(stage, "Vault Files", ...entry.path.split("/"));
      await import_node_fs.promises.mkdir(path.dirname(target), { recursive: true });
      const data = Buffer.from(await this.app.vault.readBinary(this.app.vault.getAbstractFileByPath(entry.path)));
      await import_node_fs.promises.writeFile(target, data);
    }
    const meta = { id, created: (/* @__PURE__ */ new Date()).toISOString(), preset: this.plugin.settings.preset, entries };
    await import_node_fs.promises.writeFile(path.join(stage, "snapshot.json"), JSON.stringify(meta, null, 2), "utf8");
    await import_node_fs.promises.mkdir(path.dirname(final), { recursive: true });
    await import_node_fs.promises.rename(stage, final);
    await this.prune();
    this.plugin.lastBackup = meta.created;
    await this.plugin.saveData({ ...this.plugin.settings, lastBackup: this.plugin.lastBackup });
    return meta;
  }
  async prune() {
    const all = await this.snapshots();
    const cutoff = Date.now() - this.plugin.settings.retentionDays * 864e5;
    for (const item of all.slice(1)) {
      const tooMany = all.indexOf(item) >= this.plugin.settings.retentionCount;
      const tooOld = new Date(item.meta.created).getTime() < cutoff;
      if (tooMany || tooOld) await import_node_fs.promises.rm(item.dir, { recursive: true, force: true });
    }
  }
  async exportRecovery(snapshot) {
    const root = path.join(this.plugin.settings.destination, "Recovery", `${snapshot.id}-${stamp()}`);
    for (const entry of snapshot.entries) {
      const source = path.join(this.plugin.settings.destination, "Snapshots", snapshot.id, "Vault Files", ...entry.path.split("/"));
      const target = path.join(root, ...entry.path.split("/"));
      await import_node_fs.promises.mkdir(path.dirname(target), { recursive: true });
      await import_node_fs.promises.copyFile(source, target);
    }
    await import_node_fs.promises.writeFile(path.join(root, "RECOVERY-MANIFEST.json"), JSON.stringify(snapshot, null, 2), "utf8");
    return root;
  }
  async restore(snapshot, paths) {
    var _a;
    const problem = this.validateDestination();
    if (problem) throw new Error(problem);
    const conflictRoot = path.join(this.plugin.settings.destination, "Conflicts", stamp());
    for (const rel of paths) {
      const source = path.join(this.plugin.settings.destination, "Snapshots", snapshot.id, "Vault Files", ...rel.split("/"));
      const data = await import_node_fs.promises.readFile(source);
      const existing = this.app.vault.getAbstractFileByPath(rel);
      if (existing instanceof import_obsidian.TFile) {
        const current = Buffer.from(await this.app.vault.readBinary(existing));
        const expected = (_a = snapshot.entries.find((e) => e.path === rel)) == null ? void 0 : _a.sha256;
        if (expected && hash(current) !== expected) {
          const conflict = path.join(conflictRoot, ...rel.split("/"));
          await import_node_fs.promises.mkdir(path.dirname(conflict), { recursive: true });
          await import_node_fs.promises.writeFile(conflict, current);
        }
        if (path.posix.extname(rel).toLowerCase() === ".md") await this.app.vault.modify(existing, data.toString("utf8"));
        else await this.app.vault.modifyBinary(existing, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      } else if (path.posix.extname(rel).toLowerCase() === ".md") await this.app.vault.create(rel, data.toString("utf8"));
      else await this.app.vault.createBinary(rel, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }
  }
};
var PreviewModal = class extends import_obsidian.Modal {
  constructor(app, manager) {
    super(app);
    this.manager = manager;
  }
  async onOpen() {
    this.titleEl.setText("Backup preview");
    const body = this.contentEl;
    body.createEl("p", { text: "Comparing selected vault files with the newest snapshot\u2026" });
    try {
      const c = await this.manager.changes();
      body.empty();
      body.createEl("p", { text: c.previous ? `Newest snapshot: ${new Date(c.previous.created).toLocaleString()}` : "No snapshot exists yet; the next backup will be a full baseline." });
      for (const [label, list] of [["Changed", c.changed], ["Added", c.added], ["Removed", c.removed]]) {
        body.createEl("h3", { text: `${label} (${list.length})` });
        if (list.length) body.createEl("ul").append(...list.slice(0, 100).map((e) => {
          const li = document.createElement("li");
          li.textContent = `${e.path} \xB7 ${formatBytes(e.size)}`;
          return li;
        }));
        else body.createEl("p", { text: "None" });
      }
      new import_obsidian.Setting(body).addButton((b) => b.setButtonText("Backup now").setCta().onClick(async () => {
        try {
          await this.manager.backup();
          new import_obsidian.Notice("Vault backup completed.");
          this.close();
        } catch (e) {
          new import_obsidian.Notice(`Backup failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }));
    } catch (e) {
      body.createEl("p", { text: String(e) });
    }
  }
};
var DuplicatesModal = class extends import_obsidian.Modal {
  constructor(app, manager) {
    super(app);
    this.manager = manager;
  }
  onOpen() {
    this.modalEl.addClass("vault-backup-duplicate-modal");
    this.titleEl.setText("Duplicate file review");
    void this.render();
  }
  async render() {
    const body = this.contentEl;
    body.empty();
    body.createEl("p", { cls: "vault-backup-review-intro", text: "Only files with a confirmed or likely partner appear here. Compare the previews, choose the file to keep, or move a candidate to Obsidian trash. Nothing is deleted automatically." });
    const scan = body.createDiv({ cls: "vault-backup-review-toolbar" });
    scan.createEl("span", { cls: "vault-backup-review-status", text: "Scanning the vault\u2026" });
    new import_obsidian.Setting(scan).addButton((b) => b.setButtonText("Rescan").onClick(() => void this.render())).addButton((b) => b.setButtonText("Close").onClick(() => this.close()));
    try {
      const groups = await this.manager.duplicateGroups();
      scan.empty();
      const exact = groups.filter((group) => group.confidence === "exact").length;
      const likely = groups.length - exact;
      scan.createEl("span", { cls: "vault-backup-review-status", text: groups.length ? `${groups.length} duplicate group${groups.length === 1 ? "" : "s"} \xB7 ${exact} exact \xB7 ${likely} likely` : "No duplicate groups found" });
      new import_obsidian.Setting(scan).addButton((b) => b.setButtonText("Rescan").onClick(() => void this.render())).addButton((b) => b.setButtonText("Close").onClick(() => this.close()));
      if (!groups.length) {
        body.createDiv({ cls: "vault-backup-empty", text: "No exact, iCloud-style, or near-content duplicate groups were found. Files without a partner are intentionally hidden." });
        return;
      }
      for (const group of groups) {
        const section = body.createDiv({ cls: "vault-backup-duplicate-group" });
        const heading = section.createDiv({ cls: "vault-backup-duplicate-heading" });
        heading.createEl("h3", { text: group.kind });
        heading.createEl("span", { cls: `vault-backup-confidence vault-backup-confidence-${group.confidence}`, text: group.confidence === "exact" ? "Confirmed" : "Review" });
        section.createEl("p", { cls: "vault-backup-duplicate-reason", text: group.reason });
        const compare = section.createDiv({ cls: "vault-backup-compare" });
        const files = [group.master, ...group.duplicates];
        for (const file of files) {
          const isMaster = file.path === group.master.path;
          const card = compare.createDiv({ cls: `vault-backup-file-card${isMaster ? " is-master" : ""}` });
          const top = card.createDiv({ cls: "vault-backup-file-card-top" });
          top.createEl("span", { cls: "vault-backup-file-role", text: isMaster ? "Likely file to keep" : "Candidate duplicate" });
          top.createEl("span", { cls: "vault-backup-file-size", text: formatBytes(file.size) });
          card.createEl("strong", { cls: "vault-backup-file-path", text: file.path });
          card.createEl("small", { cls: "vault-backup-file-meta", text: `SHA-256 ${file.sha256.slice(0, 12)}\u2026${file.modified ? ` \xB7 changed ${new Date(file.modified).toLocaleString()}` : ""}` });
          card.createEl("pre", { text: await this.manager.previewText(file) });
          const actions = card.createDiv({ cls: "vault-backup-file-actions" });
          if (this.manager.owner.app.vault.getAbstractFileByPath(file.path) instanceof import_obsidian.TFile) new import_obsidian.Setting(actions).addButton((b) => b.setButtonText("Open note").onClick(() => void this.manager.openEntry(file)));
          if (!isMaster) new import_obsidian.Setting(actions).addButton((b) => b.setButtonText("Keep this").setCta().onClick(async () => {
            this.manager.owner.settings.duplicateMasters[group.key] = file.path;
            await this.manager.owner.saveSettings();
            new import_obsidian.Notice(`Keeping ${file.path} as the selected master.`);
            await this.render();
          }));
          else new import_obsidian.Setting(actions).addButton((b) => b.setButtonText("Current master").setDisabled(true));
          if (!isMaster) new import_obsidian.Setting(actions).addButton((b) => b.setButtonText("Ignore").onClick(async () => {
            var _a;
            const ignored = (_a = this.manager.owner.settings.ignoredDuplicates) != null ? _a : [];
            if (!ignored.includes(file.path)) ignored.push(file.path);
            this.manager.owner.settings.ignoredDuplicates = ignored;
            await this.manager.owner.saveSettings();
            new import_obsidian.Notice(`Ignoring ${file.path} in future scans.`);
            await this.render();
          }));
          if (!isMaster) new import_obsidian.Setting(actions).addButton((b) => b.setButtonText("Move to trash").setWarning().onClick(async () => {
            if (!window.confirm(`Move ${file.path} to Obsidian trash? You can restore it from the trash folder.`)) return;
            const af = this.app.vault.getAbstractFileByPath(file.path);
            if (!af) {
              new import_obsidian.Notice("That file is no longer available.");
              await this.render();
              return;
            }
            await this.app.vault.trash(af, false);
            new import_obsidian.Notice(`Moved ${file.path} to Obsidian trash.`);
            await this.render();
          }));
        }
      }
    } catch (e) {
      scan.empty();
      body.createDiv({ cls: "vault-backup-error", text: `Scan failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
};
var ConflictModal = class extends import_obsidian.Modal {
  constructor(app, manager) {
    super(app);
    this.manager = manager;
  }
  async onOpen() {
    this.titleEl.setText("Conflict remediation");
    const body = this.contentEl;
    body.createEl("p", { text: "These are preserved current files created during conflict-safe restore. Compare them with the restored snapshot, then keep, merge, or archive manually." });
    const files = await this.manager.conflictFiles();
    if (!files.length) body.createEl("p", { text: "No preserved conflict files found." });
    else {
      const ul = body.createEl("ul");
      files.forEach((file) => ul.createEl("li", { text: file }));
    }
  }
};
var RestoreModal = class extends import_obsidian.Modal {
  constructor(app, manager) {
    super(app);
    this.manager = manager;
  }
  async onOpen() {
    this.titleEl.setText("Restore files");
    const body = this.contentEl;
    const all = await this.manager.snapshots();
    if (!all.length) {
      body.createEl("p", { text: "No snapshots found." });
      return;
    }
    const select = body.createEl("select");
    all.forEach((x) => select.createEl("option", { value: x.meta.id, text: `${new Date(x.meta.created).toLocaleString()} (${x.meta.entries.length} files)` }));
    const list = body.createDiv({ cls: "vault-backup-restore-list" });
    const render = () => {
      list.empty();
      const snap = all.find((x) => x.meta.id === select.value).meta;
      for (const e of snap.entries) new import_obsidian.Setting(list).setName(e.path).addToggle((t) => t.setValue(false).onChange(() => void 0));
    };
    select.addEventListener("change", render);
    render();
    new import_obsidian.Setting(body).setName("Restore selected files").setDesc("Files overwrite existing notes only after you confirm this action.").addButton((b) => b.setButtonText("Restore").setWarning().onClick(async () => {
      const snap = all.find((x) => x.meta.id === select.value).meta;
      const checks = Array.from(list.querySelectorAll("input[type=checkbox]"));
      const paths = snap.entries.filter((_, i) => {
        var _a;
        return (_a = checks[i]) == null ? void 0 : _a.checked;
      }).map((e) => e.path);
      if (!paths.length) {
        new import_obsidian.Notice("Select at least one file.");
        return;
      }
      if (!window.confirm(`Restore ${paths.length} selected file(s)? Existing files will be overwritten.`)) return;
      try {
        await this.manager.restore(snap, paths);
        new import_obsidian.Notice("Selected files restored.");
        this.close();
      } catch (e) {
        new import_obsidian.Notice(`Restore failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }));
  }
};
var VaultBackupView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderVersion = 0;
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "Vault Backup";
  }
  async onOpen() {
    void this.render();
  }
  async onClose() {
    this.renderVersion++;
  }
  async render() {
    const version = ++this.renderVersion;
    const current = () => version === this.renderVersion;
    const content = this.contentEl;
    content.empty();
    content.addClass("vault-backup-view");
    const root = content.createDiv({ cls: "vault-backup-dashboard" });
    root.createEl("h2", { cls: "vault-backup-hero", text: "Vault Backup" });
    root.createEl("p", { text: "Versioned snapshots of your vault to a local PC folder." });
    const error = this.plugin.manager.validateDestination();
    if (error) root.createDiv({ cls: "vault-backup-warning", text: error });
    const actions = root.createDiv({ cls: "vault-backup-actions" });
    const action = (label, fn) => {
      const button = actions.createEl("button", { text: label });
      button.addEventListener("click", () => {
        void Promise.resolve().then(fn).catch((e) => {
          new import_obsidian.Notice(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
        });
      });
    };
    action("Backup now", async () => {
      await this.plugin.manager.backup();
      new import_obsidian.Notice("Vault backup completed.");
      if (current()) await this.render();
    });
    action("Preview changes", () => new PreviewModal(this.app, this.plugin.manager).open());
    action("Duplicate review", () => new DuplicatesModal(this.app, this.plugin.manager).open());
    action("Conflicts", () => new ConflictModal(this.app, this.plugin.manager).open());
    action("Restore", () => new RestoreModal(this.app, this.plugin.manager).open());
    action("Recovery copy", async () => {
      const snapshot = await this.plugin.manager.latest();
      if (!snapshot) throw new Error("No snapshot exists.");
      const folder = await this.plugin.manager.exportRecovery(snapshot);
      new import_obsidian.Notice(`Recovery copy created: ${folder}`);
    });
    action("Prune snapshots", async () => {
      await this.plugin.manager.prune();
      new import_obsidian.Notice("Retention cleanup completed.");
      if (current()) await this.render();
    });
    action("Refresh", () => this.render());
    action("Settings", () => this.plugin.openSettings());
    const grid = root.createDiv({ cls: "vault-backup-metrics" });
    const lastBackup = grid.createDiv({ text: "Last backup\nLoading\u2026" });
    const history = grid.createDiv({ text: "History\nLoading\u2026" });
    const conflicts = grid.createDiv({ text: "Conflicts\nLoading\u2026" });
    grid.createDiv({ text: `Destination
${this.plugin.settings.destination || "Choose in Settings"}` });
    grid.createDiv({ text: `Preset
${this.plugin.settings.preset}` });
    root.createEl("h3", { text: "Duplicate review" });
    root.createEl("p", { text: "Open Duplicate review to scan for exact matches, iCloud copies, and similar notes. Large vaults may take a while to scan." });
    root.createEl("h3", { text: "Recent snapshots" });
    const recent = root.createDiv();
    recent.createEl("p", { text: "Loading snapshot history\u2026" });
    if (error) {
      lastBackup.setText("Last backup\nUnavailable");
      history.setText("History\nUnavailable");
      conflicts.setText("Conflicts\nUnavailable");
      recent.empty();
      recent.createEl("p", { text: "Choose a valid backup destination in Settings, then select Refresh." });
      return;
    }
    const loadSnapshots = async () => {
      var _a, _b;
      try {
        const snapshots = await this.plugin.manager.snapshots();
        const latest = (_b = (_a = snapshots[0]) == null ? void 0 : _a.meta) != null ? _b : null;
        const bytes = latest ? await this.plugin.manager.snapshotBytes(latest) : 0;
        if (!current()) return;
        lastBackup.setText(`Last backup
${latest ? new Date(latest.created).toLocaleString() : "No backups yet"}`);
        history.setText(`History
${snapshots.length} snapshots \xB7 ${formatBytes(bytes)}`);
        recent.empty();
        if (!snapshots.length) recent.createEl("p", { text: "No snapshots yet." });
        else snapshots.slice(0, 10).forEach((snapshot) => recent.createEl("p", {
          text: `${new Date(snapshot.meta.created).toLocaleString()} \xB7 ${snapshot.meta.entries.length} files`
        }));
      } catch (e) {
        if (!current()) return;
        lastBackup.setText("Last backup\nUnavailable");
        history.setText("History\nUnavailable");
        recent.empty();
        recent.createDiv({ cls: "vault-backup-warning", text: `Could not load snapshot history: ${e instanceof Error ? e.message : String(e)}. Check the destination and select Refresh.` });
      }
    };
    const loadConflicts = async () => {
      try {
        const files = await this.plugin.manager.conflictFiles();
        if (current()) conflicts.setText(`Conflicts
${files.length} preserved files`);
      } catch (e) {
        if (current()) conflicts.setText(`Conflicts
Could not load: ${e instanceof Error ? e.message : String(e)}. Select Refresh to retry.`);
      }
    };
    await Promise.all([loadSnapshots(), loadConflicts()]);
  }
};
var VaultBackupSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Backup" });
    containerEl.createEl("p", { text: "Backups run on this desktop only. Choose a folder outside the iCloud vault." });
    new import_obsidian.Setting(containerEl).setName("Backup destination").setDesc("Absolute PC path, for example D:\\Obsidian Backups\\Red-Beard").addText((t) => t.setValue(this.plugin.settings.destination).onChange(async (v) => {
      this.plugin.settings.destination = v.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Preset").addDropdown((d) => d.addOptions({ markdown: "Markdown only", content: "Vault content", full: "Full vault (including .obsidian)", custom: "Custom rules" }).setValue(this.plugin.settings.preset).onChange(async (v) => {
      this.plugin.settings.preset = v;
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.preset === "custom") {
      new import_obsidian.Setting(containerEl).setName("Include rules").setDesc("One glob per line; blank means all files").addTextArea((t) => t.setValue(this.plugin.settings.include.join("\n")).onChange(async (v) => {
        this.plugin.settings.include = v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      }));
    }
    new import_obsidian.Setting(containerEl).setName("Exclude rules").setDesc("One glob per line (for example .trash/**)").addTextArea((t) => t.setValue(this.plugin.settings.exclude.join("\n")).onChange(async (v) => {
      this.plugin.settings.exclude = v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Schedule (minutes)").addText((t) => t.setValue(String(this.plugin.settings.scheduleMinutes)).setPlaceholder("60").onChange(async (v) => {
      this.plugin.settings.scheduleMinutes = Math.max(0, Number(v) || 0);
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Change threshold").setDesc("Automatic backup after this many changed files; 0 disables it.").addText((t) => t.setValue(String(this.plugin.settings.changeThreshold)).onChange(async (v) => {
      this.plugin.settings.changeThreshold = Math.max(0, Number(v) || 0);
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Keep snapshots").addText((t) => t.setValue(String(this.plugin.settings.retentionCount)).onChange(async (v) => {
      this.plugin.settings.retentionCount = Math.max(1, Number(v) || 1);
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Keep snapshots for days").addText((t) => t.setValue(String(this.plugin.settings.retentionDays)).onChange(async (v) => {
      this.plugin.settings.retentionDays = Math.max(1, Number(v) || 1);
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Duplicate review" });
    new import_obsidian.Setting(containerEl).setName("Near-duplicate similarity threshold").setDesc("Review Markdown files with the same normalized name when their content is this similar. Exact matches are always shown.").addText((t) => {
      var _a;
      return t.setValue(String((_a = this.plugin.settings.duplicateSimilarityThreshold) != null ? _a : 0.86)).onChange(async (v) => {
        const number = Number(v);
        this.plugin.settings.duplicateSimilarityThreshold = Math.min(0.99, Math.max(0.5, Number.isFinite(number) ? number : 0.86));
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Scan hidden/config files").setDesc("Include iCloud-style copies of Obsidian configuration files, such as community-plugins (2).json, in duplicate review.").addToggle((t) => {
      var _a;
      return t.setValue((_a = this.plugin.settings.scanHiddenDuplicateFiles) != null ? _a : true).onChange(async (v) => {
        this.plugin.settings.scanHiddenDuplicateFiles = v;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).addButton((b) => b.setButtonText("Test destination").onClick(() => {
      var _a;
      return new import_obsidian.Notice((_a = this.plugin.manager.validateDestination()) != null ? _a : "Destination is valid.");
    }));
  }
};
var VaultBackupPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULTS;
    this.lastBackup = "";
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.manager = new BackupManager(this.app, this);
    this.addSettingTab(new VaultBackupSettingTab(this.app, this));
    this.registerView(VIEW, (leaf) => new VaultBackupView(leaf, this));
    this.addRibbonIcon("archive-restore", "Open Vault Backup", () => this.openDashboard());
    this.addCommand({ id: "open-dashboard", name: "Open dashboard", callback: () => this.openDashboard() });
    this.addCommand({ id: "backup-now", name: "Backup now", callback: () => this.runBackup() });
    this.addCommand({ id: "preview-changes", name: "Preview changes", callback: () => new PreviewModal(this.app, this.manager).open() });
    this.addCommand({ id: "duplicate-review", name: "Review duplicate files", callback: () => new DuplicatesModal(this.app, this.manager).open() });
    this.addCommand({ id: "restore", name: "Restore selected files", callback: () => new RestoreModal(this.app, this.manager).open() });
    this.addCommand({ id: "prune", name: "Prune snapshots", callback: () => this.manager.prune() });
    this.addCommand({ id: "process-mobile-requests", name: "Process mobile backup requests", callback: () => this.processMobileRequests() });
    const queue = () => {
      if (this.changeTimer) window.clearTimeout(this.changeTimer);
      this.changeTimer = window.setTimeout(() => void this.autoCheck(), 15e3);
    };
    this.registerEvent(this.app.vault.on("create", queue));
    this.registerEvent(this.app.vault.on("modify", queue));
    this.registerEvent(this.app.vault.on("delete", queue));
    this.registerEvent(this.app.vault.on("rename", queue));
    if (this.settings.scheduleMinutes > 0) this.timer = window.setInterval(() => void this.autoCheck(), Math.max(5, this.settings.scheduleMinutes) * 6e4);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  openSettings() {
    var _a;
    const setting = this.app.setting;
    if (!setting) {
      new import_obsidian.Notice("Obsidian settings are unavailable.");
      return;
    }
    try {
      (_a = setting.open) == null ? void 0 : _a.call(setting);
      window.setTimeout(() => {
        var _a2;
        try {
          (_a2 = setting.openTabById) == null ? void 0 : _a2.call(setting, this.manifest.id);
        } catch (e) {
        }
      }, 100);
    } catch (e) {
      new import_obsidian.Notice(`Could not open Vault Backup settings: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async openDashboard() {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async runBackup() {
    try {
      await this.manager.backup();
      new import_obsidian.Notice("Vault backup completed.");
    } catch (e) {
      new import_obsidian.Notice(`Backup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async autoCheck() {
    if (!this.settings.destination || !this.settings.changeThreshold) return;
    try {
      const c = await this.manager.changes();
      if (c.changed.length + c.added.length + c.removed.length >= this.settings.changeThreshold) await this.manager.backup();
    } catch (e) {
    }
  }
  async processMobileRequests() {
    const requests = this.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().startsWith("backup requests/") && !f.path.toLowerCase().includes("results/"));
    for (const file of requests) {
      const body = await this.app.vault.read(file);
      if (!/backup[- ]now/i.test(body) || /processed:\s*true/i.test(body)) continue;
      try {
        const snapshot = await this.manager.backup();
        const result = `---
processed: true
source: "[[${file.path.replace(/\.md$/, "")}]]"
snapshot: ${snapshot.id}
created: ${snapshot.created}
---

Backup completed with ${snapshot.entries.length} files.
`;
        try {
          await this.app.vault.createFolder("Backup Requests/Results");
        } catch (e) {
        }
        await this.app.vault.create(`Backup Requests/Results/${snapshot.id}.md`, result);
        new import_obsidian.Notice("Mobile backup request processed.");
      } catch (e) {
        new import_obsidian.Notice(`Mobile request failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  onunload() {
    if (this.timer) window.clearInterval(this.timer);
    if (this.changeTimer) window.clearTimeout(this.changeTimer);
    this.app.workspace.getLeavesOfType(VIEW).forEach((leaf) => leaf.detach());
  }
};
var rbDisposals = /* @__PURE__ */ new WeakMap();
var rbOnload = VaultBackupPlugin.prototype.onload;
VaultBackupPlugin.prototype.onload = async function() {
  await rbOnload.call(this);
  const disposals = [
    registerDashboardModule(this.app, { id: "vault-backup", name: "Vault Backup", command: "vault-backup:open-dashboard", icon: "archive", description: "Backup status and recent snapshots.", order: 20 }),
    registerDashboardWidget(this.app, { id: "vault-backup/overview", name: "Vault Backup", description: "Backup status and recent snapshots.", icon: "archive", defaultLayout: { w: 4, mobileW: 12, h: 2, order: 40 }, mobile: "responsive", render: (_ctx, container) => {
      container.createEl("p", { text: "Backup status and recent snapshots." });
      const button = container.createEl("button", { text: "Open Vault Backup" });
      button.onclick = () => void this.openDashboard();
    } })
  ];
  rbDisposals.set(this, () => disposals.forEach((dispose) => dispose()));
};
var rbOnunload = VaultBackupPlugin.prototype.onunload;
VaultBackupPlugin.prototype.onunload = function() {
  var _a;
  (_a = rbDisposals.get(this)) == null ? void 0 : _a();
  return rbOnunload ? rbOnunload.call(this) : void 0;
};
