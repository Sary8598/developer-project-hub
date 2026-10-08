"use strict";
/* UI/UX planning: project metadata + assets stored separately in IndexedDB. */
const UIUXModule = (() => {
  const MAX_SIZE = 15 * 1024 * 1024;
  const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/pdf"]);
  const make = (tag, className = "", content = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = content;
    return node;
  };
  const field = (title, value = "", hint = "", rows = 0) => {
    const group = make("div", "form-group");
    const label = make("label", "", title);
    const control = make(rows ? "textarea" : "input", "form-input");
    if (rows) control.rows = rows;
    else control.type = "text";
    control.value = value;
    control.id = `uiux-${crypto.randomUUID()}`;
    label.htmlFor = control.id;
    group.append(label);
    if (hint) group.append(make("p", "question-help", hint));
    group.append(control);
    return { group, control };
  };
  async function fileOperation(action, record) {
    const db = await Database.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", action === "list" ? "readonly" : "readwrite");
      const store = tx.objectStore("files");
      const request = action === "list" ? store.getAll() : action === "add" ? store.put(record) : store.delete(record);
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  function initialize(project, saveProject, target) {
    const initial = project.uiux && typeof project.uiux === "object" ? project.uiux : {};
    const root = make("section", "uiux-module");
    target.append(root);
    root.append(make("h3", "", "UI/UX Resources"), make("p", "question-help", "Define the visual language and user experience of your application. Screens and navigation belong in Application Structure; here you document consistent design rules and reusable visual assets."));
    const form = make("form", "planning-form uiux-form");
    const specs = [
      ["Color palette", "colors", "Example: Primary #2563EB, background #F8FAFC, error #DC2626. Include contrast considerations.", 3],
      ["Typography", "typography", "Example: Inter; headings 24–32px, body 16px, line height 1.5.", 3],
      ["Spacing, shapes & effects", "spacing", "Example: 8px spacing scale, 12px border radius, subtle shadows.", 3],
      ["Reusable UI components", "components", "Example: Primary Button, Balance Card, Transaction Form, Alert, Modal.", 4],
      ["Accessibility & UX guidelines", "accessibility", "Example: keyboard navigation, visible focus, labels, clear error messages, WCAG contrast.", 4],
      ["Responsive behavior", "responsive", "Example: mobile-first, cards stack on narrow screens, collapsible sidebar.", 3],
      ["Feedback & empty states", "feedback", "Example: loading indicators, success notices, empty transactions message.", 3],
      ["Design references (URLs)", "references", "One Figma, design system, or inspiration URL per line.", 3],
      ["Design rationale", "rationale", "Explain why these decisions support your users and project goals.", 4],
    ];
    const controls = {};
    for (const [label, key, hint, rows] of specs) {
      const item = field(label, initial[key] || "", hint, rows);
      controls[key] = item.control;
      form.append(item.group);
    }
    const save = make("button", "btn btn-primary", "Save UI/UX Plan");
    save.type = "submit";
    const status = make("p", "question-help");
    form.append(save, status);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      const previous = project.uiux;
      const previousDate = project.updatedAt;
      project.uiux = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value.trim()]));
      project.updatedAt = new Date().toISOString();
      try {
        if (!(await saveProject(project))) throw new Error("Database save failed");
        status.textContent = "UI/UX plan saved successfully.";
      } catch (error) {
        console.error(error);
        project.uiux = previous;
        project.updatedAt = previousDate;
        status.textContent = "Could not save. Please try again.";
      } finally { save.disabled = false; }
    });
    root.append(form);
    const library = make("section", "uiux-library");
    library.append(make("h4", "", "Assets Library"), make("p", "question-help", "Attach logos, icons, visual references and PDF style guides (up to 15 MB each). These files are stored locally and are not yet included in JSON backups."));
    const picker = make("input", "form-input");
    picker.type = "file";
    picker.multiple = true;
    picker.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf";
    const fileStatus = make("p", "question-help");
    const listing = make("div", "uiux-assets");
    library.append(picker, fileStatus, listing);
    root.append(library);
    const urls = [];
    async function renderFiles() {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.length = 0;
      listing.replaceChildren();
      try {
        const files = (await fileOperation("list")).filter((f) => f.projectId === project.id && f.uiuxAsset === true);
        if (!files.length) listing.append(make("p", "question-help", "No visual assets added yet."));
        for (const file of files) {
          const card = make("article", "uiux-asset");
          const name = make("p", "uiux-asset-name", file.name || "Untitled file");
          card.append(name);
          const blob = file.blob || file.file || file.data;
          if (blob instanceof Blob) {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            if (file.type?.startsWith("image/") && file.type !== "image/svg+xml") {
              const img = make("img"); img.src = url; img.alt = file.name || "Visual asset"; card.append(img);
            }
            const download = make("a", "btn btn-secondary", "Open / Download");
            download.href = url; download.target = "_blank"; download.rel = "noopener noreferrer";
            download.download = file.name || "asset"; card.append(download);
          }
          const remove = make("button", "btn btn-secondary", "Delete");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            if (!confirm(`Delete ${file.name}?`)) return;
            try { await fileOperation("delete", file.id); await renderFiles(); }
            catch (error) { console.error(error); alert("Could not delete this asset."); }
          });
          card.append(remove);
          listing.append(card);
        }
      } catch (error) { console.error(error); fileStatus.textContent = "Could not load visual assets."; }
    }
    picker.addEventListener("change", async () => {
      picker.disabled = true;
      fileStatus.textContent = "Saving files...";
      try {
        for (const file of picker.files) {
          if (!TYPES.has(file.type) || file.size > MAX_SIZE) {
            alert(`${file.name}: unsupported file or exceeds 15 MB.`); continue;
          }
          await fileOperation("add", { id: crypto.randomUUID(), projectId: project.id, uiuxAsset: true, name: file.name, type: file.type, blob: file, createdAt: new Date().toISOString() });
        }
        fileStatus.textContent = "Files saved.";
        await renderFiles();
      } catch (error) { console.error(error); fileStatus.textContent = "Could not save files."; }
      finally { picker.value = ""; picker.disabled = false; }
    });
    renderFiles();
  }
  return { initialize };
})();
