"use strict";

/* Data Modeling: project entities, attributes and relationships. */
const ModelingModule = (() => {
  let project, saveProject, host, busy = false;
  const TYPES = ["string", "text", "integer", "decimal", "boolean", "date", "datetime", "uuid", "json"];
  const RELATIONS = ["one-to-one", "one-to-many", "many-to-many"];
  const el = (tag, cls = "", content = "") => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    node.textContent = content;
    return node;
  };
  const btn = (label, action, secondary = false) => {
    const node = el("button", secondary ? "btn btn-secondary" : "btn btn-primary", label);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };
  const inputField = (label, value = "", required = false, multiline = false) => {
    const wrapper = el("div", "form-group");
    const labelNode = el("label", "", label);
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    else input.rows = 3;
    input.className = "form-input";
    input.value = value;
    input.required = required;
    input.id = `model-${crypto.randomUUID()}`;
    labelNode.htmlFor = input.id;
    wrapper.append(labelNode, input);
    return { wrapper, input };
  };
  const selectField = (label, values, selected) => {
    const field = inputField(label);
    const select = el("select", "form-input");
    select.id = field.input.id;
    for (const value of values) {
      const option = el("option", "", value);
      option.value = value;
      select.append(option);
    }
    select.value = selected || values[0];
    field.input.replaceWith(select);
    return { wrapper: field.wrapper, input: select };
  };
  const data = () => {
    if (!project.dataModel || typeof project.dataModel !== "object" || Array.isArray(project.dataModel))
      project.dataModel = { entities: [], relationships: [] };
    if (!Array.isArray(project.dataModel.entities)) project.dataModel.entities = [];
    if (!Array.isArray(project.dataModel.relationships)) project.dataModel.relationships = [];
    return project.dataModel;
  };
  async function commit(next) {
    if (busy) return false;
    busy = true;
    const previous = project.dataModel;
    const oldDate = project.updatedAt;
    project.dataModel = next;
    project.updatedAt = new Date().toISOString();
    try {
      if (!(await saveProject(project))) throw new Error("Save failed");
      return true;
    } catch (error) {
      project.dataModel = previous;
      project.updatedAt = oldDate;
      console.error("Data Modeling save error:", error);
      alert("Could not save your data model. No changes were applied.");
      return false;
    } finally { busy = false; }
  }
  const heading = (title, help) => {
    host.append(el("h3", "", title), el("p", "question-help", help));
  };
  const actions = (form, saveText, cancel) => {
    const row = el("div", "model-actions");
    const submit = el("button", "btn btn-primary", saveText);
    submit.type = "submit";
    row.append(btn("Cancel", cancel, true), submit);
    form.append(row);
    return submit;
  };
  function renderDiagram() {
    host.replaceChildren();
    heading("ER Diagram", "Automatically generated from your saved entities and relationships. Edit your model to update this diagram.");
    const toolbar = el("div", "model-actions");
    toolbar.append(btn("← Back to Editor", render, true));
    const model = data();
    if (!model.entities.length) {
      host.append(toolbar, el("p", "model-empty", "Add an entity in the editor to generate a diagram."));
      return;
    }
    const ns = "http://www.w3.org/2000/svg";
    const svgEl = (tag, attributes = {}, content) => {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      if (content !== undefined) node.textContent = content;
      return node;
    };
    const width = 260, gapX = 100, gapY = 85, columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(model.entities.length))));
    const positions = new Map();
    const cards = model.entities.map((entity, index) => {
      const x = 30 + (index % columns) * (width + gapX);
      const row = Math.floor(index / columns);
      const rowStart = row * columns;
      const rowItems = model.entities.slice(rowStart, rowStart + columns);
      const rowHeight = Math.max(...rowItems.map(e => 45 + Math.max(1, (e.attributes || []).length) * 24));
      let y = 35;
      for (let r = 0; r < row; r++) {
        const items = model.entities.slice(r * columns, (r + 1) * columns);
        y += Math.max(...items.map(e => 45 + Math.max(1, (e.attributes || []).length) * 24)) + gapY;
      }
      const height = 45 + Math.max(1, (entity.attributes || []).length) * 24;
      positions.set(entity.id, { x, y, width, height });
      return { entity, x, y, height };
    });
    const canvasWidth = 60 + columns * width + (columns - 1) * gapX;
    const canvasHeight = Math.max(...cards.map(c => c.y + c.height)) + 40;
    const svg = svgEl("svg", { xmlns: ns, viewBox: `0 0 ${canvasWidth} ${canvasHeight}`, width: canvasWidth, height: canvasHeight, role: "img", "aria-label": "Entity relationship diagram" });
    svg.append(svgEl("rect", { width: canvasWidth, height: canvasHeight, fill: "#ffffff" }));
    const edgeLayer = svgEl("g", { stroke: "#64748b", "stroke-width": "2", fill: "none" });
    for (const relationship of model.relationships) {
      const a = positions.get(relationship.from), b = positions.get(relationship.to);
      if (!a || !b) continue;
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
      const bx = b.x + b.width / 2, by = b.y + b.height / 2;
      const horizontal = Math.abs(bx - ax) > Math.abs(by - ay);
      const x1 = horizontal ? (bx > ax ? a.x + a.width : a.x) : ax;
      const y1 = horizontal ? ay : (by > ay ? a.y + a.height : a.y);
      const x2 = horizontal ? (bx > ax ? b.x : b.x + b.width) : bx;
      const y2 = horizontal ? by : (by > ay ? b.y : b.y + b.height);
      edgeLayer.append(svgEl("path", { d: `M ${x1} ${y1} L ${x2} ${y2}` }));
      const labelA = relationship.type === "many-to-many" ? "N" : "1";
      const labelB = relationship.type === "one-to-one" ? "1" : "N";
      for (const [x, y, label] of [[x1, y1, labelA], [x2, y2, labelB]]) {
        edgeLayer.append(svgEl("rect", { x: x - 11, y: y - 15, width: 22, height: 19, fill: "#fff", stroke: "none" }));
        edgeLayer.append(svgEl("text", { x, y, fill: "#334155", stroke: "none", "font-size": "13", "font-weight": "bold", "text-anchor": "middle" }, label));
      }
    }
    svg.append(edgeLayer);
    for (const { entity, x, y, height } of cards) {
      svg.append(svgEl("rect", { x, y, width, height, rx: 8, fill: "#f8fafc", stroke: "#94a3b8" }));
      svg.append(svgEl("path", { d: `M ${x} ${y+34} H ${x+width}`, stroke: "#94a3b8" }));
      svg.append(svgEl("text", { x: x+12, y: y+23, fill: "#0f172a", "font-size": "16", "font-weight": "bold" }, entity.name));
      const attributes = entity.attributes?.length ? entity.attributes : [{ name: "(no attributes)", type: "" }];
      attributes.forEach((attribute, i) => {
        const name = `${attribute.primaryKey ? "PK " : ""}${attribute.name}`;
        svg.append(svgEl("text", { x: x+12, y: y+57+i*24, fill: "#334155", "font-size": "13" }, name.length > 23 ? name.slice(0,22)+"…" : name));
        svg.append(svgEl("text", { x: x+width-12, y: y+57+i*24, fill: "#64748b", "font-size": "12", "text-anchor": "end" }, attribute.type || ""));
      });
    }
    const viewport = el("div", "erd-viewport");
    viewport.append(svg);
    toolbar.append(btn("Download SVG", () => {
      const markup = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(project.name || "project").replace(/[^a-z0-9_-]/gi, "-")}-erd.svg`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    host.append(toolbar, viewport, el("p", "question-help", "Relationship labels: 1 = one, N = many. The diagram is conceptual; it does not automatically create foreign-key columns."));
  }
  function render() {
    host.replaceChildren();
    heading("Data Modeling", "Design the information your app needs before choosing a database. An entity represents a type of information (Transaction); an attribute is a property (amount); a relationship connects entities (Account has many Transactions).");
    host.append(btn("View ER Diagram →", renderDiagram, true));
    const model = data();
    const entityHeader = el("div", "model-heading");
    entityHeader.append(el("h4", "", `Entities (${model.entities.length})`), btn("+ Add Entity", () => entityEditor()));
    host.append(entityHeader);
    if (!model.entities.length) host.append(el("p", "model-empty", "No entities yet. Example: Account, Transaction, Category."));
    for (const entity of model.entities) {
      const card = el("article", "model-card");
      card.append(el("h4", "", entity.name), el("p", "question-help", entity.description || "No description."));
      const table = el("div", "model-attributes");
      for (const attribute of entity.attributes || []) {
        const line = el("div", "model-attribute");
        const flags = [attribute.primaryKey && "PK", attribute.required && "required", attribute.unique && "unique"].filter(Boolean).join(" · ");
        line.append(el("strong", "", attribute.name), el("span", "", attribute.type), el("small", "", flags || "optional"));
        table.append(line);
      }
      card.append(table);
      const buttons = el("div", "model-actions");
      buttons.append(btn("Edit", () => entityEditor(entity), true), btn("Delete", async () => {
        if (!confirm(`Delete entity "${entity.name}" and its relationships?`)) return;
        const next = { entities: model.entities.filter(e => e.id !== entity.id), relationships: model.relationships.filter(r => r.from !== entity.id && r.to !== entity.id) };
        if (await commit(next)) render();
      }, true));
      card.append(buttons);
      host.append(card);
    }
    const relationshipHeader = el("div", "model-heading");
    relationshipHeader.append(el("h4", "", `Relationships (${model.relationships.length})`), btn("+ Add Relationship", () => relationshipEditor()));
    host.append(relationshipHeader);
    if (model.entities.length < 2) host.append(el("p", "question-help", "Create at least two entities to connect them."));
    else if (!model.relationships.length) host.append(el("p", "model-empty", "No relationships yet. Example: Account (1) → Transactions (many)."));
    for (const relationship of model.relationships) {
      const from = model.entities.find(e => e.id === relationship.from)?.name || "Unknown";
      const to = model.entities.find(e => e.id === relationship.to)?.name || "Unknown";
      const card = el("article", "model-card");
      card.append(el("strong", "", `${from}  →  ${to}`), el("p", "question-help", `${relationship.type} · ${relationship.description || "No description"}`));
      const buttons = el("div", "model-actions");
      buttons.append(btn("Edit", () => relationshipEditor(relationship), true), btn("Delete", async () => {
        if (!confirm("Delete this relationship?")) return;
        if (await commit({ entities: model.entities, relationships: model.relationships.filter(r => r.id !== relationship.id) })) render();
      }, true));
      card.append(buttons);
      host.append(card);
    }
    host.append(el("p", "question-help", "Tip: This is a conceptual data model, not a database migration. Data is saved with your project in IndexedDB."));
  }
  function entityEditor(existing = null) {
    host.replaceChildren();
    heading(existing ? "Edit Entity" : "New Entity", "Example: Transaction stores one income or expense. Add attributes such as id (uuid), amount (decimal), date (date), and description (string).");
    const form = el("form", "model-form");
    const name = inputField("Entity name", existing?.name || "", true);
    const description = inputField("Description", existing?.description || "", false, true);
    form.append(name.wrapper, description.wrapper, el("h4", "", "Attributes"));
    const rows = el("div", "model-rows");
    form.append(rows);
    function addAttribute(value = {}) {
      const row = el("div", "model-attribute-editor");
      const fieldName = inputField("Attribute name", value.name || "", true);
      const fieldType = selectField("Data type", TYPES, value.type || "string");
      const flags = el("div", "model-flags");
      function flag(label, checked) {
        const wrap = el("label", "model-flag");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!checked;
        wrap.append(checkbox, document.createTextNode(` ${label}`));
        flags.append(wrap);
        return checkbox;
      }
      const primaryKey = flag("Primary key", value.primaryKey);
      const required = flag("Required", value.required);
      const unique = flag("Unique", value.unique);
      row.append(fieldName.wrapper, fieldType.wrapper, flags, btn("Remove", () => row.remove(), true));
      rows.append(row);
      return () => ({ name: fieldName.input.value.trim(), type: fieldType.input.value, primaryKey: primaryKey.checked, required: required.checked, unique: unique.checked });
    }
    const readers = [];
    function appendAttribute(value) { const read = addAttribute(value); readers.push(read); }
    // Read active rows from their DOM inputs to avoid reintroducing removed attributes.
    function readAttributes() {
      return [...rows.children].map(row => {
        const inputs = row.querySelectorAll("input[type=text], select, input[type=checkbox]");
        return { name: inputs[0].value.trim(), type: inputs[1].value, primaryKey: inputs[2].checked, required: inputs[3].checked, unique: inputs[4].checked };
      });
    }
    (existing?.attributes?.length ? existing.attributes : [{ name: "id", type: "uuid", primaryKey: true, required: true, unique: true }]).forEach(appendAttribute);
    form.append(btn("+ Add Attribute", () => appendAttribute({})));
    const submit = actions(form, "Save Entity", render);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy) return;
      const model = data();
      const entityName = name.input.value.trim();
      const attributes = readAttributes();
      if (!entityName || !attributes.length || attributes.some(a => !a.name)) { alert("Add a name and at least one named attribute."); return; }
      if (model.entities.some(e => e.id !== existing?.id && e.name.toLowerCase() === entityName.toLowerCase())) { alert("An entity with this name already exists."); return; }
      const names = attributes.map(a => a.name.toLowerCase());
      if (new Set(names).size !== names.length) { alert("Attribute names must be unique within an entity."); return; }
      if (attributes.filter(a => a.primaryKey).length > 1) { alert("This editor supports one primary key per entity."); return; }
      const entity = { id: existing?.id || crypto.randomUUID(), name: entityName, description: description.input.value.trim(), attributes };
      const next = { entities: existing ? model.entities.map(e => e.id === existing.id ? entity : e) : [...model.entities, entity], relationships: model.relationships };
      submit.disabled = true;
      if (await commit(next)) render(); else submit.disabled = false;
    });
    host.append(form);
    name.input.focus();
  }
  function relationshipEditor(existing = null) {
    const model = data();
    if (model.entities.length < 2) { alert("Create at least two entities first."); return; }
    host.replaceChildren();
    heading(existing ? "Edit Relationship" : "New Relationship", "Example: Account → Transaction (one-to-many): one account can contain many transactions.");
    const form = el("form", "model-form");
    function entitySelect(label, value) {
      const wrapper = el("div", "form-group");
      const title = el("label", "", label);
      const select = el("select", "form-input");
      select.id = `model-${crypto.randomUUID()}`;
      title.htmlFor = select.id;
      for (const entity of model.entities) {
        const option = el("option", "", entity.name);
        option.value = entity.id;
        select.append(option);
      }
      select.value = value || model.entities[0].id;
      wrapper.append(title, select);
      return { wrapper, input: select };
    }
    const from = entitySelect("From entity", existing?.from);
    const to = entitySelect("To entity", existing?.to || model.entities[1].id);
    const type = selectField("Relationship type", RELATIONS, existing?.type || "one-to-many");
    const description = inputField("Description (optional)", existing?.description || "", false, true);
    form.append(from.wrapper, to.wrapper, type.wrapper, description.wrapper);
    const submit = actions(form, "Save Relationship", render);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy) return;
      if (from.input.value === to.input.value) { alert("Select two different entities for this relationship."); return; }
      const relationship = { id: existing?.id || crypto.randomUUID(), from: from.input.value, to: to.input.value, type: type.input.value, description: description.input.value.trim() };
      const next = { entities: model.entities, relationships: existing ? model.relationships.map(r => r.id === existing.id ? relationship : r) : [...model.relationships, relationship] };
      submit.disabled = true;
      if (await commit(next)) render(); else submit.disabled = false;
    });
    host.append(form);
  }
  function initialize(currentProject, saveCallback, target) {
    project = currentProject;
    saveProject = saveCallback;
    host = target;
    render();
  }
  return { initialize };
})();
