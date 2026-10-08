"use strict";
/* Read-only requirement traceability: derives links from existing saved records. */
const TraceabilityModule = (() => {
  const el = (tag, className = "", content = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = content;
    return node;
  };
  function getLinks(project, requirementId) {
    const logic = Array.isArray(project.logicFunctions) ? project.logicFunctions : [];
    const development = project.development || {};
    const matching = items => (Array.isArray(items) ? items : []).filter(item =>
      Array.isArray(item.requirementIds) && item.requirementIds.includes(requirementId));
    return {
      functions: matching(logic),
      tasks: matching(development.tasks),
      tests: matching(development.tests),
      bugs: matching(development.bugs),
    };
  }
  function initialize(project, target) {
    const root = el("section", "traceability-module");
    const title = el("h3", "", "Requirements Traceability");
    const intro = el("p", "question-help", "See which functions, development tasks, tests, and bugs are linked to each requirement. Links are managed in Functions & Logic and Development & Testing.");
    const summary = el("p", "trace-summary");
    const content = el("div", "trace-list");
    root.append(title, intro, summary, content);
    target.append(root);
    function render() {
      content.replaceChildren();
      const requirements = Array.isArray(project.requirements) ? project.requirements : [];
      const linked = requirements.filter(req => Object.values(getLinks(project, req.id)).some(items => items.length));
      summary.textContent = `${linked.length} of ${requirements.length} requirements have linked work items.`;
      if (!requirements.length) {
        content.append(el("p", "question-help", "No requirements yet. Create a requirement in the Requirements editor first."));
        return;
      }
      requirements.forEach((req, index) => {
        const details = el("details", "trace-card");
        const prefix = req.type === "non-functional" ? "NFR" : "FR";
        details.append(el("summary", "", `${prefix}-${String(index + 1).padStart(3,"0")} · ${req.title || "Untitled"}`));
        const links = getLinks(project, req.id);
        [["Functions", links.functions], ["Development tasks", links.tasks], ["Test cases", links.tests], ["Bugs", links.bugs]].forEach(([label, items]) => {
          const section = el("div", "trace-group");
          section.append(el("h4", "", `${label} (${items.length})`));
          if (!items.length) section.append(el("p", "question-help", "No linked items"));
          else {
            const list = el("ul");
            items.forEach(item => list.append(el("li", "", `${item.title || item.name || "Untitled"}${item.status ? ` — ${item.status}` : ""}`)));
            section.append(list);
          }
          details.append(section);
        });
        content.append(details);
      });
    }
    render();
    return { refresh: render };
  }
  return { initialize, getLinks };
})();
