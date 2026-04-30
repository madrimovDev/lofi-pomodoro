import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { X, Plus, Trash2, CheckCircle2, Dot, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useTasks } from '@renderer/hooks/use-tasks';
import { cn } from '@shared/lib/utils';
import type { Task } from '@shared/types';

interface TaskPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
}

function AddTaskForm({ onAdd, onCancel }: { onAdd: (name: string, desc: string, est: number) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [est, setEst] = useState(4);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), desc.trim(), est);
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl border border-border/50 bg-background/20">
      <input
        autoFocus
        placeholder="Task nomi..."
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        className="bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none"
      />
      <input
        placeholder="Tasnif (ixtiyoriy)..."
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="bg-transparent text-xs placeholder:text-muted-foreground/30 focus:outline-none text-muted-foreground"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <span>Taxminiy:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEst(e => Math.max(1, e - 1))}
              className="size-5 rounded flex items-center justify-center hover:bg-border/50 transition-colors"
            >
              <ChevronDown className="size-3" />
            </button>
            <span className="tabular-nums w-4 text-center text-foreground/70">{est}</span>
            <button
              onClick={() => setEst(e => Math.min(20, e + 1))}
              className="size-5 rounded flex items-center justify-center hover:bg-border/50 transition-colors"
            >
              <ChevronUp className="size-3" />
            </button>
            <span>pomodoro</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="xs" onClick={onCancel}>Bekor</Button>
          <Button variant="outline" size="xs" onClick={submit} disabled={!name.trim()}>Qo'shish</Button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, isActive, onActivate, onComplete, onRemove }: {
  task: Task;
  isActive: boolean;
  onActivate: () => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 p-2.5 rounded-xl transition-colors duration-200 group',
      isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-border/20',
    )}>
      <button
        onClick={onActivate}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label="Tanlash"
      >
        {isActive
          ? <Dot className="size-5 text-primary" />
          : <Dot className="size-5 opacity-30" />
        }
      </button>

      <div className="flex-1 min-w-0" onClick={onActivate}>
        <p className={cn('text-sm truncate cursor-pointer select-none', isActive && 'text-foreground font-medium')}>
          {task.name}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-0.5 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/50 transition-all duration-500"
              style={{ width: `${Math.min(task.completedPomodoros / task.estimatedPomodoros, 1) * 100}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/50 shrink-0">
            {task.completedPomodoros}/{task.estimatedPomodoros}
          </span>
        </div>
      </div>

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onComplete}
          className="p-1 rounded hover:text-primary transition-colors text-muted-foreground/50"
          aria-label="Bajarildi"
        >
          <CheckCircle2 className="size-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:text-destructive transition-colors text-muted-foreground/50"
          aria-label="O'chirish"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TaskPanel({ open, onOpenChange }: TaskPanelProps) {
  const { tasks, activeTaskId, addTask, removeTask, setActiveTask, completeTask } = useTasks();
  const [showAdd, setShowAdd] = useState(false);

  const pending = tasks.filter(t => !t.completedAt);
  const completed = tasks.filter(t => !!t.completedAt);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCompleted = completed.filter(t => (t.completedAt ?? 0) >= todayStart.getTime());
  const todayPomodoros = todayCompleted.reduce((s, t) => s + t.completedPomodoros, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 glass w-80 max-h-[80vh] flex flex-col rounded-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-3.5 text-muted-foreground" />
              <Dialog.Title className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                Ishlar
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Yopish">
                <X className="size-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3 min-h-0">

            {/* Pending tasks */}
            {pending.length === 0 && !showAdd && (
              <p className="text-xs text-muted-foreground/40 text-center py-4 select-none">
                Hali ish yo'q
              </p>
            )}

            {pending.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                onActivate={() => setActiveTask(task.id === activeTaskId ? null : task.id)}
                onComplete={() => completeTask(task.id)}
                onRemove={() => removeTask(task.id)}
              />
            ))}

            {/* Add form */}
            {showAdd && (
              <AddTaskForm
                onAdd={(name, desc, est) => {
                  addTask(name, desc, est);
                  setShowAdd(false);
                }}
                onCancel={() => setShowAdd(false)}
              />
            )}

            {/* Add button */}
            {!showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors py-1 w-full"
              >
                <Plus className="size-3.5" />
                <span>Yangi ish qo'shish</span>
              </button>
            )}

            {/* Today's history */}
            {todayCompleted.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40">Bugun bajarildi</p>
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                    {todayPomodoros} 🍅
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {todayCompleted.map(task => (
                    <div key={task.id} className="flex items-center justify-between py-1 px-2 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="size-3 text-primary/50 shrink-0" />
                        <span className="text-xs text-muted-foreground/50 truncate">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground/30 tabular-nums">
                          {task.completedPomodoros}🍅
                        </span>
                        <span className="text-[10px] text-muted-foreground/30">
                          {formatDate(task.completedAt!)}
                        </span>
                        <button
                          onClick={() => removeTask(task.id)}
                          className="text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors"
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
