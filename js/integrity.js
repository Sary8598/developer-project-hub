"use strict";
/* Relationship integrity utilities. No automatic deletion during app startup. */
const IntegrityModule = (() => {
  const collections = [
    ["Functions", p => p.logicFunctions],
    ["Tasks", p => p.development?.tasks],
    ["Tests", p => p.development?.tests],
    ["Bugs", p => p.development?.bugs],
  ];
  function linkedRecords(project, id) {
    return collections.flatMap(([type, read]) =>
      (Array.isArray(read(project)) ? read(project) : [])
        .filter(item => Array.isArray(item.requirementIds) && item.requirementIds.includes(id))
        .map(item => ({ type, title: item.title || item.name || "Untitled" })));
  }
  function invalidLinks(project) {
    const valid = new Set((Array.isArray(project.requirements) ? project.requirements : []).map(r => r.id));
    return collections.flatMap(([type, read]) =>
      (Array.isArray(read(project)) ? read(project) : []).flatMap(item =>
        (Array.isArray(item.requirementIds) ? item.requirementIds : [])
          .filter(id => !valid.has(id))
          .map(id => ({ type, title: item.title || item.name || "Untitled", id }))));
  }
  function assertValid(project) {
    const broken = invalidLinks(project);
    if (broken.length) throw new Error(`${project.name || "Project"} has ${broken.length} invalid requirement link(s). First: ${broken[0].type} / ${broken[0].title}.`);
    return true;
  }
  function unlinkRequirement(project, id) {
    for (const [, read] of collections) {
      const records = read(project);
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (Array.isArray(record.requirementIds)) {
          record.requirementIds = record.requirementIds.filter(value => value !== id);
        }
      }
    }
  }
  return { linkedRecords, invalidLinks, assertValid, unlinkRequirement };
})();
