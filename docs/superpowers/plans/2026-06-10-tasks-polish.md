# Tasks Polish (SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the tasks system: search across name/description/subtasks with a result count; bulk multi-select complete/delete; subtask drag-reorder + opt-in parent auto-complete; import with merge mode, error surfacing, and JSON file drag-drop.

**Architecture:** Mostly frontend (`use-tasks.tsx`, `task-panel.tsx`) plus a Rust import-result type change and a new `import_tasks_from_path` command. Import orchestration (button + drag-drop → replace/merge choice) is centralized in `TasksProvider`. Areas are independent; ordered small→large, with the Rust+import flow last.

**Tech Stack:** TypeScript, React 19, Vite, Tauri v2, Rust. **BUN runtime** — `bash -c 'bun run typecheck'`, `bash -c 'bun run check:i18n'`, `bash -c 'bun run build:vite'`. Rust tests: `bash -c 'cd src-tauri && cargo test'`. (`bash -c` wrapper avoids a zsh quirk that makes bare bun/node exit 126.)

**Reference spec:** `docs/superpowers/specs/2026-06-10-tasks-polish-design.md`

> **No JS test framework** (intentional). JS verification = typecheck + check:i18n + build + manual. Rust HAS `cargo test` (existing tests in `commands/tasks.rs`) — extend those.

## Conventions (verified)
- Translator in task-panel: `const { t: tr } = useSettings();` (this file aliases it `tr`; loop/`setTimeout` vars named `t` exist). In other components: `const { t } = useSettings()`.
- Aliases `@shared/*`/`@renderer/*` (no `@/*`). New i18n keys → all 3 of `src/shared/i18n/{uz,en,ru}.ts` before `} as const;`; `bun run check:i18n` enforces parity. Plural keys need a base key in uz.ts.
- dnd-kit already used in task-panel: `DndContext, closestCenter, PointerSensor, useSensor, useSensors` from `@dnd-kit/core`; `SortableContext, verticalListSortingStrategy, useSortable, arrayMove` from `@dnd-kit/sortable`; `CSS` from `@dnd-kit/utilities`.
- `use-tasks.tsx` setters: `setTasksState`, `setActiveTaskIdState`; `activeTaskId` in scope. All mutations use functional updaters.

## File Structure
- `src/shared/types.ts` — `autoCompleteOnSubtasks` setting (Area 4).
- `src/renderer/hooks/use-tasks.tsx` — `bulkComplete`, `bulkRemove`, `reorderSubtasks`, `toggleSubtask` sig change, `mergeTasks`, import-flow state/methods.
- `src/renderer/components/task-panel.tsx` — search predicate+count, bulk select UI, subtask dnd, import button → orchestration.
- `src/renderer/components/import-choice-dialog.tsx` — NEW: replace/merge + error dialog.
- `src/renderer/components/settings-panel.tsx` — `autoCompleteOnSubtasks` toggle.
- `src/renderer/app/layout/index.tsx` — render `<ImportChoiceDialog>` + drag-drop listener.
- `src/shared/tauri/dialog.ts` — `ImportResult` type, `importTasks`/`importTasksFromPath`.
- `src-tauri/src/commands/tasks.rs` — `ImportResult`, `import_tasks` return change, `import_tasks_from_path`, tests.
- `src-tauri/src/lib.rs` — register `import_tasks_from_path`.
- `src/shared/i18n/{uz,en,ru}.ts` — new keys per area.

---

## Task 1 (Area 1): Search across name/description/subtasks + result count

**Files:** modify `src/renderer/components/task-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n plural key `searchResults` (all 3 locales)**

uz.ts: `searchResults: '{count} natija',` `searchResults_other: '{count} natija',`
en.ts: `searchResults: '{count} result',` `searchResults_one: '{count} result',` `searchResults_other: '{count} results',`
ru.ts: `searchResults: '{count} результатов',` `searchResults_one: '{count} результат',` `searchResults_few: '{count} результата',` `searchResults_many: '{count} результатов',`

- [ ] **Step 2: Extend the filter predicate**

In `task-panel.tsx`, replace the `filtered` computation (currently `pending.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))`, ~line 608) with:
```tsx
  const q = search.trim().toLowerCase();
  const filtered = showSearch && q
    ? pending.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.subtasks ?? []).some(s => s.text.toLowerCase().includes(q)))
    : pending;
