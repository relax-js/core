---
feature: Behavioral contracts (10)
slug: behavioral-contracts-10
category: ""
status: postponed
created: 2026-05-05T22:36:26.763009300+00:00
updated: "2026-05-06T16:28:10.410997500+00:00"
---

# Behavioral contracts (10)

## Original request

> Behavioral contracts (10)
> The library opens browser popup windows with caller-specified geometry (screen x/y, width, height) using the Window Management API when available, falling back to standard window.open().
> Every managed window is assigned a stable developer-supplied identifier used for tracking, saving, and restoring.
> Window state — geometry (position + size), URL, and developer-registered custom data — is persisted to storage automatically whenever any of those values change.
> Calling restore() reopens all windows whose state is present in storage, at their saved positions and URLs, and rehydrates their custom data.
> Storage defaults to localStorage but accepts a pluggable adapter conforming to a documented read/write/delete interface.
> When the Window Management API requires it, the library requests the "window-management" permission before attempting cross-screen placement; the permission request is surfaced to the caller as a Promise.
> When the user closes a managed popup via the browser's native close button, the window's state is retained in storage (allowing future restoration via restore()).
> A close(id, options) API closes the popup window; the caller controls via an option whether the window's persisted state is also removed or kept for future restoration.
> Same-origin popup windows may push custom data updates back to the opener via a postMessage-based protocol; the library receives these messages and persists the updated custom data to storage.
> Geometry changes are detected via a hybrid strategy: a resize event listener for size changes, and a low-frequency position poll (default interval configurable, e.g. 1 s) for move detection.
> Failure modes (6)
> Browser popup blocker prevents the window from opening — the library rejects the returned Promise with a descriptive error; no state is persisted for a window that failed to open.
> User denies the "window-management" permission — the library falls back to single-screen coordinates without throwing; the caller is notified via a resolved Promise with a degraded-capability flag.
> Saved state references a screen or coordinates that no longer exist (e.g., a disconnected monitor) — the window is opened on the current primary screen at the saved size.
> Storage quota is exceeded when persisting state — the library catches the error, emits a storage-error event, and leaves the in-memory state intact.
> A popup window navigates to a cross-origin URL — the library can no longer read its geometry; last-known state is preserved in storage and updated once the window returns to a same-origin URL.
> Multiple tabs of the host application call restore() concurrently — each tab independently reopens its own window set; state isolation per tab is achievable when tabs use distinct storage namespace keys.
> Scope boundaries (5)
> Does NOT manage in-page UI windows (draggable panels, modals, etc.); only real browser popup windows.
> Does NOT automatically restore windows on page load; restoration is always triggered explicitly by the application.
> Does NOT sync state to a server or across devices; storage is entirely client-side.
> Does NOT provide window chrome (title bars, close buttons, resize handles); it manages opening, tracking, and state persistence only.
> Does NOT intercept or manage browser tab windows (window.open with _blank targeting tabs); only genuine popup windows (opened with popup=yes).
> Assumptions to validate (4)
> 
> * Window Management API (getScreenDetails) is Chrome/Edge 100+ only; Firefox and Safari do not support it. The implementation must document a two-tier capability model: full multi-screen placement (Chromium) vs. single-screen fallback (all other browsers).
> * Determine the mechanism for detecting geometry changes in a popup window (interval polling vs. resize/move events) — confirm accuracy, performance cost, and minimum viable poll interval.
> * Clarify the custom data contract: does the popup window push state updates to the opener, does the opener read from a shared storage key, or is custom data strictly set/updated by the opener only?
> * Verify whether opening a popup with explicit geometry (popup=yes, left=, top=, width=, height=) via standard window.open() is reliably honoured by modern browsers (Chrome, Firefox, Safari) without requiring the full Window Management API permission flow.
> 
> 
> 
> 
> The user chose "Popup push via postMessage" - the library injects a thin helper into same-origin popups that lets them post data updates back to the opener, which then persists them.
> Let me update assumption #2 (index 2) about custom data to reflect this decision, and add it to behavioral_contracts.
> 
> So the library emits minimal events (storage-error and popup-blocked). All lifecycle feedback is through Promises.
> 
> Now let me update the spec with these decisions:
> 
> Add a behavioral contract about postMessage-based custom data push from popup to opener
> Add a behavioral contract about the hybrid geometry detection approach
> Add a behavioral contract about restore() idempotency (focus existing window)
> Update the events/failure mode items
> Let me also update assumption #2 (custom data) and assumption #1 (geometry detection) to reflect the decisions made.
> I need to replace those two assumptions with their corresponding behavioral contracts. For the postMessage mechanism, it's same-origin only and allows the popup to push updates back to the opener. On the events side, the minimal approach means just storage-error and popup-blocked, and I should add a behavioral contract clarifying when storage-error gets emitted.

