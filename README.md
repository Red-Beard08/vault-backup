# Vault Backup

Vault Backup is a **desktop-only** Obsidian plugin by Red-Beard. It creates versioned, browsable mirror snapshots of an Obsidian vault in a folder you choose on the PC. It is designed for an iCloud vault whose backup destination is outside iCloud.

## Quick start

1. Open **Settings → Community plugins → Vault Backup → Options**.
2. Choose an absolute destination outside the vault (for example `D:\Obsidian Backups\Red-Beard`).
3. Select a preset: Markdown only, Vault content, Full vault (including `.obsidian`), or Custom rules.
4. Use **Preview changes**, then **Backup now**. The dashboard and command palette provide the same actions.

Snapshots are stored as `Snapshots/<timestamp>/Vault Files/...` with a `snapshot.json` manifest containing hashes, sizes, and the selected-file list. A temporary staging folder is renamed into place only after the copy completes. The newest snapshot is always retained; count and age settings prune older snapshots.

## Workflows

- **Scheduled/change-triggered backup:** configure minutes and a changed-file threshold. A background check creates a snapshot when either schedule check sees enough changes. Set the threshold to `0` to disable automatic change-triggered backups.
- **Continuous change detection:** vault create, modify, delete, and rename events schedule a quiet change check. The 15-second settling window helps absorb iCloud placeholder/download activity before deciding whether to snapshot.
- **Preview:** review changed, added, and removed files before creating a snapshot.
- **Restore:** select a snapshot, select only the files needed, preview mentally from the list, and confirm the overwrite prompt. Restore never permanently deletes a vault file.
- **Conflict safety:** if a selected file has changed since the chosen snapshot, the current bytes are copied to `Conflicts/<timestamp>/...` before the restore replaces it. This protects edits caused by iCloud convergence or another device.
- **Duplicate review:** opens a content-first review that hides files without a partner and groups: exact byte-for-byte matches (including different folders or normal filenames), iCloud-style numbered/conflict names such as `Filename (2).md`, and Markdown notes with the same normalized name and small content differences. Hidden adapter files are included by default so copies such as `.obsidian/community-plugins (2).json` can be reviewed. Every group shows the likely file to keep, each candidate path, size, hash prefix, modified time, and a side-by-side preview. You can open a note, choose a different master, ignore a candidate, or confirm moving it to Obsidian trash. Nothing is deleted automatically.
- **Mobile request:** on iOS, create a note under `Backup Requests/` containing `backup-now`. When the desktop plugin sees it, it creates a snapshot and writes a result note under `Backup Requests/Results/`. This is an iCloud-friendly handoff; the iPhone cannot write directly to an arbitrary PC folder.
- **Rules:** custom include/exclude values are simple globs such as `Collections/**`, `*.md`, or `.obsidian/**`.

The optional Full vault preset includes `.obsidian` (plugin settings and workspace state). Do not use it as a substitute for testing a restored vault. The default Content preset excludes `.obsidian`, `.trash`, and common temporary files.

Duplicate review has independent settings for its near-content similarity threshold and whether hidden/config files are scanned. The review scan skips `.trash` and configured temporary/log exclusions, but otherwise examines normal vault files regardless of the backup preset. This makes the review useful even when the backup itself intentionally excludes `.obsidian`.

For an iCloud vault, allow files to finish downloading before a backup, avoid editing the same note simultaneously on multiple devices during restore, and use **Restore to a recovery folder** (or copy the snapshot manually) before replacing a live vault when the change is important. The plugin does not attempt to control iCloud conflict resolution; it preserves the current conflicting bytes and lets you compare them.

## Limitations and safety

This plugin runs on desktop because iOS cannot write to an arbitrary PC path. It does not encrypt snapshots, upload them, or provide regulatory backup guarantees. The destination should be on a drive with its own protection. Keep the destination outside the vault to avoid recursive backups. A backup is a point-in-time copy; files edited while it is being read are represented by the bytes read for that snapshot.

## Development

```text
npm ci
npm run typecheck
npm run build
```

Manual installation: copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/vault-backup/`, enable the plugin, and configure the destination. No Dataview, network access, or external service is required.