```

- [ ] **Step 3: Show the result count**

Near the search `<input>` (the block rendered when `showSearch`, around the input at ~line 656), add a count line shown when searching:
```tsx
              {showSearch && q && (
                <span className="text-[10px] text-muted-foreground/40 px-1">{tr('searchResults', { count: filtered.length })}</span>
              )}
```
Place it next to / below the search input within the same search container.

- [ ] **Step 4: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/task-panel.tsx src/shared/i18n/
git commit -m "feat(tasks): search across name/description/subtasks + result count

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 (Area 3): Bulk multi-select complete/delete

**Files:** modify `src/renderer/hooks/use-tasks.tsx`, `src/renderer/components/task-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Add `bulkComplete`/`bulkRemove` to use-tasks**

In `use-tasks.tsx`, add to the `TasksContextValue` interface:
```ts
  bulkComplete: (ids: string[]) => void;
  bulkRemove: (ids: string[]) => void;
```
Add to the default context object: `bulkComplete: () => {}, bulkRemove: () => {},`
Add the implementations (near `clearCompleted`):
```ts
  const bulkComplete = (ids: string[]) => {
    const idSet = new Set(ids);
    setTasksState(prev => prev.map(t =>
      idSet.has(t.id) && !t.completedAt ? { ...t, completedAt: Date.now() } : t
    ));
    if (activeTaskId && idSet.has(activeTaskId)) setActiveTaskIdState(null);
  };

  const bulkRemove = (ids: string[]) => {
    const idSet = new Set(ids);
    setTasksState(prev => prev.filter(t => !idSet.has(t.id)));
    if (activeTaskId && idSet.has(activeTaskId)) setActiveTaskIdState(null);
  };
```
Add `bulkComplete, bulkRemove` to the Provider `value={{ ... }}`.

- [ ] **Step 2: i18n keys (all 3 locales)**

uz.ts: `selectMode: 'Tanlash',` `selectedCount: '{count} tanlandi',` `selectedCount_other: '{count} tanlandi',`
en.ts: `selectMode: 'Select',` `selectedCount: '{count} selected',` `selectedCount_one: '{count} selected',` `selectedCount_other: '{count} selected',`
ru.ts: `selectMode: 'Выбрать',` `selectedCount: '{count} выбрано',` `selectedCount_one: '{count} выбрано',` `selectedCount_few: '{count} выбрано',` `selectedCount_many: '{count} выбрано',`
(Reuse `completed`='Bajarildi' for the bulk-complete button label, `delete` for bulk-delete.)

- [ ] **Step 3: Bulk select UI in task-panel**

In the `TaskPanel` component body, add state + pull the methods:
```tsx
  const { /* existing */ bulkComplete, bulkRemove } = useTasks();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
```
Add a "Select mode" toggle Button in the header action row (next to the search/export/import buttons, ~line 637):
```tsx
                <Button variant={selectMode ? 'outline' : 'ghost'} size="icon-xs" onClick={() => { selectMode ? exitSelect() : setSelectMode(true); }} aria-label={tr('selectMode')}>
                  <CheckSquare className="size-3.5" />
                </Button>
```
(Import `CheckSquare` from `lucide-react` in the existing lucide import.)

In `SortableTaskRow`, accept two new props `selectMode?: boolean; selected?: boolean; onToggleSelect?: () => void;` and, when `selectMode`, render a checkbox at the row start:
```tsx
        {selectMode && (
          <button onClick={onToggleSelect} className={cn('size-3.5 rounded border flex-shrink-0', selected ? 'bg-primary/40 border-primary/50' : 'border-border/50')} aria-label={tr('selectMode')} />
        )}
```
Thread these props where `<SortableTaskRow ... />` is rendered in the sorted-list map: `selectMode={selectMode} selected={selected.has(task.id)} onToggleSelect={() => toggleSelected(task.id)}`.

