"use strict";
/* Dashboard insights are derived from existing project records; no data mutations. */
const DashboardModule = (() => {
  const list = value => Array.isArray(value) ? value : [];
  const count = (items, status) => items.filter(item => item.status === status).length;
  const element = (tag, className = "", value = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = String(value);
    return node;
  };
  const metrics = projects => {
    const all = {tasks: [], requirements: [], tests: [], bugs: []};
    for (const project of projects) {
      all.tasks.push(...list(project.development?.tasks));
      all.requirements.push(...list(project.requirements));
      all.tests.push(...list(project.development?.tests));
      all.bugs.push(...list(project.development?.bugs));
    }
    return all;
  };
  function render(projects) {
    const root = document.querySelector("#dashboard-insights");
    if (!root) return;
    root.replaceChildren();
    const data = metrics(projects);
    const tasksDone = count(data.tasks, "done");
    const requirementsDone = count(data.requirements, "completed");
    const testsPassed = count(data.tests, "passed");
    const testsFailed = count(data.tests, "failed");
    const openBugs = data.bugs.filter(b => b.status !== "resolved").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = data.tasks.filter(task => {
      if (task.status === "done" || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || "")) return false;
      const due = new Date(`${task.dueDate}T00:00:00`);
      return !Number.isNaN(due.getTime()) && due < today;
    }).length;
    const groups = [
      ["Development Tasks", data.tasks.length, `${tasksDone} done · ${count(data.tasks, "in-progress")} in progress · ${count(data.tasks, "todo")} to do`, tasksDone],
      ["Requirements", data.requirements.length, `${requirementsDone} completed · ${data.requirements.length - requirementsDone} remaining`, requirementsDone],
      ["Test Cases", data.tests.length, `${testsPassed} passed · ${testsFailed} failed · ${data.tests.length - testsPassed - testsFailed} other`, testsPassed],
    ];
    const heading = element("h2", "", "Project Health & Progress");
    root.append(heading);
    const cards = element("div", "insights-grid");
    for (const [name, total, detail, completed] of groups) {
      const card = element("article", "insight-card");
      const percent = total ? Math.round(completed / total * 100) : 0;
      card.append(element("h3", "", name), element("p", "insight-value", total ? `${percent}%` : "—"), element("p", "insight-detail", total ? detail : "No records yet"));
      const progress = document.createElement("progress");
      progress.max = 100; progress.value = percent;
      progress.setAttribute("aria-label", `${name}: ${percent}%`);
      card.append(progress); cards.append(card);
    }
    root.append(cards);
    const alertSection = element("section", "health-alerts");
    alertSection.append(element("h3", "", "Attention Needed"));
    const alerts = [
      [openBugs, `${openBugs} unresolved bug${openBugs === 1 ? "" : "s"}`],
      [overdue, `${overdue} overdue task${overdue === 1 ? "" : "s"}`],
      [testsFailed, `${testsFailed} failed test${testsFailed === 1 ? "" : "s"}`],
    ].filter(([quantity]) => quantity > 0);
    if (!alerts.length) alertSection.append(element("p", "insight-detail", "No current alerts based on recorded tasks, tests and bugs."));
    else {
      const ul = element("ul");
      alerts.forEach(([, message]) => ul.append(element("li", "", message)));
      alertSection.append(ul);
    }
    root.append(alertSection);
    const recent = element("section", "recent-activity");
    recent.append(element("h3", "", "Recently Updated"));
    const sorted = [...projects].sort((a,b) => (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0)).slice(0, 5);
    if (!sorted.length) recent.append(element("p", "insight-detail", "No projects yet."));
    else {
      const ul = element("ul");
      for (const project of sorted) {
        const date = Date.parse(project.updatedAt || "");
        ul.append(element("li", "", `${project.name || "Untitled project"} · ${Number.isFinite(date) ? new Date(date).toLocaleDateString() : "Date unavailable"}`));
      }
      recent.append(ul);
    }
    root.append(recent);
  }
  return {render};
})();
