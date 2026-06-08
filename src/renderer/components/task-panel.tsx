import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent } from '@shared/components/ui/sheet';
import {
  Plus, Trash2, CheckCircle2, ClipboardList,
  ChevronDown, ChevronUp, Pencil, Check, X,
  Circle, ListChecks, Download, Upload, Search, GripVertical,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@shared/components/ui/button';
import { dialogApi } from '@shared/tauri/dialog';
import { useTasks } from '@renderer/hooks/use-tasks';
import { useStats } from '@renderer/hooks/use-stats';
import { cn } from '@shared/lib/utils';
import type { Task, Subtask } from '@shared/types';

interface TaskPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugun';
  if (d.toDateString() === yesterday.toDateString()) return 'Kecha';
  return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
}

function groupByDate(tasks: Task[]): { label: string; tasks: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of [...tasks].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))) {
    const label = formatDate(t.completedAt!);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  return Array.from(map.entries()).map(([label, tasks]) => ({ label, tasks }));
}

function formatDueDate(ts: number): { text: string; overdue: boolean } {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `⚠ Kechikdi`, overdue: true };
  if (diff === 0) return { text: '🗓 Bugun', overdue: false };
  if (diff === 1) return { text: '🗓 Ertaga', overdue: false };
  return { text: `🗓 ${new Date(ts).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}`, overdue: false };
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
};

// ─── TomatoDots ───────────────────────────────────────────────────────────────

function TomatoDots({ completed, estimated, max = 6 }: {
  completed: number;
  estimated: number;
  max?: number;
}) {
  const displayCount = Math.min(estimated, max);
  const overflow = estimated > max ? estimated - max : 0;
  const filled = Math.min(completed, displayCount);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: displayCount }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full transition-all duration-300',
            i < filled ? 'bg-primary' : 'border border-primary/30 bg-transparent',
          )}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-muted-foreground/40 tabular-nums ml-0.5">+{overflow}</span>
      )}
    </div>
  );
}

// ─── Active Task Card ─────────────────────────────────────────────────────────