Add a bulk action bar shown when `selectMode && selected.size > 0`, above or below the list:
```tsx
        {selectMode && selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 px-1 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs text-muted-foreground/70">{tr('selectedCount', { count: selected.size })}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" className="text-xs" onClick={() => { bulkComplete([...selected]); exitSelect(); }}>{tr('completed')}</Button>
              <Button variant="ghost" size="xs" className="text-xs text-destructive/70" onClick={() => { bulkRemove([...selected]); exitSelect(); }}>{tr('delete')}</Button>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-tasks.tsx src/renderer/components/task-panel.tsx src/shared/i18n/
git commit -m "feat(tasks): bulk multi-select complete/delete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 (Area 4): Subtask drag-reorder + opt-in parent auto-complete

**Files:** modify `src/shared/types.ts`, `src/renderer/hooks/use-tasks.tsx`, `src/renderer/components/task-panel.tsx`, `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Setting + i18n**

In `src/shared/types.ts`: add `autoCompleteOnSubtasks: boolean;` to `TimerSettings` (after `keybindings`), and `autoCompleteOnSubtasks: false,` to `DEFAULT_TIMER_SETTINGS`.
i18n (all 3 locales): uz `autoCompleteOnSubtasks: 'Subtasklar tugaganda avtomatik bajarish',` en `autoCompleteOnSubtasks: 'Auto-complete when subtasks done',` ru `autoCompleteOnSubtasks: 'Автозавершение по подзадачам',`

- [ ] **Step 2: use-tasks — `reorderSubtasks` + `toggleSubtask` signature change**

In `use-tasks.tsx`:
- Update `TasksContextValue`: change `toggleSubtask: (taskId: string, subtaskId: string) => void;` to `toggleSubtask: (taskId: string, subtaskId: string, autoComplete: boolean) => void;` and add `reorderSubtasks: (taskId: string, newOrder: Subtask[]) => void;`
- Default context: change `toggleSubtask: () => {},` keep, add `reorderSubtasks: () => {},`
- Replace `toggleSubtask` implementation with (auto-complete inside updater, clear active outside):
```ts
  const toggleSubtask = (taskId: string, subtaskId: string, autoComplete: boolean) => {
    let deactivate = false;
    setTasksState(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subtasks = (t.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
      let next: Task = { ...t, subtasks };
      if (autoComplete && !t.completedAt && subtasks.length > 0 && subtasks.every(s => s.done)) {
        next = { ...next, completedAt: Date.now() };
        if (t.id === activeTaskId) deactivate = true;
      }
      return next;
    }));
    if (deactivate) setActiveTaskIdState(null);
  };

  const reorderSubtasks = (taskId: string, newOrder: Subtask[]) => {
    setTasksState(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: newOrder } : t));
  };
```
- Add `reorderSubtasks` to the Provider value.

- [ ] **Step 3: SubtasksPanel — pass autoComplete + dnd reorder**

In `task-panel.tsx` `SubtasksPanel` (~line 265):
- Pull settings + the new method: `const { addSubtask, toggleSubtask, removeSubtask, reorderSubtasks } = useTasks();` and `const { settings, t: tr } = useSettings();`
- Extract a `SortableSubtask` row using the existing dnd-kit imports. Add above `SubtasksPanel`:
```tsx
function SortableSubtask({ taskId, sub, autoComplete }: { taskId: string; sub: Subtask; autoComplete: boolean }) {
  const { toggleSubtask, removeSubtask } = useTasks();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground/20 hover:text-muted-foreground/40">
        <GripVertical className="size-2.5" />
      </button>
      <button onClick={() => toggleSubtask(taskId, sub.id, autoComplete)} className={cn('size-3 rounded border flex-shrink-0', sub.done ? 'bg-primary/30 border-primary/40' : 'border-border/50')} />
      <span className={cn('text-xs flex-1 min-w-0', sub.done ? 'line-through text-muted-foreground/30' : 'text-foreground/60')}>{sub.text}</span>
      <button onClick={() => removeSubtask(taskId, sub.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-destructive/50 transition-all">
        <X className="size-2.5" />
      </button>
    </div>
  );
}
```
(`GripVertical` is already imported in task-panel — confirm; if not, add to the lucide import.)
- In `SubtasksPanel`, wrap the subtask list in a nested DndContext/SortableContext and use `SortableSubtask`:
```tsx
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleSubDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex(s => s.id === active.id);
    const newIndex = subtasks.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderSubtasks(taskId, arrayMove(subtasks, oldIndex, newIndex));
  };
  // render:
  // <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
  //   <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
  //     {subtasks.map(sub => <SortableSubtask key={sub.id} taskId={taskId} sub={sub} autoComplete={settings.autoCompleteOnSubtasks} />)}
  //   </SortableContext>
  // </DndContext>
```
Keep the existing add-subtask `<input>` below the list unchanged. Import `DragEndEvent` from `@dnd-kit/core` if not already imported.
> The active-task card also renders `<SubtasksPanel>` — since the change is internal to SubtasksPanel, both call sites get reorder + auto-complete automatically. No other edit needed there.

