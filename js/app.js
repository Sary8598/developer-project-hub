"use strict";

/* Developer Project Hub - Application */

const PROJECTS_KEY = "developerHub.projects";
const THEME_KEY = "developerHub.theme";
const MIGRATION_KEY = "developerHub.migrationComplete";

let projects = [];
let currentProjectId = null;
let appReady = false;

const planningSteps = [
  "Project Overview",
  "Requirements",
  "Application Structure",
  "Data Modeling",
  "Data Storage",
  "Technologies",
  "Functions & Logic",
  "UI/UX Resources",
  "Development & Testing",
];

// DOM references
const navLinks = document.querySelectorAll(".nav-link");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#page-title");
const newProjectBtn = document.querySelector("#new-project-btn");
const projectModal = document.querySelector("#project-modal");
const closeModalBtn = document.querySelector("#close-modal");
const cancelProjectBtn = document.querySelector("#cancel-project");
const projectForm = document.querySelector("#project-form");
const projectNameInput = document.querySelector("#project-name");
const projectDescriptionInput = document.querySelector("#project-description");
const projectStatusInput = document.querySelector("#project-status");
const recentProjectsContainer = document.querySelector("#recent-projects");
const allProjectsContainer = document.querySelector("#all-projects");
const projectSearch = document.querySelector("#project-search");
const projectFilter = document.querySelector("#project-filter");
const totalProjectsElement = document.querySelector("#total-projects");
const activeProjectsElement = document.querySelector("#active-projects");
const completedProjectsElement = document.querySelector("#completed-projects");
const themeToggle = document.querySelector("#theme-toggle");
const backToProjectsBtn = document.querySelector("#back-to-projects");
const workspaceProjectName = document.querySelector("#workspace-project-name");
const workspaceProjectDescription = document.querySelector(
  "#workspace-project-description",
);
const planningNavigation = document.querySelector("#planning-navigation");
const planningStepContent = document.querySelector("#planning-step-content");

// STORAGE: migrate old localStorage projects only once.
async function loadProjects() {
  const existing = await Database.getProjects();

  if (localStorage.getItem(MIGRATION_KEY) !== "true") {
    const legacyJSON = localStorage.getItem(PROJECTS_KEY);
    if (legacyJSON !== null) {
      const legacyProjects = JSON.parse(legacyJSON);
      if (!Array.isArray(legacyProjects)) {
        throw new Error(
          "Old project data is not a valid array. Migration stopped.",
        );
      }
      const existingIds = new Set(existing.map((project) => project.id));
      const missingProjects = legacyProjects.filter(
        (project) =>
          project &&
          typeof project.id === "string" &&
          !existingIds.has(project.id),
      );
      if (missingProjects.length > 0) {
        await Database.saveAllProjects(missingProjects);
      }
    }
    // Old data remains untouched for safety.
    localStorage.setItem(MIGRATION_KEY, "true");
  }

  return Database.getProjects();
}

// Save only the project being edited, preventing unrelated overwrites.
async function saveProject(project) {
  try {
    IntegrityModule.assertValid(project);
    await Database.saveProject(project);
    return true;
  } catch (error) {
    console.error("Could not save project:", error);
    alert("Could not save your project. Please try again.");
    return false;
  }
}

// NAVIGATION
function showView(viewName) {
  views.forEach((view) => {
    const isActive = view.id === `${viewName}-view`;
    view.classList.toggle("active-view", isActive);
    view.hidden = !isActive;
  });
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });
  const titles = {
    dashboard: "Dashboard",
    projects: "My Projects",
    resources: "Resources",
    workspace: "Project Workspace",
  };
  pageTitle.textContent = titles[viewName] || "Developer Hub";
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => showView(link.dataset.view));
});

// PROJECT MODAL
function openProjectModal() {
  if (!appReady) return;
  projectModal.hidden = false;
  projectNameInput.focus();
}

function closeProjectModal() {
  projectModal.hidden = true;
  projectForm.reset();
}

newProjectBtn.addEventListener("click", openProjectModal);
closeModalBtn.addEventListener("click", closeProjectModal);
cancelProjectBtn.addEventListener("click", closeProjectModal);
projectModal.addEventListener("click", (event) => {
  if (event.target === projectModal) closeProjectModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !projectModal.hidden) closeProjectModal();
});

// CREATE PROJECT
projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!appReady) return;

  const name = projectNameInput.value.trim();
  const description = projectDescriptionInput.value.trim();
  const status = projectStatusInput.value;
  if (!name) return;

  const newProject = {
    id: crypto.randomUUID(),
    name,
    description,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    planning: {},
    requirements: [],
    resources: [],
    tasks: [],
  };

  const submitButton = projectForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (!(await saveProject(newProject))) return;
    projects.unshift(newProject);
    closeProjectModal();
    renderApp();
    openWorkspace(newProject.id);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// DASHBOARD
