"use strict";

/* Developer Project Hub — JSON backup (no attachments yet). */
const BackupModule = (() => {
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
  let busy = false;

  function downloadJSON(projects) {
    const payload = {
      format: "developer-project-hub-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `developer-project-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function validateBackup(data) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.format !== "developer-project-hub-backup" ||
      data.version !== 1 ||
      !Array.isArray(data.projects)
    ) {
      throw new Error("This is not a supported Developer Project Hub backup.");
    }
    const ids = new Set();
    for (const p of data.projects) {
      if (
        !p ||
        typeof p !== "object" ||
        Array.isArray(p) ||
        typeof p.id !== "string" ||
        !p.id.trim() ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        (p.planning !== undefined &&
          (typeof p.planning !== "object" ||
            p.planning === null ||
            Array.isArray(p.planning))) ||
        (p.requirements !== undefined && !Array.isArray(p.requirements)) ||
        (p.resources !== undefined && !Array.isArray(p.resources)) ||
        (p.tasks !== undefined && !Array.isArray(p.tasks)) ||
        ids.has(p.id)
      ) {
        throw new Error(
          "The backup contains invalid or duplicate project records.",
        );
      }
      ids.add(p.id);
    }
    return data.projects;
  }

  function initialize({ getProjects, saveImportedProjects, onImported }) {
    const host =
      document.querySelector(".topbar") ||
      document.querySelector(".main-wrapper");
    if (!host) throw new Error("Backup controls container not found.");

    const wrapper = document.createElement("div");
    wrapper.className = "backup-controls";
    wrapper.style.cssText =
      "display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px;";

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "btn btn-secondary";
    exportButton.textContent = "Export JSON";

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "btn btn-secondary";
    importButton.textContent = "Import JSON";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.hidden = true;
    fileInput.setAttribute("aria-label", "Choose a JSON backup file");

    const status = document.createElement("span");
    status.setAttribute("role", "status");
    status.style.cssText = "font-size:12px;max-width:260px;";

    exportButton.addEventListener("click", () => {
      if (busy) return;
      try {
        downloadJSON(getProjects());
        status.textContent = "JSON backup downloaded.";
      } catch (error) {
        console.error("Export failed:", error);
        status.textContent = "Could not export backup.";
      }
    });

    importButton.addEventListener("click", () => {
      if (!busy) fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file || busy) return;
      busy = true;
      importButton.disabled = true;
      exportButton.disabled = true;
      try {
        if (file.size > MAX_IMPORT_BYTES) {
          throw new Error(
            "File is too large (maximum 10 MB for JSON imports).",
          );
        }
        const data = JSON.parse(await file.text());
        const imported = validateBackup(data);
        const currentIds = new Set(getProjects().map((p) => p.id));
        const additions = imported.filter((p) => !currentIds.has(p.id));
        const skipped = imported.length - additions.length;
        if (!additions.length) {
          status.textContent = `No new projects. ${skipped} already exist.`;
          return;
        }
        const approved = confirm(
          `Import ${additions.length} new project(s)?\n` +
            `${skipped} existing project(s) will be skipped, not overwritten.\n` +
            "Existing projects will remain unchanged.",
        );
        if (!approved) {
          status.textContent = "Import canceled.";
          return;
        }
        additions.forEach(project => IntegrityModule.assertValid(project));
        await saveImportedProjects(additions);
        await onImported();
        status.textContent = `Imported ${additions.length} project(s); skipped ${skipped}.`;
      } catch (error) {
        console.error("Import failed:", error);
        status.textContent = `Import failed: ${error.message}`;
      } finally {
        busy = false;
        importButton.disabled = false;
        exportButton.disabled = false;
      }
    });

    wrapper.append(exportButton, importButton, fileInput, status);
    host.append(wrapper);
  }

  return { initialize };
})();