- [ ] **Step 4: Settings toggle**

In `settings-panel.tsx`, add a `ToggleRow` for `autoCompleteOnSubtasks` in the misc/toggles section (near `breakScreen`/`animations`):
```tsx
              <ToggleRow label={t('autoCompleteOnSubtasks')} checked={settings.autoCompleteOnSubtasks ?? false}
                onCheckedChange={v => updateSettings({ autoCompleteOnSubtasks: v })} />
```

- [ ] **Step 5: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS. Confirm the `toggleSubtask` call sites: the ONLY caller is `SortableSubtask` (3-arg). Grep `toggleSubtask(` → all calls pass 3 args.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/hooks/use-tasks.tsx src/renderer/components/task-panel.tsx src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(tasks): subtask drag-reorder + opt-in parent auto-complete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 (Area 2a): Import backend — typed result + from-path command

**Files:** modify `src-tauri/src/commands/tasks.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Refactor validation + add ImportResult**

In `src-tauri/src/commands/tasks.rs`, replace `validate_imported_tasks` with a version returning `(tasks, total)` and add the result struct:
```rust
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
  pub status: String, // "ok" | "invalid" | "cancelled"
  pub tasks: Vec<Task>,
  pub total: usize,
}

/// Returns (valid_tasks, original_array_len), or None if not a JSON array.
fn parse_imported_tasks(raw: &str) -> Option<(Vec<Task>, usize)> {
  let value: serde_json::Value = serde_json::from_str(raw).ok()?;
  let arr = value.as_array()?;
  let total = arr.len();
  let tasks = arr
    .iter()
    .filter_map(|item| {
      let has_id = item.get("id").and_then(|v| v.as_str()).is_some();
      let has_name = item.get("name").and_then(|v| v.as_str()).is_some();
      if has_id && has_name { serde_json::from_value::<Task>(item.clone()).ok() } else { None }
    })
    .collect();
  Some((tasks, total))
}

fn import_result_from_raw(raw: &str) -> ImportResult {
  match parse_imported_tasks(raw) {
    Some((tasks, total)) => ImportResult { status: "ok".into(), tasks, total },
    None => ImportResult { status: "invalid".into(), tasks: vec![], total: 0 },
  }
}
```

- [ ] **Step 2: Change `import_tasks` return + add `import_tasks_from_path`**

Replace the `import_tasks` command body's tail (the `validate_imported_tasks(&raw)` and `Option` return) and signature:
```rust
#[tauri::command]
pub async fn import_tasks(app: AppHandle) -> ImportResult {
  let file = app.dialog().file().add_filter("JSON", &["json"]).blocking_pick_file();
  let Some(path) = file.and_then(|f| f.into_path().ok()) else {
    return ImportResult { status: "cancelled".into(), tasks: vec![], total: 0 };
  };
  match std::fs::read_to_string(&path) {
    Ok(raw) => import_result_from_raw(&raw),
    Err(e) => { log::error!("import_tasks read failed: {e}"); ImportResult { status: "invalid".into(), tasks: vec![], total: 0 } }
  }
}

#[tauri::command]
pub async fn import_tasks_from_path(path: String) -> ImportResult {
  match std::fs::read_to_string(&path) {
    Ok(raw) => import_result_from_raw(&raw),
    Err(e) => { log::error!("import_tasks_from_path read failed: {e}"); ImportResult { status: "invalid".into(), tasks: vec![], total: 0 } }
  }
}
```

- [ ] **Step 3: Register the new command**

In `src-tauri/src/lib.rs`, in the `tauri::generate_handler![...]` list (where `commands::tasks::import_tasks` is, ~line 133), add on the next line:
```rust
      commands::tasks::import_tasks_from_path,
