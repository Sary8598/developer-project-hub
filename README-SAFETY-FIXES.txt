Developer Project Hub — Data Safety Fixes

1. Screen deletion is now atomic: project screen removal and attachment removal occur in a single IndexedDB transaction. If any step fails, all changes roll back.
2. ZIP import validates unique attachment paths and checks for attachment ID collisions inside the import transaction. On collision, import aborts without overwriting existing data.

INSTALLATION
- Export Complete ZIP from your CURRENT app before upgrading.
- Keep a copy of the previous project folder.
- Open this new folder using the SAME Live Server origin (hostname and port).
- Do not clear browser storage.

TESTS
- Add a screen with an image, then delete the screen: both should disappear.
- Import an existing backup: matching projects should be skipped.
- Export again and verify projects and attachments are present.

NOTE: These are targeted fixes; full browser end-to-end testing remains necessary.
