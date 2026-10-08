"use strict";

/* Developer Project Hub - Requirements Module */
const RequirementsModule = (() => {
  let project = null;
  let saveCallback = null;
  let container = null;

  function initialize(currentProject, onSave, target) {
    project = currentProject;
    saveCallback = onSave;
    container = target;
    if (!Array.isArray(project.requirements)) project.requirements = [];
    render();
  }

  function createElement(tag, className = "", text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createField(labelText, type, options = []) {
    const group = createElement("div", "form-group");
    const label = createElement("label", "", labelText);
    let input;
    if (type === "select") {
      input = document.createElement("select");
      options.forEach(({ value, label: optionLabel }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = optionLabel;
        input.append(option);
      });
    } else if (type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = type;
    }
    input.className = "form-input";
    group.append(label, input);
    return { group, input };
  }

  function render() {
    container.replaceChildren();
    const heading = createElement("h3", "", "Requirements");
    const intro = createElement(
      "p",
      "",
      "Define what your application must do and the quality standards it should meet.",
    );
    const addButton = createElement(
      "button",
      "btn btn-primary",
      "+ Add Requirement",
    );
    addButton.type = "button";
    addButton.addEventListener("click", () => showForm());
    const list = createElement("div", "requirements-list");
    if (project.requirements.length === 0) {
      list.append(
        createElement(
          "p",
          "requirements-empty",
          "No requirements yet. Add your first requirement.",
        ),
      );
    } else {
      project.requirements.forEach((requirement, index) => {
        list.append(createRequirementCard(requirement, index));
      });
    }
    container.append(heading, intro, addButton, list);
  }

  function createRequirementCard(requirement, index) {
    const card = createElement("article", "requirement-card");
    const header = createElement("div", "requirement-header");
    const prefix = requirement.type === "functional" ? "FR" : "NFR";
    const title = createElement(
      "h4",
      "",
      `${prefix}-${String(index + 1).padStart(3, "0")} · ${requirement.title}`,
    );
    const badges = createElement("div", "requirement-badges");
    badges.append(
      createElement("span", "requirement-badge", requirement.priority),
      createElement("span", "requirement-badge", requirement.status),
    );
    header.append(title, badges);
    const description = createElement(
      "p",
      "requirement-description",
      requirement.description,
    );
    const actions = createElement("div", "requirement-actions");
    const editButton = createElement("button", "btn btn-secondary", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", () => showForm(requirement));
    const deleteButton = createElement("button", "btn btn-secondary", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      const links = IntegrityModule.linkedRecords(project, requirement.id);
      const details = links.length
        ? `\n\nThis requirement is linked to ${links.length} item(s):\n` +
          links.slice(0, 8).map(item => `- ${item.type}: ${item.title}`).join("\n") +
          (links.length > 8 ? `\n...and ${links.length - 8} more.` : "") +
          "\n\nThe items will be kept, but their links to this requirement will be removed."
        : "";
      if (!confirm(`Delete "${requirement.title}"?${details}`)) return;
      deleteButton.disabled = true;
      const previousRequirements = [...project.requirements];
      const previousLinks = [
        ...(Array.isArray(project.logicFunctions) ? project.logicFunctions : []),
        ...["tasks", "tests", "bugs"].flatMap(key =>
          Array.isArray(project.development?.[key]) ? project.development[key] : []),
      ].map(item => ({ item, requirementIds: Array.isArray(item.requirementIds) ? [...item.requirementIds] : undefined }));
      const restore = () => {
        project.requirements = previousRequirements;
        previousLinks.forEach(({ item, requirementIds }) => {
          if (requirementIds !== undefined) item.requirementIds = requirementIds;
        });
      };
      IntegrityModule.unlinkRequirement(project, requirement.id);
      project.requirements = project.requirements.filter(
        (item) => item.id !== requirement.id,
      );
      try {
        if (!(await saveCallback())) {
          restore();
          deleteButton.disabled = false;
          return;
        }
        render();
      } catch (error) {
        restore();
        deleteButton.disabled = false;
        console.error("Could not delete requirement:", error);
        alert("Could not delete requirement.");
      }
    });
    actions.append(editButton, deleteButton);
    card.append(header, description, actions);
    return card;
  }

  function showForm(existingRequirement = null) {
    container.replaceChildren();
    const isEditing = Boolean(existingRequirement);
    const heading = createElement(
      "h3",
      "",
      isEditing ? "Edit Requirement" : "New Requirement",
    );
    const form = document.createElement("form");
    form.className = "requirement-form";
    const title = createField("Requirement Title", "text");
    title.input.required = true;
    title.input.maxLength = 120;
    const description = createField("Description", "textarea");
    const type = createField("Requirement Type", "select", [
      { value: "functional", label: "Functional" },
      { value: "non-functional", label: "Non-Functional" },
    ]);
    const priority = createField("Priority", "select", [
      { value: "must-have", label: "Must Have" },
      { value: "should-have", label: "Should Have" },
      { value: "could-have", label: "Could Have" },
      { value: "wont-have", label: "Won't Have (for now)" },
    ]);
    const status = createField("Status", "select", [
      { value: "not-started", label: "Not Started" },
      { value: "in-progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ]);
    if (existingRequirement) {
      title.input.value = existingRequirement.title;
      description.input.value = existingRequirement.description || "";
      type.input.value = existingRequirement.type;
      priority.input.value = existingRequirement.priority;
      status.input.value = existingRequirement.status;
    }
    const actions = createElement("div", "requirement-actions");
    const cancelButton = createElement("button", "btn btn-secondary", "Cancel");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", render);
    const saveButton = createElement(
      "button",
      "btn btn-primary",
      "Save Requirement",
    );
    saveButton.type = "submit";
    actions.append(cancelButton, saveButton);
    form.append(
      title.group,
      description.group,
      type.group,
      priority.group,
      status.group,
      actions,
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const requirement = {
        id: existingRequirement?.id || crypto.randomUUID(),
        title: title.input.value.trim(),
        description: description.input.value.trim(),
        type: type.input.value,
        priority: priority.input.value,
        status: status.input.value,
      };
      if (!requirement.title) return;
      saveButton.disabled = true;
      const previousRequirements = [...project.requirements];
      if (isEditing) {
        project.requirements = project.requirements.map((item) =>
          item.id === requirement.id ? requirement : item,
        );
      } else {
        project.requirements = [...project.requirements, requirement];
      }
      try {
        if (!(await saveCallback())) {
          project.requirements = previousRequirements;
          return;
        }
        render();
      } catch (error) {
        project.requirements = previousRequirements;
        console.error("Could not save requirement:", error);
        alert("Could not save requirement.");
      } finally {
        saveButton.disabled = false;
      }
    });
    container.append(heading, form);
    title.input.focus();
  }

  return { initialize };
})();