```

- [ ] **Step 4: Update + add Rust tests**

In the `#[cfg(test)] mod tests` block, update tests to the new helpers and add status mapping. Replace the three existing tests' calls (`validate_imported_tasks` → `parse_imported_tasks` / `import_result_from_raw`):
```rust
  #[test]
  fn valid_array_parses() {
    let raw = r#"[
      {"id":"1","name":"A","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null},
      {"id":"2","name":"B","description":"","estimatedPomodoros":2,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null}
    ]"#;
    let (tasks, total) = parse_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 2);
    assert_eq!(total, 2);
    assert_eq!(tasks[0].name, "A");
  }

  #[test]
  fn non_array_returns_none() {
    assert!(parse_imported_tasks(r#"{"id":"1"}"#).is_none());
    assert!(parse_imported_tasks("not json").is_none());
  }

  #[test]
  fn invalid_items_filtered_with_total() {
    let raw = r#"[
      {"id":"1","name":"Keeps","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null},
      {"id":"2"},
      {"name":"NoId"}
    ]"#;
    let (tasks, total) = parse_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 1);   // 1 of 3 valid
    assert_eq!(total, 3);
    assert_eq!(tasks[0].id, "1");
  }

  #[test]
  fn status_mapping() {
    assert_eq!(import_result_from_raw("not json").status, "invalid");
    let ok = import_result_from_raw(r#"[{"id":"1","name":"A","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null}]"#);
    assert_eq!(ok.status, "ok");
    assert_eq!(ok.total, 1);
  }
```

- [ ] **Step 5: Verify**

`bash -c 'cd src-tauri && cargo test'` → all tests PASS (including the 4 above). `bash -c 'cd src-tauri && cargo build'` → compiles.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/tasks.rs src-tauri/src/lib.rs
git commit -m "feat(tasks): typed ImportResult + import_tasks_from_path command

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 (Area 2b): Import frontend — merge, choice dialog, drag-drop

**Files:** modify `src/shared/tauri/dialog.ts`, `src/renderer/hooks/use-tasks.tsx`, `src/renderer/components/task-panel.tsx`, `src/renderer/app/layout/index.tsx`, `src/shared/i18n/{uz,en,ru}.ts`; create `src/renderer/components/import-choice-dialog.tsx`

- [ ] **Step 1: dialog.ts types**

In `src/shared/tauri/dialog.ts`, add the result type and the two calls (replace the existing `importTasks`):
```ts
export interface ImportResult { status: 'ok' | 'invalid' | 'cancelled'; tasks: Task[]; total: number }
// inside dialogApi:
  importTasks: () => invoke<ImportResult>('import_tasks'),
  importTasksFromPath: (path: string) => invoke<ImportResult>('import_tasks_from_path', { path }),
```

- [ ] **Step 2: use-tasks — mergeTasks + import flow state/methods**

In `use-tasks.tsx`:
- Add to `TasksContextValue`:
```ts
  mergeTasks: (imported: Task[]) => void;
  pendingImport: { tasks: Task[]; total: number } | null;
  importError: 'invalid' | null;
  beginImportViaDialog: () => void;
  beginImportViaPath: (path: string) => void;
  resolveImport: (mode: 'replace' | 'merge') => void;
  dismissImport: () => void;
  clearImportError: () => void;
```
- Add to the default context: `mergeTasks: () => {}, pendingImport: null, importError: null, beginImportViaDialog: () => {}, beginImportViaPath: () => {}, resolveImport: () => {}, dismissImport: () => {}, clearImportError: () => {},`
- Import the dialog API: `import { dialogApi } from '@shared/tauri/dialog';`
- Add state + implementations:
```ts
  const [pendingImport, setPendingImport] = useState<{ tasks: Task[]; total: number } | null>(null);
  const [importError, setImportError] = useState<'invalid' | null>(null);

  const mergeTasks = (imported: Task[]) => {
    setTasksState(prev => {
      const existing = new Set(prev.map(t => t.id));
      const fresh = imported.filter(t => !existing.has(t.id)); // skip colliding ids
      return [...prev, ...fresh];
    });
    // NOTE: does NOT clear activeTaskId (unlike replaceTasks)
  };

  const handleResult = (r: { status: string; tasks: Task[]; total: number }) => {
    if (r.status === 'cancelled') return;
    if (r.status === 'invalid') { setImportError('invalid'); return; }
    setPendingImport({ tasks: r.tasks, total: r.total });
  };
  const beginImportViaDialog = () => { dialogApi.importTasks().then(handleResult).catch(err => { console.error('import failed:', err); setImportError('invalid'); }); };
  const beginImportViaPath = (path: string) => { dialogApi.importTasksFromPath(path).then(handleResult).catch(err => { console.error('import failed:', err); setImportError('invalid'); }); };
  const resolveImport = (mode: 'replace' | 'merge') => {
    if (!pendingImport) return;
    if (mode === 'replace') replaceTasks(pendingImport.tasks); else mergeTasks(pendingImport.tasks);
    setPendingImport(null);
  };
  const dismissImport = () => setPendingImport(null);
  const clearImportError = () => setImportError(null);
```
- Add all the new names to the Provider `value={{ ... }}`. Ensure `useState` is imported (it is).

