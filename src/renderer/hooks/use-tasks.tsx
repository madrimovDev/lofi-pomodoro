import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { type Subtask, type Task } from '@shared/types';

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

  useEffect(() => {
    Promise.all([
      window.electronApi?.getTasks(),
      window.electronApi?.getActiveTaskId(),
    ])
      .then(([t, id]) => {
        if (t) setTasksState(t);
        if (id !== undefined) setActiveTaskIdState(id ?? null);
      })
      .catch(err => console.error('tasks init failed:', err));
  }, []);

  function saveTasks(next: Task[]) {
    setTasksState(next);
    window.electronApi?.setTasks(next);
  }

  function saveActiveTaskId(id: string | null) {
    setActiveTaskIdState(id);
    window.electronApi?.setActiveTaskId(id);
  }

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
    saveTasks([...tasks, task]);
  };

  const editTask = (id: string, patch: Partial<Pick<Task, 'name' | 'description' | 'estimatedPomodoros' | 'priority' | 'dueDate'>>) => {
    saveTasks(tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTask = (id: string) => {
    saveTasks(tasks.filter(t => t.id !== id));
    if (activeTaskId === id) saveActiveTaskId(null);
  };

  const setActiveTask = (id: string | null) => {
    saveActiveTaskId(id);
  };

  const completeTask = (id: string) => {
    saveTasks(tasks.map(t => t.id === id ? { ...t, completedAt: Date.now() } : t));
    if (activeTaskId === id) saveActiveTaskId(null);
  };

  const incrementPomodoro = (id: string) => {
    saveTasks(tasks.map(t => t.id === id
      ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
      : t
    ));
  };

  const moveTask = (id: string, direction: 'up' | 'down') => {
    const pending = tasks.filter(t => !t.completedAt);
    const completed = tasks.filter(t => !!t.completedAt);
    const idx = pending.findIndex(t => t.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= pending.length) return;
    const reordered = [...pending];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    saveTasks([...reordered, ...completed]);
  };

  const clearCompleted = () => {
    saveTasks(tasks.filter(t => !t.completedAt));
  };

  const replaceTasks = (newTasks: Task[]) => {
    saveTasks(newTasks);
    saveActiveTaskId(null);
  };

  const reorderTasks = (newOrder: Task[]) => {
    saveTasks(newOrder);
  };

  const addSubtask = (taskId: string, text: string) => {
    const subtask: Subtask = { id: crypto.randomUUID(), text, done: false };
    saveTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), subtask] } : t));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    saveTasks(tasks.map(t =>
      t.id === taskId
        ? { ...t, subtasks: (t.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) }
        : t
    ));
  };

  const removeSubtask = (taskId: string, subtaskId: string) => {
    saveTasks(tasks.map(t =>
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
