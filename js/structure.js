"use strict";

/* Application Structure: screens, components, navigation and attachments. */
const StructureModule = (() => {
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const ALLOWED_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]);
  let project,
    saveProject,
    host,
    busy = false,
    generation = 0;
  const urls = new Set();

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }
  function button(text, callback, secondary = false) {
    const node = element(
      "button",
      secondary ? "btn btn-secondary" : "btn btn-primary",
      text,
    );
    node.type = "button";
    node.addEventListener("click", callback);
    return node;
  }
  function paragraph(text, className = "question-help") {
    return element("p", className, text);
  }
  function field(label, hint, value = "", multiline = false, required = false) {
    const wrap = element("div", "form-group");
    const id = `structure-${crypto.randomUUID()}`;
    const title = element("label", "", label);
    title.htmlFor = id;
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    if (multiline) input.rows = 3;
    input.id = id;
    input.className = "form-input";
    input.value = value || "";
    input.required = required;
    wrap.append(title, paragraph(hint), input);
    return { wrap, input };
  }
  function cleanup() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  function getScreens() {
    if (!Array.isArray(project.screens)) project.screens = [];
    return project.screens;
  }
  async function commit(nextScreens) {
    if (busy) return false;
    busy = true;
    const previous = project.screens;
    const previousDate = project.updatedAt;
    project.screens = nextScreens;
    project.updatedAt = new Date().toISOString();
    try {
      if (!(await saveProject(project))) {
        project.screens = previous;
        project.updatedAt = previousDate;
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      project.screens = previous;
      project.updatedAt = previousDate;
      alert("Could not save the screen.");
      return false;
    } finally {
      busy = false;
    }
  }
  function store(mode, record) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await Database.open();
        if (!db.objectStoreNames.contains("files"))
          throw new Error("Files store not found.");
        const tx = db.transaction(
          "files",
          mode === "get" ? "readonly" : "readwrite",
        );
        const objectStore = tx.objectStore("files");
        const req =
          mode === "get"
            ? objectStore.getAll()
            : mode === "put"
              ? objectStore.put(record)
              : objectStore.delete(record);
        let result;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }
  async function getFiles(screenId) {
    const all = await store("get");
    return all.filter(
      (file) => file.projectId === project.id && file.screenId === screenId,
    );
  }
  async function showList() {
    const token = ++generation;
    cleanup();
    host.replaceChildren();
    host.append(
      element("h3", "", "Application Structure"),
      paragraph(
        "A screen is a complete view (Dashboard). A section is an area within it (Recent Transactions). A reusable component is an element used in multiple screens (Balance Card).",
      ),
      paragraph(
        "Plan each screen, its components and navigation. Attach your sketches or Figma exports to keep everything together.",
      ),
    );
    host.append(button("+ Add Screen", () => showEditor()));
    const screens = getScreens();
    if (!screens.length)
      host.append(
        paragraph(
          "No screens yet. Start with the main screen of your application.",
        ),
      );
    for (const screen of screens) {
      if (token !== generation) return;
      const card = element("article", "structure-card");
      card.append(
        element("h4", "", screen.name),
        paragraph(screen.description || "No description yet."),
      );
      if (screen.components)
        card.append(paragraph(`Components: ${screen.components}`));
      if (screen.navigation)
        card.append(paragraph(`Navigation: ${screen.navigation}`));
      if (screen.wireframeUrl) {
        try {
          const url = new URL(screen.wireframeUrl);
          if (["https:", "http:"].includes(url.protocol)) {
            const link = element("a", "", "Open reference ↗");
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            card.append(link);
          }
        } catch (_) {
          /* Ignore malformed legacy links. */
        }
      }
      const actions = element("div", "structure-actions");
      actions.append(
        button("Edit", () => showEditor(screen), true),
        button(
          "Delete",
          async () => {
            if (
              busy ||
              !confirm(
                `Delete screen "${screen.name}"? Its attachments will also be deleted.`,
              )
            )
              return;
            if (busy) return;
            busy = true;
            try {
              const result = await Database.deleteScreenWithAttachments(project.id, screen.id);
              project.screens = result.project.screens;
              project.updatedAt = result.project.updatedAt;
            } catch (error) {
              console.error("Screen and attachment deletion failed:", error);
              alert("Could not delete the screen. Your screen and attachments were preserved.");
              return;
            } finally {
              busy = false;
            }
            showList();
          },
          true,
        ),
      );
      card.append(actions);
      const filesHeading = element("h5", "", "Attachments");
      card.append(filesHeading);
      const gallery = element("div", "structure-gallery");
      card.append(gallery);
      host.append(card);
      try {
        const files = await getFiles(screen.id);
        if (token !== generation) return;
        for (const file of files) {
          const tile = element("div", "structure-file");
          if (file.blob?.type?.startsWith("image/")) {
            const url = URL.createObjectURL(file.blob);
            urls.add(url);
            const image = document.createElement("img");
            image.src = url;
            image.alt = file.name;
            tile.append(image);
          }
          tile.append(paragraph(file.name, "structure-filename"));
          const download = button(
            "Open / Download",
            () => {
              const url = URL.createObjectURL(file.blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = file.name;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
            },
            true,
          );
          const remove = button(
            "Remove",
            async () => {
              if (!confirm(`Remove attachment "${file.name}"?`)) return;
              try {
                await store("delete", file.id);
                await showList();
              } catch (error) {
                console.error(error);
                alert("Could not remove attachment.");
              }
            },
            true,
          );
          tile.append(download, remove);
          gallery.append(tile);
        }
      } catch (error) {
        console.error(error);
        gallery.append(paragraph("Could not load attachments."));
      }
      const upload = document.createElement("input");
      upload.type = "file";
      upload.accept = ".png,.jpg,.jpeg,.webp,.gif,.pdf";
      upload.multiple = true;
      upload.setAttribute("aria-label", `Attach files to ${screen.name}`);
      upload.addEventListener("change", async () => {
        const selected = [...upload.files];
        upload.disabled = true;
        try {
          for (const file of selected) {
            if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
              alert(
                `Skipped ${file.name}. Only PNG, JPG, WEBP, GIF or PDF up to 15 MB are supported.`,
              );
              continue;
            }
            await store("put", {
              id: crypto.randomUUID(),
              projectId: project.id,
              screenId: screen.id,
              name: file.name,
              blob: file,
              createdAt: new Date().toISOString(),
            });
          }
          await showList();
        } catch (error) {
          console.error(error);
          alert("Could not save attachment. Check available browser storage.");
          upload.disabled = false;
        }
      });
      card.append(upload);
    }
  }
  function showEditor(existing = null) {
    ++generation;
    cleanup();
    host.replaceChildren();
    host.append(element("h3", "", existing ? "Edit Screen" : "Add Screen"));
    const form = document.createElement("form");
    form.className = "planning-form";
    const name = field(
      "Screen / View Name",
      "Example: Dashboard, Transactions, Settings.",
      existing?.name,
      false,
      true,
    );
    const description = field(
      "Purpose",
      "What should users be able to accomplish on this screen?",
      existing?.description,
      true,
    );
    const components = field(
      "Sections & Components",
      "List elements such as forms, cards, tables and reusable buttons.",
      existing?.components,
      true,
    );
    const navigation = field(
      "Navigation",
      "How do users reach this screen and where can they go next?",
      existing?.navigation,
      true,
    );
    const wireframe = field(
      "Design Reference URL",
      "Optional link to a Figma design, GitHub file or external wireframe.",
      existing?.wireframeUrl,
    );
    const actions = element("div", "structure-actions");
    actions.append(button("Cancel", showList, true));
    const save = element("button", "btn btn-primary", "Save Screen");
    save.type = "submit";
    actions.append(save);
    form.append(
      name.wrap,
      description.wrap,
      components.wrap,
      navigation.wrap,
      wireframe.wrap,
      actions,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      const link = wireframe.input.value.trim();
      if (link) {
        try {
          if (!["http:", "https:"].includes(new URL(link).protocol))
            throw new Error();
        } catch (_) {
          alert("Please enter a valid http:// or https:// reference link.");
          return;
        }
      }
      const screen = {
        id: existing?.id || crypto.randomUUID(),
        name: name.input.value.trim(),
        description: description.input.value.trim(),
        components: components.input.value.trim(),
        navigation: navigation.input.value.trim(),
        wireframeUrl: link,
      };
      if (!screen.name) return;
      save.disabled = true;
      const next = existing
        ? getScreens().map((item) => (item.id === existing.id ? screen : item))
        : [...getScreens(), screen];
      if (await commit(next)) await showList();
      else save.disabled = false;
    });
    host.append(form);
    name.input.focus();
  }
  function initialize(currentProject, saveCallback, target) {
    project = currentProject;
    saveProject = saveCallback;
    host = target;
    showList();
  }
  return { initialize, cleanup };
})();
