"use strict";

/* Functions & Logic: planning only, never executes user-written pseudocode. */
const LogicModule = (() => {
  const el = (tag, className = "", content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const options = (items, selected = "") => {
    const select = el("select", "form-input");
    items.forEach(([value, label]) => {
      const option = el("option", "", label);
      option.value = value;
      select.append(option);
    });
    select.value = selected;
    return select;
  };
  const field = (label, control, help = "") => {
    const group = el("div", "form-group");
    const caption = el("label", "", label);
    const id = `logic-${crypto.randomUUID()}`;
    control.id = id;
    caption.htmlFor = id;
    group.append(caption);
    if (help) group.append(el("p", "question-help", help));
    group.append(control);
    return group;
  };
  const input = (value = "", placeholder = "") => {
    const node = el("input", "form-input");
    node.type = "text";
    node.value = value;
    node.placeholder = placeholder;
    return node;
  };
  const area = (value = "", placeholder = "") => {
    const node = el("textarea", "form-input");
    node.rows = 4;
    node.value = value;
    node.placeholder = placeholder;
    return node;
  };
  const labelForRequirement = (req, index) =>
    `${req.type === "functional" ? "FR" : "NFR"}-${String(index + 1).padStart(3, "0")} · ${req.title}`;

  function initialize(project, saveProject, target) {
    if (!Array.isArray(project.logicFunctions)) project.logicFunctions = [];
    const root = el("section", "logic-module");
    target.append(root);
    let editingId = null;
    let filter = "all";
    let busy = false;

    const requirements = () => Array.isArray(project.requirements) ? project.requirements : [];

    async function persist(next, successMessage) {
      if (busy) return false;
      busy = true;
      const previous = project.logicFunctions;
      const previousDate = project.updatedAt;
      project.logicFunctions = next;
      project.updatedAt = new Date().toISOString();
      let saved = false;
      try { saved = await saveProject(project); }
      catch (error) { console.error("Logic save failed:", error); }
      if (!saved) {
        project.logicFunctions = previous;
        project.updatedAt = previousDate;
        alert("Could not save your changes. Your previous data is still available.");
      }
      busy = false;
      if (saved) {
        editingId = null;
        render(successMessage);
      } else render();
      return saved;
    }

    function showEditor(existing = null) {
      editingId = existing?.id || null;
      render();
      const form = el("form", "planning-form logic-form");
      const heading = el("h4", "", existing ? "Edit Function" : "Add Function");
      const name = input(existing?.name || "", "Example: addTransaction");
      name.required = true;
      name.maxLength = 120;
      const purpose = area(existing?.purpose || "", "What should this function accomplish?");
      purpose.required = true;
      const params = input(existing?.parameters || "", "Example: amount, categoryId, date");
      const returns = input(existing?.returns || "", "Example: created transaction / validation error");
      const trigger = area(existing?.trigger || "", "Example: The user submits the Add Transaction form.");
      const flow = area(existing?.flow || "", "1. Read the form\n2. Validate values\n3. Save the transaction\n4. Update the balance");
      const validation = area(existing?.validations || "", "Example: amount must be greater than zero; date must be valid.");
      const pseudocode = area(existing?.pseudocode || "", "IF amount <= 0 THEN show error\nELSE save transaction and refresh dashboard");
      const status = options([
        ["not-started", "Not started"], ["in-progress", "In progress"], ["completed", "Completed"]
      ], existing?.status || "not-started");
      const related = el("select", "form-input");
      related.multiple = true;
      related.size = Math.min(6, Math.max(3, requirements().length));
      const chosen = new Set(existing?.requirementIds || []);
      requirements().forEach((req, i) => {
        const option = el("option", "", labelForRequirement(req, i));
        option.value = req.id;
        option.selected = chosen.has(req.id);
        related.append(option);
      });
      form.append(
        heading,
        field("Function name *", name, "Use a descriptive name, preferably a verb + noun (for example, calculateBalance)."),
        field("Purpose *", purpose, "Explain the result, not the implementation."),
        field("Parameters / inputs", params, "What information does this function need?"),
        field("Return value / output", returns, "What does it return or change?"),
        field("Event or trigger", trigger, "What causes this function to run? A click, submit, page load or another function?"),
        field("Logic flow", flow, "Write the steps in order before coding."),
        field("Validations and error handling", validation, "What invalid inputs and failure cases should be handled?"),
        field("Pseudocode", pseudocode, "Describe the algorithm in plain language; this text is never executed."),
        field("Development status", status),
      );
      if (requirements().length) {
        form.append(field("Related requirements (Ctrl/Cmd + click for multiple)", related, "Link this function to requirements from step 2."));
      } else {
        form.append(el("p", "question-help", "No requirements yet. Add some in step 2 to link them here."));
      }
      const actions = el("div", "logic-actions");
      const save = el("button", "btn btn-primary", "Save Function");
      save.type = "submit";
      const cancel = el("button", "btn btn-secondary", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => { editingId = null; render(); });
      actions.append(save, cancel);
      form.append(actions);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !name.value.trim() || !purpose.value.trim()) return;
        save.disabled = true;
        const record = {
          id: existing?.id || crypto.randomUUID(),
          name: name.value.trim(), purpose: purpose.value.trim(),
          parameters: params.value.trim(), returns: returns.value.trim(),
          trigger: trigger.value.trim(), flow: flow.value.trim(),
          validations: validation.value.trim(), pseudocode: pseudocode.value.trim(),
          status: status.value,
          requirementIds: Array.from(related.selectedOptions, option => option.value),
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const next = existing
          ? project.logicFunctions.map(item => item.id === existing.id ? record : item)
          : [...project.logicFunctions, record];
        await persist(next, existing ? "Function updated." : "Function saved.");
        save.disabled = false;
      });
      root.append(form);
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function cardFor(item) {
      const card = el("article", "logic-card");
      const head = el("div", "logic-card-head");
      head.append(el("h4", "", `${item.name}()`), el("span", "logic-status", item.status || "not-started"));
      card.append(head, el("p", "", item.purpose || ""));
      const details = el("details", "logic-details");
      details.append(el("summary", "", "View function plan"));
      const sections = [
        ["Parameters", item.parameters], ["Return value", item.returns],
        ["Event / trigger", item.trigger], ["Logic flow", item.flow],
        ["Validations", item.validations], ["Pseudocode", item.pseudocode]
      ];
      sections.forEach(([title, value]) => {
        if (!value) return;
        details.append(el("h5", "", title), el("p", "logic-prewrap", value));
      });
      const linked = (item.requirementIds || []).map(id => {
        const index = requirements().findIndex(req => req.id === id);
        return index < 0 ? "Removed requirement" : labelForRequirement(requirements()[index], index);
      });
      if (linked.length) details.append(el("h5", "", "Related requirements"), el("p", "logic-prewrap", linked.join("\n")));
      card.append(details);
      const actions = el("div", "logic-actions");
      const edit = el("button", "btn btn-secondary", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => showEditor(item));
      const remove = el("button", "btn btn-secondary", "Delete");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm(`Delete the function "${item.name}"?`)) return;
        await persist(project.logicFunctions.filter(entry => entry.id !== item.id), "Function deleted.");
      });
      actions.append(edit, remove);
      card.append(actions);
      return card;
    }

    function render(message = "") {
      root.replaceChildren();
      root.append(el("h3", "", "Functions & Logic"),
        el("p", "question-help", "Plan what each function does, when it runs, how it handles errors, and which requirements it implements."));
      const tip = el("div", "logic-tip");
      tip.append(el("strong", "", "Example: addTransaction(amount, categoryId)"),
        el("p", "", "Trigger: form submit. Validate amount and category. Save the transaction. Recalculate the account balance. Return the created transaction or an error."));
      root.append(tip);
      const toolbar = el("div", "logic-toolbar");
      const add = el("button", "btn btn-primary", "+ Add Function");
      add.type = "button";
      add.addEventListener("click", () => showEditor());
      const filterSelect = options([
        ["all", "All statuses"], ["not-started", "Not started"],
        ["in-progress", "In progress"], ["completed", "Completed"]
      ], filter);
      filterSelect.setAttribute("aria-label", "Filter functions by status");
      filterSelect.addEventListener("change", () => { filter = filterSelect.value; render(); });
      toolbar.append(add, filterSelect);
      root.append(toolbar);
      if (message) root.append(el("p", "logic-success", message));
      const visible = project.logicFunctions.filter(item => filter === "all" || item.status === filter);
      if (!visible.length) root.append(el("p", "logic-empty", project.logicFunctions.length ? "No functions match this filter." : "No functions yet. Add your first function."));
      else visible.forEach(item => root.append(cardFor(item)));
    }
    render();
  }
  return { initialize };
})();