function renderStatistics() {
  totalProjectsElement.textContent = projects.length;
  activeProjectsElement.textContent = projects.filter(
    (project) => project.status === "in-progress",
  ).length;
  completedProjectsElement.textContent = projects.filter(
    (project) => project.status === "completed",
  ).length;
}

function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";

  const status = document.createElement("span");
  status.className = "project-status";
  status.textContent = (project.status || "planning").replaceAll("-", " ");

  const title = document.createElement("h3");
  title.textContent = project.name;

  const description = document.createElement("p");
  description.textContent = project.description || "No description provided.";

  const button = document.createElement("button");
  button.className = "btn btn-primary";
  button.type = "button";
  button.textContent = "Open Project";
  button.addEventListener("click", () => openWorkspace(project.id));

  const progress = DevelopmentModule.getProgress(project);
  const progressText = document.createElement("p");
  progressText.className = "project-progress-text";
  progressText.textContent = progress.total ? `Development: ${progress.percent}% (${progress.done}/${progress.total} tasks)` : "Development: No tasks yet";
  const progressBar = document.createElement("progress");
  progressBar.max = 100;
  progressBar.value = progress.percent;
  progressBar.setAttribute("aria-label", `${project.name} development progress`);
  card.append(status, title, description, progressText, progressBar, button);
  return card;
}

function renderProjectList(container, projectList) {
  container.replaceChildren();
  if (projectList.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const heading = document.createElement("h3");
    heading.textContent = "No projects found";
    const message = document.createElement("p");
    message.textContent = "Create a project to start planning your next idea.";
    empty.append(heading, message);
    container.append(empty);
    return;
  }
  projectList.forEach((project) =>
    container.append(createProjectCard(project)),
  );
}

function renderProjects() {
  const searchTerm = projectSearch.value.trim().toLowerCase();
  const selectedStatus = projectFilter.value;
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm) ||
      (project.description || "").toLowerCase().includes(searchTerm);
    const matchesStatus =
      selectedStatus === "all" || project.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });
  renderProjectList(allProjectsContainer, filteredProjects);
  renderProjectList(recentProjectsContainer, [...projects].sort((a, b) => (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0)).slice(0, 3));
}

projectSearch.addEventListener("input", renderProjects);
projectFilter.addEventListener("change", renderProjects);

// PROJECT WORKSPACE
function openWorkspace(projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  currentProjectId = project.id;
  workspaceProjectName.textContent = project.name;
  workspaceProjectDescription.textContent = project.description || "";
  renderPlanningNavigation();
  renderPlanningStep(0);
  showView("workspace");
}

function renderPlanningNavigation() {
  planningNavigation.replaceChildren();
  planningSteps.forEach((step, index) => {
    const button = document.createElement("button");
    button.className = "planning-step";
    button.type = "button";
    button.textContent = `${index + 1}. ${step}`;
    button.addEventListener("click", () => renderPlanningStep(index));
    planningNavigation.append(button);
  });
}

