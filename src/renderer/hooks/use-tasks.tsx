import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { type Subtask, type Task } from '@shared/types';
import { api } from '@shared/tauri/api';

interface TasksContextValue {
  tasks: Task[];
  activeTaskId: string | null;
  activeTask: Task | undefined;
  addTask: (name: string, description: string, estimatedPomodoros: number) => void;
  editTask: (id: string, patch: Partial<Pick<Task, 'name' | 'description' | 'estimatedPomodoros' | 'priority' | 'dueDate'>>) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  completeTask: (id: string) => void;
  incrementPomodoro: (id: string) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;
  clearCompleted: () => void;
  replaceTasks: (tasks: Task[]) => void;
  reorderTasks: (newOrder: Task[]) => void;
  addSubtask: (taskId: string, text: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;
}

const TasksContext = createContext<TasksContextValue>({
  tasks: [],
  activeTaskId: null,
  activeTask: undefined,
  addTask: () => {},
  editTask: () => {},
  removeTask: () => {},
  setActiveTask: () => {},
  completeTask: () => {},
  incrementPomodoro: () => {},
  moveTask: () => {},
  clearCompleted: () => {},
  replaceTasks: () => {},
  reorderTasks: () => {},
  addSubtask: () => {},
  toggleSubtask: () => {},
  removeSubtask: () => {},
});

export function TasksProvider({ children }: { children: ReactNode }): ReactElement {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);
  // Store'dan dastlabki yuklash tugaguncha persistlashni o'tkazib yuboramiz,
  // aks holda hydration paytida bo'sh holat saqlangan ma'lumotni o'chiradi.
  const hydratedRef = useRef(false);

  useEffect(() => {
    Promise.all([
      api.getTasks(),
      api.getActiveTaskId(),
    ])
      .then(([t, id]) => {
        if (t) setTasksState(t);
        if (id !== undefined) setActiveTaskIdState(id ?? null);
      })
      .catch(err => console.error('tasks init failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);

  // State o'zgarganda persistlash — functional update'lar bilan stale-closure'siz.
  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setTasks(tasks).catch(err => console.error('setTasks failed:', err));
  }, [tasks]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setActiveTaskId(activeTaskId).catch(err => console.error('setActiveTaskId failed:', err));
  }, [activeTaskId]);

  const addTask = (name: string, description: string, estimatedPomodoros: number) => {
    const task: Task = {
      id: crypto.randomUUID(),
      name,
      description,
      estimatedPomodoros,
      completedPomodoros: 0,
      createdAt: Date.now(),
      priority: null,
      dueDate: null,
      subtasks: [],
    };
    setTasksState(prev => [...prev, task]);
  };

  const editTask = (id: string, patch: Partial<Pick<Task, 'name' | 'description' | 'estimatedPomodoros' | 'priority' | 'dueDate'>>) => {
    setTasksState(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTask = (id: string) => {
    setTasksState(prev => prev.filter(t => t.id !== id));
    if (activeTaskId === id) setActiveTaskIdState(null);
  };

  const setActiveTask = (id: string | null) => {
    setActiveTaskIdState(id);
  };

  const completeTask = (id: string) => {
    setTasksState(prev => prev.map(t => t.id === id ? { ...t, completedAt: Date.now() } : t));
    if (activeTaskId === id) setActiveTaskIdState(null);
  };

  const incrementPomodoro = (id: string) => {
    setTasksState(prev => prev.map(t => t.id === id
      ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
      : t
    ));
  };

  const moveTask = (id: string, direction: 'up' | 'down') => {
    setTasksState(prev => {
      const pending = prev.filter(t => !t.completedAt);
      const completed = prev.filter(t => !!t.completedAt);
      const idx = pending.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= pending.length) return prev;
      const reordered = [...pending];
      [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
      return [...reordered, ...completed];
    });
  };

  const clearCompleted = () => {
    setTasksState(prev => prev.filter(t => !t.completedAt));
  };

  const replaceTasks = (newTasks: Task[]) => {
    setTasksState(newTasks);
    setActiveTaskIdState(null);
  };

  const reorderTasks = (newOrder: Task[]) => {
    setTasksState(newOrder);
  };

  const addSubtask = (taskId: string, text: string) => {
    const subtask: Subtask = { id: crypto.randomUUID(), text, done: false };
    setTasksState(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), subtask] } : t));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasksState(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, subtasks: (t.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) }
        : t
    ));
  };

  const removeSubtask = (taskId: string, subtaskId: string) => {
    setTasksState(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, subtasks: (t.subtasks ?? []).filter(s => s.id !== subtaskId) }
        : t
    ));
  };

  const activeTask = tasks.find(t => t.id === activeTaskId && !t.completedAt);

  return (
    <TasksContext.Provider value={{
      tasks, activeTaskId, activeTask,
      addTask, editTask, removeTask, setActiveTask, completeTask, incrementPomodoro,
      moveTask, clearCompleted, replaceTasks, reorderTasks,
      addSubtask, toggleSubtask, removeSubtask,
    }}>
      {children}
    </TasksContext.Provider>
  );
}

export const useTasks = () => useContext(TasksContext);