function ActiveTaskCard({ task, onDeactivate, onComplete }: {
  task: Task;
  onDeactivate: () => void;
  onComplete: () => void;
}) {
  const { toggleSubtask } = useTasks();
  const doneSubtasks = (task.subtasks ?? []).filter(s => s.done).length;
  const totalSubtasks = (task.subtasks ?? []).length;

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/25 p-3.5 flex flex-col gap-2.5 shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {task.priority && (
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_COLORS[task.priority])} />
            )}
            <p className="text-[10px] uppercase tracking-widest text-primary/60 select-none">Joriy ish</p>
          </div>
          <p className="text-sm font-medium text-foreground leading-snug">{task.name}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground/50 mt-0.5 truncate">{task.description}</p>
          )}
          {task.dueDate && (() => {
            const { text, overdue } = formatDueDate(task.dueDate);
            return <p className={cn('text-[10px] mt-0.5', overdue ? 'text-red-400/70' : 'text-muted-foreground/40')}>{text}</p>;
          })()}
        </div>
        <button
          onClick={onDeactivate}
          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors p-0.5 mt-0.5 shrink-0"
          aria-label="Bekor qilish"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Subtasks */}
      {(task.subtasks ?? []).length > 0 && (
        <div className="flex flex-col gap-1">
          {task.subtasks.map(sub => (
            <button
              key={sub.id}
              onClick={() => toggleSubtask(task.id, sub.id)}
              className="flex items-center gap-2 text-left"
            >
              <span className={cn('size-3 rounded border flex-shrink-0 flex items-center justify-center', sub.done ? 'bg-primary/30 border-primary/40' : 'border-border/50')}>
                {sub.done && <Check className="size-2 text-primary" />}
              </span>
              <span className={cn('text-xs', sub.done ? 'line-through text-muted-foreground/30' : 'text-foreground/60')}>{sub.text}</span>
            </button>
          ))}
          {totalSubtasks > 0 && (
            <p className="text-[10px] text-muted-foreground/30">{doneSubtasks}/{totalSubtasks} ✓</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <TomatoDots completed={task.completedPomodoros} estimated={task.estimatedPomodoros} max={6} />
        <span className="text-[10px] tabular-nums text-muted-foreground/50 shrink-0">
          {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
        </span>
      </div>

      <Button
        variant="outline"
        size="xs"
        onClick={onComplete}
        className="w-full gap-1.5 text-primary border-primary/25 hover:bg-primary/10"
      >
        <CheckCircle2 className="size-3" />
        Tugatish
      </Button>
    </div>
  );
}

// ─── Edit Task Form ────────────────────────────────────────────────────────────

function EditTaskForm({ task, onSave, onCancel }: {
  task: Task;
  onSave: (patch: Partial<Pick<Task, 'name' | 'description' | 'estimatedPomodoros' | 'priority' | 'dueDate'>>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [desc, setDesc] = useState(task.description);
  const [est, setEst] = useState(task.estimatedPomodoros);
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: desc.trim(),
      estimatedPomodoros: est,
      priority,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
    });
  };

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <input
        ref={nameRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        className="bg-transparent text-sm focus:outline-none border-b border-border/50 pb-0.5 w-full"
      />
      <input
        value={desc}
        onChange={e => setDesc(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Tasnif..."
        className="bg-transparent text-xs text-muted-foreground focus:outline-none border-b border-border/30 pb-0.5 w-full placeholder:text-muted-foreground/30"
      />
      {/* Priority + Due Date */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['high', 'medium', 'low'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriority(priority === p ? null : p)}
              className={cn('w-2.5 h-2.5 rounded-full border-2 transition-all', PRIORITY_COLORS[p], priority === p ? 'border-foreground/50 scale-125' : 'border-transparent opacity-50')}
              title={p}
            />
          ))}
        </div>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="bg-transparent text-[10px] text-muted-foreground/50 focus:outline-none border-b border-border/20 pb-0.5"
        />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <button onClick={() => setEst(e => Math.max(1, e - 1))} className="size-4 rounded flex items-center justify-center hover:bg-border/50 transition-colors">
            <ChevronDown className="size-3" />
          </button>
          <span className="tabular-nums w-4 text-center text-foreground/70">{est}</span>
          <button onClick={() => setEst(e => Math.min(20, e + 1))} className="size-4 rounded flex items-center justify-center hover:bg-border/50 transition-colors">
            <ChevronUp className="size-3" />
          </button>
          <span>🍅</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onCancel}><X className="size-3" /></Button>
          <Button variant="outline" size="icon-xs" onClick={submit} disabled={!name.trim()}><Check className="size-3" /></Button>
        </div>
      </div>
    </div>
  );
}

// ─── Subtasks Panel ───────────────────────────────────────────────────────────

function SubtasksPanel({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const { addSubtask, toggleSubtask, removeSubtask } = useTasks();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (!input.trim()) return;
    addSubtask(taskId, input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col gap-1 pl-4 pt-1">
      {subtasks.map(sub => (
        <div key={sub.id} className="flex items-center gap-1.5 group">
          <button onClick={() => toggleSubtask(taskId, sub.id)} className={cn('size-3 rounded border flex-shrink-0', sub.done ? 'bg-primary/30 border-primary/40' : 'border-border/50')} />
          <span className={cn('text-xs flex-1 min-w-0', sub.done ? 'line-through text-muted-foreground/30' : 'text-foreground/60')}>{sub.text}</span>
          <button onClick={() => removeSubtask(taskId, sub.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-destructive/50 transition-all">
            <X className="size-2.5" />
          </button>
        </div>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        placeholder="Kichik ish qo'shish..."
        className="text-xs bg-transparent focus:outline-none text-muted-foreground/50 placeholder:text-muted-foreground/25 border-b border-border/20 pb-0.5"
      />
    </div>
  );
}

// ─── Task Row (sortable) ──────────────────────────────────────────────────────

function SortableTaskRow({ task, onActivate, onComplete, onRemove, onEdit }: {
  task: Task;
  onActivate: () => void;
  onComplete: () => void;
  onRemove: () => void;
  onEdit: (patch: Partial<Pick<Task, 'name' | 'description' | 'estimatedPomodoros' | 'priority' | 'dueDate'>>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div className="flex items-start gap-1 p-2 rounded-xl hover:bg-border/20 transition-colors duration-150 group">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-0.5 text-muted-foreground/20 hover:text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="size-3" />
        </button>

        {/* Priority indicator */}
        {task.priority && (
          <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_COLORS[task.priority])} />
        )}

        {/* Radio circle */}
        <button
          onClick={onActivate}
          className="mt-0.5 shrink-0 transition-colors text-muted-foreground/30 hover:text-primary/60"
          aria-label="Tanlash"
        >
          <Circle className="size-4" />
        </button>

        {/* Content */}
        {editing ? (
          <EditTaskForm
            task={task}
            onSave={patch => { onEdit(patch); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex-1 min-w-0 cursor-pointer py-0.5" onClick={() => { onActivate(); }}>
            <p className="text-sm truncate select-none leading-tight text-foreground/70">{task.name}</p>
            {task.description && (
              <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5">{task.description}</p>
            )}
            {dueInfo && (
              <p className={cn('text-[10px] mt-0.5', dueInfo.overdue ? 'text-red-400/70' : 'text-muted-foreground/40')}>{dueInfo.text}</p>
            )}
          </div>
        )}

        {/* Right side */}
        {!editing && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {(task.subtasks ?? []).length > 0 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                >
                  <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded hover:text-primary text-muted-foreground/30 transition-colors"
                aria-label="Tahrirlash"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={onRemove}
                className="p-1 rounded hover:text-destructive text-muted-foreground/30 transition-colors"
                aria-label="O'chirish"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="flex flex-col items-end gap-0.5 ml-1">
              <span className="text-[10px] tabular-nums text-muted-foreground/35 leading-none">
                {task.completedPomodoros}/{task.estimatedPomodoros}🍅
              </span>
              <button
                onClick={onComplete}
                className="p-0.5 rounded hover:text-primary text-muted-foreground/25 transition-colors"
                aria-label="Bajarildi"
              >
                <CheckCircle2 className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded subtasks */}
      {expanded && (task.subtasks ?? []).length > 0 && (
        <SubtasksPanel taskId={task.id} subtasks={task.subtasks ?? []} />
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-8 select-none">
      <div className="text-4xl opacity-30">📋</div>
      <div className="text-center">
        <p className="text-sm text-foreground/50 font-medium mb-1">Ishlar ro'yxati bo'sh</p>
        <p className="text-xs text-muted-foreground/40">Boshlash uchun 3 ta qadam:</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[220px]">
        {[
          { num: '1', text: 'Quyida ish nomini kiriting' },
          { num: '2', text: "Ro'yxatdan ishni tanlang" },
          { num: '3', text: 'Taymerini ishga tushiring' },
        ].map(step => (
          <div key={step.num} className="flex items-center gap-3">
            <span className="size-5 rounded-full border border-border/50 text-[10px] text-muted-foreground/50 flex items-center justify-center shrink-0">{step.num}</span>
            <span className="text-xs text-muted-foreground/50">{step.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add Task Form (fixed bottom) ─────────────────────────────────────────────

function AddTaskFormFixed({ onAdd }: { onAdd: (name: string, desc: string, est: number) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [est, setEst] = useState(4);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), desc.trim(), est);
    setName('');
    setDesc('');
    setEst(4);
    inputRef.current?.focus();
  };

  return (
    <div className="shrink-0 border-t border-border/30 pt-3 flex flex-col gap-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
        <Plus className="size-3" /> Yangi ish
      </p>
      <input
        ref={inputRef}
        placeholder="Task nomi..."
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        className="bg-background/20 border border-border/40 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
      />
      <div className="flex items-center gap-2">
        <input
          placeholder="Tasnif (ixtiyoriy)..."
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className="flex-1 min-w-0 bg-transparent text-xs placeholder:text-muted-foreground/25 focus:outline-none text-muted-foreground"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEst(e => Math.max(1, e - 1))} className="size-4 rounded flex items-center justify-center hover:bg-border/50 text-muted-foreground/40 transition-colors">
            <ChevronDown className="size-3" />
          </button>
          <span className="text-xs tabular-nums text-foreground/60 w-4 text-center">{est}</span>
          <button onClick={() => setEst(e => Math.min(20, e + 1))} className="size-4 rounded flex items-center justify-center hover:bg-border/50 text-muted-foreground/40 transition-colors">
            <ChevronUp className="size-3" />
          </button>
          <span className="text-xs">🍅</span>
        </div>
        <Button variant="outline" size="xs" onClick={submit} disabled={!name.trim()} className="shrink-0">
          Qo'shish
        </Button>
      </div>
    </div>
  );
}

// ─── Completed Section ────────────────────────────────────────────────────────

function CompletedSection({ groups, totalPomodoros, count, onRemove, onClearAll }: {
  groups: { label: string; tasks: Task[] }[];
  totalPomodoros: number;
  count: number;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const handleClearClick = () => {
    if (confirmClear) { onClearAll(); setConfirmClear(false); }
    else setConfirmClear(true);
  };

  return (
    <div className="shrink-0 mt-2">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full py-2 text-left">
        <div className="flex items-center gap-1.5">
          <ListChecks className="size-3 text-muted-foreground/30" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">Bajarildi ({count})</span>
          {totalPomodoros > 0 && <span className="text-[10px] text-muted-foreground/30">· {totalPomodoros} 🍅</span>}
        </div>
        {open ? <ChevronUp className="size-3 text-muted-foreground/30" /> : <ChevronDown className="size-3 text-muted-foreground/30" />}
      </button>
      {open && (
        <div className="flex flex-col gap-3 pb-2">
          <button onClick={handleClearClick} className={cn('text-[10px] text-right transition-colors', confirmClear ? 'text-destructive/70 font-medium' : 'text-muted-foreground/30 hover:text-destructive/50')}>
            {confirmClear ? 'Ishonchingiz komilmi?' : "Barchasini o'chirish"}
          </button>
          {groups.map(group => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="text-[10px] text-muted-foreground/25 px-1 mb-0.5">{group.label}</p>
              {group.tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-border/10 group/done transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="size-3 text-primary/30 shrink-0" />
                    <span className="text-xs text-muted-foreground/45 truncate">{task.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/25 tabular-nums">{task.completedPomodoros}🍅</span>
                    <button onClick={() => onRemove(task.id)} className="text-muted-foreground/20 hover:text-destructive/50 transition-colors opacity-0 group-hover/done:opacity-100" aria-label="O'chirish">
                      <X className="size-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task Panel ───────────────────────────────────────────────────────────────

export function TaskPanel({ open, onOpenChange }: TaskPanelProps) {
  const {
    tasks, activeTaskId, activeTask,
    addTask, editTask, removeTask,
    setActiveTask, completeTask, clearCompleted, replaceTasks, reorderTasks,
  } = useTasks();

  const { addTaskCompleted } = useStats();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleComplete = (id: string) => {
    completeTask(id);
    addTaskCompleted();
  };

  const handleExport = async () => {
    await dialogApi.exportTasks();
  };

  const handleImport = async () => {
    const imported = await dialogApi.importTasks();
    if (imported) replaceTasks(imported);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const pending = tasks.filter(t => !t.completedAt && t.id !== activeTaskId);
    const completed = tasks.filter(t => !!t.completedAt);
    const oldIndex = pending.findIndex(t => t.id === active.id);
    const newIndex = pending.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pending, oldIndex, newIndex);
    const activeTaskList = activeTask ? [activeTask] : [];
    reorderTasks([...activeTaskList, ...reordered, ...completed]);
  };

  const pending = tasks.filter(t => !t.completedAt && t.id !== activeTaskId);
  const filtered = showSearch && search
    ? pending.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : pending;

  // Sort by priority: high → medium → low → null
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
    const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
    return pa - pb;
  });

  const completed = tasks.filter(t => !!t.completedAt);
  const completedGroups = groupByDate(completed);
  const totalPomodoros = completed.reduce((s, t) => s + t.completedPomodoros, 0);
  const showEmpty = !activeTask && pending.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title="Ishlar" className="fixed z-50 left-0 bottom-0 w-[360px] bg-background border-r border-border/30 shadow-xl flex flex-col outline-none">
          <div className="flex-1 flex flex-col min-h-0 p-5 gap-4">

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-3.5 text-muted-foreground/60" />
                <span className="text-xs font-medium tracking-widest uppercase text-muted-foreground/60">Ishlar</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant={showSearch ? 'outline' : 'ghost'} size="icon-xs" onClick={() => setShowSearch(s => !s)} aria-label="Qidirish">
                  <Search className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={handleExport} aria-label="Eksport" title="JSON eksport">
                  <Download className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={handleImport} aria-label="Import" title="JSON import">
                  <Upload className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onOpenChange(false)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Search */}
            {showSearch && (
              <input
                autoFocus
                placeholder="Ish nomi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setShowSearch(false)}
                className="shrink-0 bg-background/20 border border-border/40 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            )}

            {/* Active task card */}
            {activeTask && (
              <ActiveTaskCard
                task={activeTask}
                onDeactivate={() => setActiveTask(null)}
                onComplete={() => handleComplete(activeTask.id)}
              />
            )}

            {/* Sortable list */}
            <div className="flex-1 flex flex-col min-h-0 gap-1 overflow-y-auto pr-1">
              {showEmpty && <EmptyState />}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {sorted.map(task => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      onActivate={() => setActiveTask(task.id)}
                      onComplete={() => handleComplete(task.id)}
                      onRemove={() => removeTask(task.id)}
                      onEdit={patch => editTask(task.id, patch)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {completed.length > 0 && (
                <CompletedSection
                  groups={completedGroups}
                  totalPomodoros={totalPomodoros}
                  count={completed.length}
                  onRemove={removeTask}
                  onClearAll={clearCompleted}
                />
              )}
            </div>

            {/* Fixed bottom: add task form */}
            <AddTaskFormFixed onAdd={(name, desc, est) => addTask(name, desc, est)} />

          </div>
      </SheetContent>
    </Sheet>
  );
}
