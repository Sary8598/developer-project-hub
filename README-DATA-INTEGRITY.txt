DATA CONSISTENCY & VALIDATION

- Before deleting a requirement, the application displays its linked functions, tasks, tests and bugs.
- Confirming deletes the requirement and removes only the associated requirement ID from linked items.
- If IndexedDB saving fails, the requirement and all links are restored in memory.
- Saving a project and importing JSON/ZIP backups reject dangling requirement links rather than silently changing data.
- Existing records are not automatically changed when opening the application.

TEST: create a requirement, link it to a function and a task, delete it, confirm links disappear but function/task remain, reload. Also try Cancel.

IMPORTANT: export a complete ZIP backup before replacing files. Keep Live Server origin unchanged.
