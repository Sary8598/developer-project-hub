"use strict";
/* Development & Testing — tasks, milestones, test cases and bug tracking. */
const DevelopmentModule = (() => {
  const make = (tag, cls = "", text = "") => {
    const node = document.createElement(tag);
    node.className = cls;
    node.textContent = text;
    return node;
  };
  const choices = (values, selected) => {
    const control = make("select", "form-input");
    values.forEach(([value, label]) => {
      const option = make("option", "", label);
      option.value = value;
      control.append(option);
    });
    control.value = selected || values[0][0];
    return control;
  };
  const statuses = [["todo", "To Do"], ["in-progress", "In Progress"], ["done", "Done"]];
  const priorityOptions = [["low", "Low"], ["medium", "Medium"], ["high", "High"]];
  const schema = {
    tasks: {title: "Development Tasks", name: "Task", fields: [
      ["title", "Task title", "text", true], ["description", "Description", "textarea"],
      ["priority", "Priority", "select", false, priorityOptions], ["status", "Status", "select", false, statuses],
      ["dueDate", "Due date", "date"], ["requirementIds", "Related requirements", "requirements"]]},
    tests: {title: "Test Cases", name: "Test Case", fields: [
      ["title", "Test name", "text", true], ["steps", "Steps to execute", "textarea"],
      ["expected", "Expected result", "textarea"], ["actual", "Actual result", "textarea"],
      ["status", "Test result", "select", false, [["not-run", "Not run"], ["passed", "Passed"], ["failed", "Failed"], ["blocked", "Blocked"]]],
      ["requirementIds", "Related requirements", "requirements"]]},
    bugs: {title: "Bug Tracker", name: "Bug", fields: [
      ["title", "Bug title", "text", true], ["steps", "Steps to reproduce", "textarea"],
      ["expected", "Expected behavior", "textarea"], ["actual", "Actual behavior", "textarea"],
      ["severity", "Severity", "select", false, [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["critical", "Critical"]]],
      ["status", "Status", "select", false, [["open", "Open"], ["in-progress", "In Progress"], ["resolved", "Resolved"]]],
      ["requirementIds", "Related requirements", "requirements"]]},
    milestones: {title: "Project Milestones", name: "Milestone", fields: [
      ["title", "Milestone name", "text", true], ["description", "Deliverable / goal", "textarea"],
      ["dueDate", "Target date", "date"], ["status", "Status", "select", false, statuses]]}
  };
  function getProgress(project) {
    const tasks = Array.isArray(project.development?.tasks) ? project.development.tasks : [];
    return {total: tasks.length, done: tasks.filter(item => item.status === "done").length,
      percent: tasks.length ? Math.round(tasks.filter(item => item.status === "done").length / tasks.length * 100) : 0};
  }
  function initialize(project, saveProject, target, onChange = () => {}) {
    if (!project.development || typeof project.development !== "object") project.development = {};
    for (const key of Object.keys(schema)) if (!Array.isArray(project.development[key])) project.development[key] = [];
    const root = make("section", "development-module");
    target.append(root);
    let tab = "tasks", editing = null, busy = false;
    const reqs = () => Array.isArray(project.requirements) ? project.requirements : [];
    async function persist(next, message) {
      if (busy) return;
      busy = true;
      const previous = project.development[tab];
      const previousDate = project.updatedAt;
      project.development[tab] = next;
      project.updatedAt = new Date().toISOString();
      let success = false;
      try { success = await saveProject(project); } catch (error) { console.error(error); }
      if (!success) {
        project.development[tab] = previous;
        project.updatedAt = previousDate;
        alert("Could not save. Your previous data has been restored.");
      } else { editing = null; onChange(); }
      busy = false;
      render(success ? message : "");
    }
    function editor(record = null) {
      editing = record?.id || "new";
      render();
      const form = make("form", "planning-form development-form");
      form.append(make("h4", "", record ? `Edit ${schema[tab].name}` : `Add ${schema[tab].name}`));
      const controls = {};
      schema[tab].fields.forEach(([key, label, type, required, options]) => {
        const group = make("div", "form-group");
        const labelNode = make("label", "", label);
        let control;
        if (type === "select") control = choices(options, record?.[key]);
        else if (type === "textarea") {
          control = make("textarea", "form-input"); control.rows = 3;
          control.value = record?.[key] || "";
        } else if (type === "requirements") {
          control = make("select", "form-input"); control.multiple = true;
          control.size = Math.max(3, Math.min(6, reqs().length));
          reqs().forEach((req, i) => {
            const opt = make("option", "", `${i + 1}. ${req.title}`);
            opt.value = req.id;
            opt.selected = (record?.requirementIds || []).includes(req.id);
            control.append(opt);
          });
          if (!reqs().length) group.append(make("p", "question-help", "Add requirements in step 2 to link them here."));
        } else {
          control = make("input", "form-input"); control.type = type;
          control.value = record?.[key] || "";
          if (type === "text") control.maxLength = 180;
        }
        control.id = `dev-${crypto.randomUUID()}`;
        control.required = Boolean(required);
        labelNode.htmlFor = control.id;
        controls[key] = {control, type};
        group.prepend(labelNode); group.append(control); form.append(group);
      });
      const save = make("button", "btn btn-primary", "Save"); save.type = "submit";
      const cancel = make("button", "btn btn-secondary", "Cancel"); cancel.type = "button";
      cancel.addEventListener("click", () => { editing = null; render(); });
      form.append(save, cancel);
      form.addEventListener("submit", async event => {
        event.preventDefault(); if (busy) return;
        save.disabled = true;
        const item = {id: record?.id || crypto.randomUUID()};
        for (const [key, {control, type}] of Object.entries(controls)) {
          item[key] = type === "requirements" ? [...control.selectedOptions].map(opt => opt.value) : control.value.trim();
        }
        const current = project.development[tab];
        await persist(record ? current.map(old => old.id === record.id ? item : old) : [...current, item], `${schema[tab].name} saved.`);
      });
      root.append(form);
    }
    function render(message = "") {
      root.replaceChildren();
      root.append(make("h3", "", "Development & Testing"), make("p", "question-help", "Plan development, follow progress, verify requirements with tests and track bugs. Everything is saved locally with your project."));
      const p = getProgress(project);
      root.append(make("p", "", `Development progress: ${p.percent}% (${p.done}/${p.total} tasks completed)`));
      const bar = make("progress", "development-progress"); bar.max = 100; bar.value = p.percent; bar.setAttribute("aria-label", "Development progress"); root.append(bar);
      const nav = make("div", "development-tabs");
      Object.entries(schema).forEach(([key, config]) => {
        const btn = make("button", `btn ${key === tab ? "btn-primary" : "btn-secondary"}`, config.title);
        btn.type = "button"; btn.addEventListener("click", () => { tab = key; editing = null; render(); }); nav.append(btn);
      });
      root.append(nav);
      if (message) root.append(make("p", "save-feedback", message));
      root.append(make("h4", "", schema[tab].title));
      const add = make("button", "btn btn-primary", `+ Add ${schema[tab].name}`);
      add.type = "button"; add.addEventListener("click", () => editor()); root.append(add);
      if (tab === "tasks") {
        const board = make("div", "development-board");
        statuses.forEach(([status, label]) => {
          const column = make("div", "development-column");
          column.append(make("h4", "", `${label} (${project.development.tasks.filter(task => task.status === status).length})`));
          project.development.tasks.filter(task => task.status === status).forEach(task => column.append(card(task)));
          board.append(column);
        });
        root.append(board);
      } else {
        const list = make("div", "development-list");
        project.development[tab].forEach(item => list.append(card(item)));
        root.append(list);
      }
      if (!project.development[tab].length) root.append(make("p", "question-help", "No records yet. Create your first one above."));
    }
    function card(item) {
      const cardNode = make("article", "development-card");
      cardNode.append(make("h5", "", item.title || "Untitled"));
      schema[tab].fields.forEach(([key, label, type, , options]) => {
        if (key === "title" || key === "requirementIds" || !item[key]) return;
        const value = options ? (options.find(([id]) => id === item[key])?.[1] || item[key]) : item[key];
        cardNode.append(make("p", "development-detail", `${label}: ${value}`));
      });
      if (item.requirementIds?.length) {
        const names = item.requirementIds.map(id => reqs().find(req => req.id === id)?.title || "Removed requirement");
        cardNode.append(make("p", "development-detail", `Requirements: ${names.join(", ")}`));
      }
      const edit = make("button", "btn btn-secondary", "Edit"); edit.type = "button";
      edit.addEventListener("click", () => editor(item));
      const del = make("button", "btn btn-secondary", "Delete"); del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete ${schema[tab].name.toLowerCase()} "${item.title}"?`)) return;
        await persist(project.development[tab].filter(entry => entry.id !== item.id), "Record deleted.");
      });
      cardNode.append(edit, del);
      return cardNode;
    }
    render();
  }
  return {initialize, getProgress};
})();
