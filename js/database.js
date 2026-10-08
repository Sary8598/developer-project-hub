"use strict";

/*
  DEVELOPER PROJECT HUB
  IndexedDB Database Manager
*/

const Database = (() => {
  const DB_NAME = "DeveloperProjectHub";
  const DB_VERSION = 1;

  const PROJECTS_STORE = "projects";
  const FILES_STORE = "files";

  let db = null;

  // OPEN DATABASE

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          database.createObjectStore(PROJECTS_STORE, {
            keyPath: "id",
          });
        }

        if (!database.objectStoreNames.contains(FILES_STORE)) {
          const filesStore = database.createObjectStore(FILES_STORE, {
            keyPath: "id",
          });

          filesStore.createIndex("projectId", "projectId", {
            unique: false,
          });
        }
      };

      request.onsuccess = () => {
        db = request.result;

        db.onversionchange = () => {
          db.close();
          db = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        reject(request.error);
      };

      request.onblocked = () => {
        reject(new Error("Database upgrade blocked by another tab."));
      };
    });
  }

  // ENSURE DATABASE IS READY

  async function getDatabase() {
    if (db) return db;
    return open();
  }

  // GET ALL PROJECTS

  async function getProjects() {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROJECTS_STORE, "readonly");

      const request = transaction.objectStore(PROJECTS_STORE).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // SAVE ONE PROJECT

  async function saveProject(project) {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROJECTS_STORE, "readwrite");

      transaction.objectStore(PROJECTS_STORE).put(project);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  // SAVE MULTIPLE PROJECTS

  async function saveAllProjects(projects) {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROJECTS_STORE, "readwrite");

      const store = transaction.objectStore(PROJECTS_STORE);

      projects.forEach((project) => {
        store.put(project);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  // DELETE A PROJECT

  async function deleteProject(projectId) {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROJECTS_STORE, "readwrite");

      transaction.objectStore(PROJECTS_STORE).delete(projectId);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  // Remove a screen and its attachments in one IndexedDB transaction.
  // If any operation fails, IndexedDB rolls back both the project and files.
  async function deleteScreenWithAttachments(projectId, screenId) {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([PROJECTS_STORE, FILES_STORE], "readwrite");
      const projectStore = tx.objectStore(PROJECTS_STORE);
      const filesStore = tx.objectStore(FILES_STORE);
      const request = projectStore.get(projectId);
      let updatedProject;
      let removedFiles = 0;
      request.onsuccess = () => {
        const project = request.result;
        if (!project || !Array.isArray(project.screens) || !project.screens.some(screen => screen.id === screenId)) {
          tx.abort();
          return;
        }
        updatedProject = {
          ...project,
          screens: project.screens.filter(screen => screen.id !== screenId),
          updatedAt: new Date().toISOString(),
        };
        projectStore.put(updatedProject);
        const cursorRequest = filesStore.index("projectId").openCursor(IDBKeyRange.only(projectId));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          if (cursor.value.screenId === screenId) {
            cursor.delete();
            removedFiles++;
          }
          cursor.continue();
        };
      };
      tx.oncomplete = () => resolve({ project: updatedProject, removedFiles });
      tx.onerror = () => reject(tx.error || new Error("Screen deletion failed."));
      tx.onabort = () => reject(tx.error || new Error("Screen deletion canceled; no changes were saved."));
    });
  }

  return {
    open,
    getProjects,
    saveProject,
    saveAllProjects,
    deleteProject,
    deleteScreenWithAttachments,
  };
})();