- [ ] **Step 3: i18n keys (all 3 locales)**

uz.ts: `importFound: '{count} ta vazifa topildi',` `importFound_other: '{count} ta vazifa topildi',` `importReplace: 'Almashtirish',` `importMerge: 'Qo\'shish',` `invalidFile: 'Yaroqsiz fayl',`
en.ts: `importFound: '{count} tasks found',` `importFound_one: '{count} task found',` `importFound_other: '{count} tasks found',` `importReplace: 'Replace',` `importMerge: 'Merge',` `invalidFile: 'Invalid file',`
ru.ts: `importFound: '{count} задач найдено',` `importFound_one: '{count} задача найдена',` `importFound_few: '{count} задачи найдено',` `importFound_many: '{count} задач найдено',` `importReplace: 'Заменить',` `importMerge: 'Добавить',` `invalidFile: 'Неверный файл',`
(Reuse `cancel` for the cancel button, `close`/`retry` not needed; an OK button can reuse `close` label or use `cancel`.)

- [ ] **Step 4: Create `src/renderer/components/import-choice-dialog.tsx`**

```tsx
import { Dialog } from 'radix-ui';
import { Button } from '@shared/components/ui/button';
import { useTasks } from '@renderer/hooks/use-tasks';
import { useSettings } from '@renderer/hooks/use-settings';

export function ImportChoiceDialog() {
  const { pendingImport, importError, resolveImport, dismissImport, clearImportError } = useTasks();
  const { t } = useSettings();
  const open = pendingImport !== null || importError !== null;

  const onOpenChange = (o: boolean) => { if (!o) { dismissImport(); clearImportError(); } };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 focus:outline-none">
          {importError ? (
            <>
              <Dialog.Title className="text-sm text-foreground/80 mb-4">{t('invalidFile')}</Dialog.Title>
              <div className="flex justify-end">
                <Button variant="outline" size="xs" onClick={() => clearImportError()}>{t('close')}</Button>
              </div>
            </>
          ) : pendingImport ? (
            <>
              <Dialog.Title className="text-sm text-foreground/80 mb-4">{t('importFound', { count: pendingImport.total })}</Dialog.Title>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="xs" onClick={() => resolveImport('merge')}>{t('importMerge')}</Button>
                <Button variant="outline" size="xs" onClick={() => resolveImport('replace')}>{t('importReplace')}</Button>
                <Button variant="ghost" size="xs" onClick={() => dismissImport()}>{t('cancel')}</Button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
> `total` is the original count; merge skips colliding ids so the applied count may be lower — acceptable for the prompt. `glass` + Radix `Dialog` match `keyboard-help.tsx`.

- [ ] **Step 5: Wire task-panel import button**

In `task-panel.tsx`, pull `beginImportViaDialog` from `useTasks()` and replace `handleImport`:
```tsx
  const handleImport = () => beginImportViaDialog();