## Behavioral contracts

- The library opens browser popup windows with caller-specified geometry (screen x/y, width, height) using the Window Management API when available, falling back to standard window.open().
- Every managed window is assigned a stable developer-supplied identifier used for tracking, saving, and restoring.
- Window state — geometry (position + size), URL, and developer-registered custom data — is persisted to storage automatically whenever any of those values change.
- Calling restore() reopens all windows whose state is present in storage, at their saved positions and URLs, and rehydrates their custom data.
- Storage defaults to localStorage but accepts a pluggable adapter conforming to a documented read/write/delete interface.
- When the Window Management API requires it, the library requests the "window-management" permission before attempting cross-screen placement; the permission request is surfaced to the caller as a Promise.
- When the user closes a managed popup via the browser's native close button, the window's state is retained in storage, allowing future restoration via restore().
- A programmatic close API closes the popup window; the caller controls via an option whether the window's persisted state is also removed or kept for future restoration.
- Same-origin popup windows may push custom data updates to the opener via a postMessage-based protocol; the library validates the message origin, receives the update, and persists the updated custom data to storage.
- Geometry changes are detected via a hybrid strategy: a resize event listener for size changes and a low-frequency position poll (default 1 s, configurable) for move detection.
- If restore() or open() is called with an ID matching an already-open managed window, the library focuses the existing window instead of opening a duplicate.
- The library emits exactly two event types: storage-error (on a failed storage write) and popup-blocked (when the browser prevents a window from opening); all other lifecycle outcomes are surfaced exclusively via Promise resolution or rejection.

## Failure modes

- Browser popup blocker prevents the window from opening — the library rejects the returned Promise with a descriptive error and emits a popup-blocked event; no state is persisted for a window that failed to open.
- User denies the "window-management" permission — the library falls back to single-screen coordinates without throwing; the caller is notified via a resolved Promise with a degraded-capability flag.
- Saved state references a screen or coordinates that no longer exist (e.g., a disconnected monitor) — the window is opened on the current primary screen at the saved size.
- Storage quota is exceeded when persisting state — the library catches the error, emits a storage-error event, and leaves the in-memory state intact.
- A popup window navigates to a cross-origin URL — the library can no longer read its geometry; last-known state is preserved in storage and updated once the window returns to a same-origin URL.
- Multiple tabs of the host application call restore() concurrently — each tab independently reopens its own window set; state isolation per tab is achievable when tabs use distinct storage namespace keys.

## Scope boundaries

- Does NOT manage in-page UI windows (draggable panels, modals, etc.); only real browser popup windows.
- Does NOT automatically restore windows on page load; restoration is always triggered explicitly by the application.
- Does NOT sync state to a server or across devices; storage is entirely client-side.
- Does NOT provide window chrome (title bars, close buttons, resize handles); it manages opening, tracking, and state persistence only.
- Does NOT intercept or manage browser tab windows (window.open with _blank targeting tabs); only genuine popup windows (opened with popup=yes).

## Assumptions to validate

- Window Management API (getScreenDetails) is Chrome/Edge 100+ only; Firefox and Safari do not support it. The implementation must document a two-tier capability model: full multi-screen placement (Chromium) vs. single-screen fallback (all other browsers).
- Confirm the default 1-second position poll interval is acceptable in terms of CPU and battery cost across target browser environments, and determine the minimum viable interval that preserves acceptable accuracy.
- Confirm the postMessage-based custom data push protocol is sufficient and secure — verify that origin validation is enforced so cross-origin messages cannot poison the persisted custom data.
- Verify whether opening a popup with explicit geometry (popup=yes, left=, top=, width=, height=) via standard window.open() is reliably honoured by modern browsers (Chrome, Firefox, Safari) without requiring the full Window Management API permission flow.