function renderPlanningStep(stepIndex) {
  const buttons = planningNavigation.querySelectorAll(".planning-step");
  buttons.forEach((button, index) => {
    button.classList.toggle("active", index === stepIndex);
  });
  planningStepContent.replaceChildren();

  const project = projects.find((item) => item.id === currentProjectId);
  if (!project) return;

  // Step 2: Requirements module.
  if (stepIndex === 1) {
    RequirementsModule.initialize(
      project,
      async () => {
        const oldUpdatedAt = project.updatedAt;
        project.updatedAt = new Date().toISOString();
        const saved = await saveProject(project);
        if (!saved) project.updatedAt = oldUpdatedAt;
        return saved;
      },
      planningStepContent,
    );
    const traceContainer = document.createElement("div");
    traceContainer.className = "traceability-container";
    const traceToggle = document.createElement("button");
    traceToggle.type = "button";
    traceToggle.className = "btn btn-secondary";
    traceToggle.textContent = "View Requirements Traceability";
    let traceOpen = false;
    traceToggle.addEventListener("click", () => {
      traceOpen = !traceOpen;
      traceContainer.replaceChildren();
      traceToggle.textContent = traceOpen ? "Hide Requirements Traceability" : "View Requirements Traceability";
      if (traceOpen) TraceabilityModule.initialize(project, traceContainer);
    });
    planningStepContent.append(traceToggle, traceContainer);
    return;
  }

  // Step 3: screens, components, links and IndexedDB attachments.
  if (stepIndex === 2) {
    StructureModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  // Step 4: entities, attributes and relationships.
  if (stepIndex === 3) {
    ModelingModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  // Step 5: Data Storage planning.
  if (stepIndex === 4) {
    StorageModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  // Step 6: technology stack and architecture planning.
  if (stepIndex === 5) {
    TechnologiesModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  // Step 7: function planning and requirement traceability.
  if (stepIndex === 6) {
    LogicModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  // Step 8: visual design, UX decisions and asset library.
  if (stepIndex === 7) {
    UIUXModule.initialize(project, saveProject, planningStepContent);
    return;
  }

  if (stepIndex === 8) {
    DevelopmentModule.initialize(project, saveProject, planningStepContent, renderApp);
    return;
  }

  const step = planningQuestions[stepIndex];
  if (!step) {
    const message = document.createElement("p");
    message.textContent = "This planning section will be available soon.";
    planningStepContent.append(message);
    return;
  }

  const heading = document.createElement("h3");
  heading.textContent = step.title;
  const description = document.createElement("p");
  description.textContent = step.description;
  const form = document.createElement("form");
  form.className = "planning-form";
  const savedAnswers = project.planning?.[step.id] || {};

  step.questions.forEach((question) => {
    const group = document.createElement("div");
    group.className = "form-group";
    const label = document.createElement("label");
    label.textContent = question.label;
    label.htmlFor = `question-${question.id}`;
    const help = document.createElement("p");
    help.className = "question-help";
    help.textContent = question.help || "";
    let input;
    if (question.type === "select") {
      input = document.createElement("select");
      question.options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        input.append(element);
      });
    } else {
      input = document.createElement("textarea");
      input.rows = 3;
      input.placeholder = question.example || "";
    }
    input.id = `question-${question.id}`;
    input.name = question.id;
    input.className = "form-input";
    input.value = savedAnswers[question.id] || "";
    group.append(label, help, input);
    if (question.example) {
      const example = document.createElement("div");
      example.className = "question-example";
      example.textContent = `Example: ${question.example}`;
      group.append(example);
    }
    form.append(group);
  });

  const actions = document.createElement("div");
  actions.className = "planning-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "btn btn-primary";
  saveButton.textContent = "Save Answers";
  const feedback = document.createElement("span");
  feedback.className = "save-feedback";
  feedback.setAttribute("role", "status");
  actions.append(feedback, saveButton);
  form.append(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    feedback.textContent = "Saving...";
    try {
      const formData = new FormData(form);
      const answers = {};
      step.questions.forEach((question) => {
        answers[question.id] = String(formData.get(question.id) || "").trim();
      });
      const previousPlanning = structuredClone(project.planning || {});
      const previousUpdatedAt = project.updatedAt;
      project.planning = { ...project.planning, [step.id]: answers };
      project.updatedAt = new Date().toISOString();
      if (await saveProject(project)) {
        feedback.textContent = "Answers saved successfully!";
      } else {
        project.planning = previousPlanning;
        project.updatedAt = previousUpdatedAt;
        feedback.textContent = "Could not save answers.";
      }
    } finally {
      saveButton.disabled = false;
    }
  });

  planningStepContent.append(heading, description, form);
}

backToProjectsBtn.addEventListener("click", () => {
  currentProjectId = null;
  showView("projects");
});

// THEME: localStorage is appropriate for small preferences.
function initializeTheme() {
  try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
      document.body.classList.add("dark-theme");
    }
  } catch (error) {
    console.warn("Could not read theme preference:", error);
  }
  updateThemeButton();
}

function updateThemeButton() {
  const isDark = document.body.classList.contains("dark-theme");
  themeToggle.textContent = isDark ? "Light Mode" : "Dark Mode";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  try {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch (error) {
    console.warn("Could not save theme preference:", error);
  }
  updateThemeButton();
});

// INITIALIZATION
function renderApp() {
  renderStatistics();
  renderProjects();
  DashboardModule.render(projects);
}

async function init() {
  initializeTheme();
  newProjectBtn.disabled = true;
  try {
    await Database.open();
    projects = await loadProjects();
    appReady = true;
    renderApp();
    showView("dashboard");
    newProjectBtn.disabled = false;
    BackupModule.initialize({
      getProjects: () => projects,
      saveImportedProjects: (items) => Database.saveAllProjects(items),
      onImported: async () => {
        projects = await Database.getProjects();
        renderApp();
      },
    });
    ZipBackupModule.initialize({
      onImported: async () => {
        projects = await Database.getProjects();
        renderApp();
      },
    });
    PDFModule.initialize({
      getCurrentProject: () =>
        projects.find((project) => project.id === currentProjectId),
    });
    console.log("Developer Project Hub: IndexedDB ready!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    alert(
      "Could not load your projects. Your old localStorage data was not deleted.",
    );
  }
}

init();
