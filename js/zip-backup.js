"use strict";
/* Complete, offline ZIP backups. ZIP entries use the standard STORE method (no compression). */
const ZipBackupModule = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const MAX_ZIP = 250 * 1024 * 1024;
  const MAX_ENTRIES = 1000;
  const MAX_JSON = 20 * 1024 * 1024;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    table[n] = c >>> 0;
  }
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zipEntries(entries) {
    const parts = [], central = [];
    let offset = 0;
    for (const { name, bytes } of entries) {
      const filename = encoder.encode(name);
      if (filename.length > 65535 || bytes.length > 0xffffffff) throw Error("File too large for ZIP.");
      const crc = crc32(bytes);
      const local = new Uint8Array(30 + filename.length);
      const v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x0800, true); // UTF-8 filenames
      v.setUint32(14, crc, true);
      v.setUint32(18, bytes.length, true);
      v.setUint32(22, bytes.length, true);
      v.setUint16(26, filename.length, true);
      local.set(filename, 30);
      parts.push(local, bytes);
      const cd = new Uint8Array(46 + filename.length);
      const d = new DataView(cd.buffer);
      d.setUint32(0, 0x02014b50, true);
      d.setUint16(4, 20, true);
      d.setUint16(6, 20, true);
      d.setUint16(8, 0x0800, true);
      d.setUint32(16, crc, true);
      d.setUint32(20, bytes.length, true);
      d.setUint32(24, bytes.length, true);
      d.setUint16(28, filename.length, true);
      d.setUint32(42, offset, true);
      cd.set(filename, 46);
      central.push(cd);
      offset += local.length + bytes.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, entries.length, true);
    e.setUint16(10, entries.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
  }
  function readZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const v = new DataView(buffer);
    if (bytes.length < 22) throw Error("Invalid ZIP file.");
    let end = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
      if (v.getUint32(p, true) === 0x06054b50 && p + 22 + v.getUint16(p + 20, true) === bytes.length) { end = p; break; }
    }
    if (end < 0) throw Error("Invalid ZIP directory.");
    const count = v.getUint16(end + 10, true);
    if (count > MAX_ENTRIES || v.getUint16(end + 8, true) !== count) throw Error("Unsupported ZIP entry count.");
    let pos = v.getUint32(end + 16, true);
    const centralSize = v.getUint32(end + 12, true);
    if (pos + centralSize !== end) throw Error("Invalid ZIP layout.");
    const result = new Map();
    for (let i = 0; i < count; i++) {
      if (pos + 46 > end || v.getUint32(pos, true) !== 0x02014b50) throw Error("Invalid ZIP entry.");
      const flags = v.getUint16(pos + 8, true), method = v.getUint16(pos + 10, true);
      const crc = v.getUint32(pos + 16, true), compressed = v.getUint32(pos + 20, true), size = v.getUint32(pos + 24, true);
      const nameLen = v.getUint16(pos + 28, true), extra = v.getUint16(pos + 30, true), comment = v.getUint16(pos + 32, true);
      const localOffset = v.getUint32(pos + 42, true);
      if (method !== 0 || compressed !== size || flags & 1) throw Error("Only uncompressed, non-encrypted ZIP backups are supported.");
      if (pos + 46 + nameLen + extra + comment > end) throw Error("Invalid ZIP filename.");
      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      if (result.has(name) || name.startsWith("/") || name.includes("..") || name.includes("\\")) throw Error("Unsafe or duplicate ZIP entry.");
      if (localOffset + 30 > bytes.length || v.getUint32(localOffset, true) !== 0x04034b50) throw Error("Invalid ZIP file header.");
      const start = localOffset + 30 + v.getUint16(localOffset + 26, true) + v.getUint16(localOffset + 28, true);
      if (start + size > bytes.length) throw Error("Invalid ZIP file length.");
      const content = bytes.subarray(start, start + size);
      if (crc32(content) !== crc) throw Error(`Corrupted ZIP entry: ${name}`);
      result.set(name, content);
      pos += 46 + nameLen + extra + comment;
    }
    return result;
  }
  async function allFiles() {
    const db = await Database.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readonly");
      const req = tx.objectStore("files").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function validProjects(projects) {
    if (!Array.isArray(projects)) throw Error("Invalid project list.");
    const ids = new Set();
    for (const p of projects) {
      if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.id !== "string" || !p.id.trim() || typeof p.name !== "string" || !p.name.trim() || ids.has(p.id)) throw Error("Invalid or duplicate project.");
      ids.add(p.id);
    }
    return ids;
  }
  async function exportZip() {
    const projects = await Database.getProjects();
    const ids = validProjects(projects);
    const files = (await allFiles()).filter(f => ids.has(f.projectId));
    if (files.length + 1 > MAX_ENTRIES) throw Error("Too many attachments to export.");
    const entries = [];
    const attachments = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blob = file.blob || file.file || file.data;
      if (!(blob instanceof Blob)) throw Error(`Attachment ${file.name || file.id} has no valid file data.`);
      const path = `attachments/${String(i + 1).padStart(5, "0")}.bin`;
      const metadata = { ...file };
      delete metadata.blob; delete metadata.file; delete metadata.data;
      attachments.push({ metadata, path, type: blob.type });
      entries.push({ name: path, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    const manifest = { format: "developer-project-hub-complete-backup", version: 1, exportedAt: new Date().toISOString(), projects, attachments };
    entries.unshift({ name: "manifest.json", bytes: encoder.encode(JSON.stringify(manifest)) });
    const zip = zipEntries(entries);
    if (zip.size > MAX_ZIP) throw Error("Backup exceeds 250 MB. Reduce attachments first.");
    const url = URL.createObjectURL(zip);
    const a = document.createElement("a");
    a.href = url; a.download = `developer-project-hub-complete-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { projects: projects.length, attachments: files.length };
  }
  async function importZip(file) {
    if (file.size > MAX_ZIP) throw Error("ZIP is larger than 250 MB.");
    const entries = readZip(await file.arrayBuffer());
    const raw = entries.get("manifest.json");
    if (!raw || raw.length > MAX_JSON) throw Error("Missing or oversized manifest.json.");
    const manifest = JSON.parse(decoder.decode(raw));
    if (manifest?.format !== "developer-project-hub-complete-backup" || manifest.version !== 1 || !Array.isArray(manifest.attachments)) throw Error("Not a supported complete backup.");
    const importedIds = validProjects(manifest.projects);
    const current = await Database.getProjects();
    const existing = new Set(current.map(p => p.id));
    const additions = manifest.projects.filter(p => !existing.has(p.id));
    additions.forEach(project => IntegrityModule.assertValid(project));
    const newIds = new Set(additions.map(p => p.id));
    const attachmentIds = new Set();
    const attachmentPaths = new Set();
    const restored = [];
    for (const item of manifest.attachments) {
      const m = item?.metadata;
      if (!m || typeof m.id !== "string" || !m.id.trim() || typeof m.projectId !== "string" || !importedIds.has(m.projectId) || attachmentIds.has(m.id) || typeof item.path !== "string" || !/^attachments\/[0-9]{5}\.bin$/.test(item.path) || !entries.has(item.path)) throw Error("Invalid attachment manifest.");
      if (attachmentPaths.has(item.path)) throw Error("Duplicate attachment path in ZIP manifest.");
      attachmentPaths.add(item.path);
      attachmentIds.add(m.id);
      if (newIds.has(m.projectId)) restored.push({ ...m, blob: new Blob([entries.get(item.path)], { type: typeof item.type === "string" ? item.type : "application/octet-stream" }) });
    }
    if (!additions.length) return { added: 0, skipped: manifest.projects.length, attachments: 0 };
    if (!confirm(`Restore ${additions.length} new project(s) and ${restored.length} attachment(s)?\n${existing.size} current project(s) will be preserved.\nProjects with matching IDs will be skipped, including their attachments.`)) return null;
    // Both stores in one transaction: either everything saves or nothing does.
    const db = await Database.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["projects", "files"], "readwrite");
      const ps = tx.objectStore("projects"), fs = tx.objectStore("files");
      for (const p of additions) ps.add(p);
      // Check file keys inside this transaction before writing anything.
      // An ID collision aborts the entire import; no existing attachment is overwritten.
      for (const f of restored) {
        const check = fs.get(f.id);
        check.onsuccess = () => {
          if (check.result !== undefined) {
            console.error(`Attachment ID collision: ${f.id}`);
            tx.abort();
          } else {
            fs.add(f);
          }
        };
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || Error("Import failed."));
      tx.onabort = () => reject(tx.error || Error("Import aborted. An attachment ID may already exist; no data was changed."));
    });
    return { added: additions.length, skipped: manifest.projects.length - additions.length, attachments: restored.length };
  }
  function initialize({ onImported }) {
    const host = document.querySelector(".backup-controls");
    if (!host) throw Error("Backup toolbar not found.");
    const exportBtn = document.createElement("button");
    exportBtn.className = "btn btn-secondary"; exportBtn.type = "button"; exportBtn.textContent = "Export Complete ZIP";
    const importBtn = document.createElement("button");
    importBtn.className = "btn btn-secondary"; importBtn.type = "button"; importBtn.textContent = "Import Complete ZIP";
    const picker = document.createElement("input"); picker.type = "file"; picker.accept = ".zip,application/zip"; picker.hidden = true;
    const status = document.createElement("span"); status.setAttribute("role", "status"); status.style.fontSize = "12px";
    let busy = false;
    const setBusy = b => { busy = b; exportBtn.disabled = b; importBtn.disabled = b; };
    exportBtn.addEventListener("click", async () => {
      if (busy) return;
      setBusy(true); status.textContent = "Preparing complete backup...";
      try { const result = await exportZip(); status.textContent = `ZIP downloaded: ${result.projects} projects, ${result.attachments} attachments.`; }
      catch (error) { console.error(error); status.textContent = `ZIP export failed: ${error.message}`; }
      finally { setBusy(false); }
    });
    importBtn.addEventListener("click", () => { if (!busy) picker.click(); });
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0]; picker.value = "";
      if (!file || busy) return;
      setBusy(true); status.textContent = "Validating ZIP...";
      try {
        const result = await importZip(file);
        if (result) { await onImported(); status.textContent = `Restored ${result.added} projects and ${result.attachments} attachments; skipped ${result.skipped} existing projects.`; }
        else status.textContent = "Import canceled.";
      } catch (error) { console.error(error); status.textContent = `ZIP import failed: ${error.message}`; }
      finally { setBusy(false); }
    });
    host.append(exportBtn, importBtn, picker, status);
  }
  return { initialize };
})();
