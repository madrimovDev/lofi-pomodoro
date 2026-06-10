# SP3 — Tasks Polish (Design)

**Sana:** 2026-06-10
**Status:** Approved (design)
**Roadmap:** Sub-project 3/7. SP1 (i18n) + SP2 (Break & Timer UX) done. Builds on i18n (`useSettings().t`, plural, `check-i18n.mjs`) and existing tasks domain.

## 1. Maqsad va qamrov

Tasks tizimini sayqallash (foydalanuvchi maksimal variantlarni tanladi):
- **1. Search** — nom + tavsif + subtask matni bo'yicha; natija soni.
- **2. Import** — merge rejimi + xato ko'rsatish + drag-drop fayl import.
- **3. Bulk** — multi-select + ommaviy complete/delete.
- **4. Subtasks** — drag-reorder + parent auto-complete (opt-in sozlama).

## 2. Mavjud arxitektura (tasdiqlangan 2026-06-10)
- `use-tasks.tsx` (`TasksProvider`): tasks/activeTaskId state; metodlar `addTask/editTask/removeTask/completeTask/incrementPomodoro/moveTask/clearCompleted/replaceTasks/reorderTasks/addSubtask/toggleSubtask/removeSubtask`. **`completeTask(id)` ikki state'ni yangilaydi:** `setTasksState` (completedAt) VA `setActiveTaskIdState(null)` agar active bo'lsa. `replaceTasks` activeTaskId'ni tozalaydi.
- `Task = { id, name, description, estimatedPomodoros, completedPomodoros, createdAt, completedAt?, priority, dueDate, subtasks: Subtask[] }`; `Subtask = { id, text, done }`.
- `task-panel.tsx`: search (faqat `name.toLowerCase().includes`), subtasks panel (dnd yo'q), import/export tugmalari. Asosiy tasklar dnd-kit bilan reorder qilinadi (`SortableTaskRow`).
- **Import backend** (`src-tauri/src/commands/tasks.rs`): `import_tasks` → `Option<Vec<Task>>`. `validate_imported_tasks(raw)`: massiv bo'lmasa/parse-fail → `None`; massiv bo'lsa har element `id:string`+`name:string` bo'lganini Task'ga deserialize qiladi, qolganini filtrlaydi → `Some(vec)` (hatto 0 ta bo'lsa ham). Frontend `dialog.ts importTasks()` → `replaceTasks`.
- `models::Task` subtasks'ni `#[serde(default)]` bilan saqlaydi → import subtask'larni yo'qotmaydi.
- `lib.rs` invoke_handler (114-qator) `import_tasks` ni 133-qatorda ro'yxatdan o'tkazgan.
- Provider tartibi: `SettingsProvider > TasksProvider > ...`. `getCurrentWebview` hali ishlatilmagan.

## 3. Dizayn — Area 1: Search kengaytirish
`task-panel.tsx` search predikatini kengaytirish:
```ts
const q = search.trim().toLowerCase();
const matches = (t: Task) =>
  t.name.toLowerCase().includes(q) ||
  t.description.toLowerCase().includes(q) ||
  (t.subtasks ?? []).some(s => s.text.toLowerCase().includes(q));
```
Search ochiq va `q` bo'sh bo'lmaganda, input yonida natija soni: `t('searchResults', { count: filtered.length })` (plural). Yangi i18n kalit `searchResults` (uz 1-forma, en one/other, ru one/few/many).

**Files:** modify `task-panel.tsx`, i18n.

## 4. Dizayn — Area 2: Import (merge + xato + drag-drop)

### Backend (`commands/tasks.rs` + `lib.rs`)
`validate_imported_tasks`'ni `(Vec<Task>, usize)` qaytaradigan ichki yordamchiga aylantirish (valid tasklar + asl massiv uzunligi "X of Y" uchun). Yangi serializable natija:
```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult { pub status: String, pub tasks: Vec<Task>, pub total: usize }
// status: "ok" | "invalid" | "cancelled"
```
- `import_tasks(app) -> ImportResult`: dialog bekor → `{ "cancelled", [], 0 }`; o'qish/parse-fail/non-array → `{ "invalid", [], 0 }`; valid massiv → `{ "ok", tasks, total }` (total = asl massiv uzunligi).
- **Yangi komanda** `import_tasks_from_path(path: String) -> ImportResult`: berilgan yo'lni o'qib xuddi shu validatsiya (cancel yo'q — faqat ok/invalid). `lib.rs` invoke_handler'ga `commands::tasks::import_tasks_from_path` qo'shiladi.
- Mavjud testlarni `(tasks, total)` ichki yordamchiga moslab yangilash; status-mapping testlar qo'shish.

### Frontend tipi (`dialog.ts`)
```ts
export interface ImportResult { status: 'ok' | 'invalid' | 'cancelled'; tasks: Task[]; total: number }
// importTasks() => invoke<ImportResult>('import_tasks')
// importTasksFromPath(path) => invoke<ImportResult>('import_tasks_from_path', { path })
```

### Import orchestratsiyasi (TasksProvider'da — yagona manba)
TasksProvider ikkala yo'l (tugma + drop) uchun markaziy holatni egallaydi:
- Yangi metod `mergeTasks(imported: Task[])`: mavjud id'lar to'plamini hisoblab, **id'si allaqachon mavjud bo'lgan import tasklarni o'tkazib yuboradi** (re-import qilingan backup → dublikatsiz), qolganini `[...prev, ...newOnes]` qiladi. **`activeTaskId`ni TOZALAMAYDI** (replaceTasks'dan farqli).
- Import-flow holati: `pendingImport: { tasks: Task[]; total: number } | null`, `importError: 'invalid' | null`.
- Metodlar:
  - `beginImportViaDialog()`: `dialogApi.importTasks()` chaqiradi; `cancelled` → hech nima; `invalid` → `setImportError('invalid')`; `ok` → `setPendingImport({tasks, total})`.
  - `beginImportViaPath(path)`: `dialogApi.importTasksFromPath(path)`; `invalid` → error; `ok` → pendingImport.
  - `resolveImport(mode: 'replace' | 'merge')`: mode'ga qarab `replaceTasks(pending.tasks)` yoki `mergeTasks(pending.tasks)`, keyin `setPendingImport(null)`.
  - `dismissImport()`: pendingImport=null; `clearImportError()`: importError=null.

### UI
- `<ImportChoiceDialog>` (yangi komponent) — **layout darajasida bir marta render** (`index.tsx`), shunda drag-drop task-panel ochiq bo'lmasa ham ishlaydi. **Bitta komponent ikki holatni boshqaradi:**
  - `pendingImport` mavjud → Radix Dialog: "{total} ta vazifa topildi" + **Almashtirish** / **Qo'shish** / Bekor tugmalari → `resolveImport('replace'|'merge')` / `dismissImport()`.
  - `importError === 'invalid'` → xato variant: qisqa "Yaroqsiz fayl" xabari + OK tugmasi → `clearImportError()`.
  - Ikkalasi ham null bo'lsa — `open={false}`, hech narsa ko'rsatmaydi.
- `task-panel.tsx` import tugmasi: `handleImport` endi `beginImportViaDialog()` chaqiradi (eski `replaceTasks` to'g'ridan-to'g'ri chaqiruvi olib tashlanadi).
- **Drag-drop listener** (`index.tsx` `Layout`'da `useEffect`): `getCurrentWebview().onDragDropEvent(e => { if (e.payload.type === 'drop') { const json = e.payload.paths.find(p => p.toLowerCase().endsWith('.json')); if (json) beginImportViaPath(json); } })`; cleanup unlisten. Native Tauri drag-drop default yoqilgan — `dragDropEnabled`ni o'zgartirmaymiz, HTML5 onDrop ISHLATMAYMIZ (native event swallow qiladi).
  > `onDragDropEvent` Promise<UnlistenFn> qaytaradi — async; effect ichida ref bilan boshqarib, cleanup'da unlisten chaqiriladi (mount/unmount poyga oldini olish uchun standart pattern).

**Files:** modify `commands/tasks.rs`, `lib.rs`, `shared/tauri/dialog.ts`, `use-tasks.tsx`, `task-panel.tsx`, `app/layout/index.tsx`; create `components/import-choice-dialog.tsx`; i18n.

## 5. Dizayn — Area 3: Bulk operatsiyalar

### use-tasks metodlari
- `bulkComplete(ids: string[])`: bitta `setTasksState` updater — `ids` ichidagilarga `completedAt: Date.now()` (agar hali bajarilmagan bo'lsa); **agar `activeTaskId` shu ids ichida bo'lsa → `setActiveTaskIdState(null)`** (completeTask kabi dangling oldini olish).
- `bulkRemove(ids: string[])`: `setTasksState(prev => prev.filter(t => !ids.includes(t.id)))`; agar `activeTaskId` ids ichida → null.

### UI (`task-panel.tsx`)
- Selection holati: `const [selectMode, setSelectMode] = useState(false)` + `const [selected, setSelected] = useState<Set<string>>(new Set())`. **"Select mode" toggle tugmasi** (search/import tugmalari qatorida) — yoqilganda pending task qatorlarida checkbox ko'rinadi (drag-handle hover bilan to'qnashmaslik uchun always-hover emas, aniq rejim). Checkbox bosilganda `selected` to'plamiga qo'shadi/olib tashlaydi.
- Select mode yoqiq va ≥1 tanlanganda **bulk action bar** ko'rinadi: "{count} tanlandi" + Bajarildi / O'chirish tugmalari → `bulkComplete([...selected])` / `bulkRemove([...selected])`, keyin `setSelected(new Set())`. Select mode o'chirilsa `selected` tozalanadi.
- Active task va completed bo'lim selection'dan tashqarida (faqat pending tasklar tanlanadi).

**Files:** modify `use-tasks.tsx`, `task-panel.tsx`; i18n.

## 6. Dizayn — Area 4: Subtask reorder + parent auto-complete

### Reorder (dnd-kit, asosiy tasklar kabi)
- Yangi metod `reorderSubtasks(taskId: string, newOrder: Subtask[])`: `setTasksState(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: newOrder } : t))`.
- `SubtasksPanel` (task-panel ichida) subtask ro'yxatini `DndContext` + `SortableContext` bilan o'raydi (mavjud `@dnd-kit` paketlari, `SortableTaskRow` patterni). Har subtask sortable; drag tugagach `reorderSubtasks(taskId, reordered)`.

### Parent auto-complete (opt-in)
- Yangi sozlama `TimerSettings.autoCompleteOnSubtasks: boolean` (default `false`). Settings'da ToggleRow.
- **Wiring qarori (advisor):** flag **komponentdan parametr sifatida** uzatiladi (TasksProvider settings'ga bog'lanmaydi). `toggleSubtask` imzosi: `toggleSubtask(taskId, subtaskId, autoComplete: boolean)`. `SubtasksPanel` `useSettings()` orqali `settings.autoCompleteOnSubtasks`ni uzatadi.
- **Mantiq `setTasksState` updater ICHIDA** (stale state'siz), parentni tozalash updater'dan tashqarida:
```ts
const toggleSubtask = (taskId: string, subtaskId: string, autoComplete: boolean) => {
  let deactivate = false;
  setTasksState(prev => prev.map(t => {
    if (t.id !== taskId) return t;
    const subtasks = (t.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
    let next = { ...t, subtasks };
    // opt-in: barcha subtask done bo'lsa va task hali bajarilmagan bo'lsa → auto-complete
    if (autoComplete && !t.completedAt && subtasks.length > 0 && subtasks.every(s => s.done)) {
      next = { ...next, completedAt: Date.now() };
      if (t.id === activeTaskId) deactivate = true;
    }
    return next;
  }));
  if (deactivate) setActiveTaskIdState(null);
};
```
- **Bir yo'nalishli:** keyinroq subtask'ni undo qilish parentni qayta ochmaydi (faqat complete qilamiz, hech qachon un-complete emas).

**Files:** modify `use-tasks.tsx`, `task-panel.tsx`, `shared/types.ts` (`autoCompleteOnSubtasks`), `settings-panel.tsx`; i18n.

## 7. Xatoliklarni boshqarish
- Import: `cancelled` jim, `invalid` → foydalanuvchiga xabar. `import_tasks_from_path` o'qish xatosi → `invalid`.
- Merge id-collision: import id'si mavjud → o'tkazib yuboriladi (existing saqlanadi).
- Bulk/auto-complete: active task dangling har joyda tozalanadi.
- Drag-drop: faqat `.json` yo'llar; boshqa fayl turlari e'tiborsiz.
- Eski settings'da `autoCompleteOnSubtasks` yo'q → shallow-merge default `false`.

## 8. Testlash / verifikatsiya
- `bash -c 'bun run typecheck'` + `bun run build:vite` green; `bun run check:i18n` parity OK.
- Rust: `bash -c 'cd src-tauri && cargo test'` — yangilangan import testlar (ok/invalid/cancelled mapping; total count; from_path) o'tadi.
- Leftover i18n sweep (literal + expr forms).
- **Manual (`bun run dev`):**
  - Search: nom/tavsif/subtask bo'yicha topadi; natija soni 3 lokalda to'g'ri plural.
  - Import: tugma bilan valid fayl → replace/merge dialogi; merge dublikat id'larni o'tkazadi va activeTask'ni saqlaydi; invalid fayl → xato; `.json`ni oynaga tashlash → import dialogi; "X of Y" hisobi.
  - Bulk: bir nechta task tanlash → bajarilgan/o'chirish; active task tanlangan bo'lsa, complete'dan keyin active tozalanadi.
  - Subtasks: drag bilan tartiblash persist bo'ladi; auto-complete sozlamasi yoqilganda oxirgi subtask bajarilganda parent bajarilgan deb belgilanadi (active bo'lsa, active tozalanadi); sozlama o'chiq bo'lsa hech narsa bo'lmaydi.

## 9. Qamrovdan tashqari (non-goals)
- Subtask'larning estimated pomodoros / o'z muddatlari.
- Import'da uchinchi format (faqat JSON), cloud sync.
- Bulk priority/due o'zgartirish (faqat complete/delete).
- Auto-complete'ni teskari (un-complete) qilish.
- Drag-drop bilan boshqa fayl turlari (audio/folder) — SP5 music doirasi.