```
(Remove the old `const imported = await dialogApi.importTasks(); if (imported) replaceTasks(imported);` body. If `dialogApi` import becomes unused in this file, remove it.)

- [ ] **Step 6: Render dialog + drag-drop listener in index.tsx**

In `src/renderer/app/layout/index.tsx`:
- Import: `import { ImportChoiceDialog } from '@renderer/components/import-choice-dialog';` and `import { getCurrentWebview } from '@tauri-apps/api/webview';` and `useTasks` is already imported (it is). Pull `beginImportViaPath` from `useTasks()` in `LayoutInner` (where other task hooks are used).
- Drag-drop listener `useEffect` in `LayoutInner`:
```tsx
  const { /* existing */ beginImportViaPath } = useTasks();
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview().onDragDropEvent(e => {
      if (e.payload.type === 'drop') {
        const json = e.payload.paths.find(p => p.toLowerCase().endsWith('.json'));
        if (json) beginImportViaPath(json);
      }
    }).then(fn => { if (cancelled) fn(); else unlisten = fn; });
    return () => { cancelled = true; unlisten?.(); };
  }, [beginImportViaPath]);
```
- Render `<ImportChoiceDialog />` once in `LayoutInner`'s returned JSX (next to `<StatsPanel .../>`).
> Native Tauri drag-drop is enabled by default — DO NOT add `dragDropEnabled:false` and DO NOT use an HTML5 `onDrop`; the `onDragDropEvent` is the correct API (verified against Tauri v2 docs).

- [ ] **Step 7: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS. `bash -c 'bun run build:vite'` → succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/shared/tauri/dialog.ts src/renderer/hooks/use-tasks.tsx src/renderer/components/task-panel.tsx src/renderer/components/import-choice-dialog.tsx src/renderer/app/layout/index.tsx src/shared/i18n/
git commit -m "feat(tasks): import merge mode + choice dialog + JSON drag-drop

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Green gates**

```bash
cd /home/madrimov/Projects/lofi-pomodoro
bash -c 'bun run check:i18n' && bash -c 'bun run typecheck' && bash -c 'bun run build:vite'
bash -c 'cd src-tauri && cargo test'
```
Expected: parity OK, typecheck PASS, build succeeds, cargo tests PASS.

- [ ] **Step 2: i18n leftover sweep (literal + expr)**

```bash
grep -rnE 'placeholder="|aria-label="|title="' src/renderer/components src/renderer/app || echo "NONE-literal"
grep -rnE "aria-label=\{[^}]*'[^']+'|title=\{[^}]*'[^']+'" src/renderer/components src/renderer/app | grep -vE "t\(|tFn\(|tr\(|\?:" || echo "NONE-expr"
```
Expected: NONE-literal, NONE-expr. Wire any real leftover.

- [ ] **Step 3: Manual GUI pass (`bash -c 'bun run dev'`)**
- **Search:** open search, type a term matching a description and a subtask → both surface; result count shows correct plural in uz/en/ru.
- **Bulk:** enable select mode → check 2+ tasks → bar shows "N selected" → complete moves them to completed; delete removes them; deleting/completing the active task clears the active highlight.
- **Subtasks:** drag to reorder a task's subtasks (persists after reopen); enable auto-complete setting → check the last subtask → parent task auto-completes (and active clears if it was active); with setting off, nothing auto-completes.
- **Import:** import button + valid file → "N tasks found" → Merge (skips duplicate ids, keeps active task) / Replace works; invalid JSON file → "Invalid file"; drag a `.json` onto the window → same dialog; drag a non-json → ignored.

- [ ] **Step 4: Final commit (if sweep fixes needed)**

```bash
git add -A && git commit -m "tasks: SP3 final verification fixes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (author)
- **Spec coverage:** Area1=T1; Area3 bulk=T2; Area4 subtasks=T3; Area2 import backend=T4, frontend/merge/drag-drop=T5; verify=T6.
- **Advisor points pinned:** drag-drop uses verified `getCurrentWebview().onDragDropEvent` w/ paths, native enabled (T5 step 6); parent auto-complete inside updater + clears active outside, flag passed as param (T3 step 2); import status `ok/invalid/cancelled` + total (T4); `mergeTasks` does NOT clear active + skips dup ids (T5 step 2); signature ripple covered — tasks.rs + lib.rs register + dialog.ts + task-panel call site (T4/T5).
- **toggleSubtask sig change:** only caller is `SortableSubtask` (T3) — verified single call site; grep gate in T3 step 5.
- **No placeholders; exact paths; BUN + cargo commands.**
