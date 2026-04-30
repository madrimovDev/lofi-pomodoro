import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { type Task } from '@shared/types';

interface TasksContextValue {
  tasks: Task[];
  activeTaskId: string | null;
  activeTask: Task | undefined;
  addTask: (name: string, description: string, estimatedPomodoros: number) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  completeTask: (id: string) => void;
  incrementPomodoro: (id: string) => void;
}

const TasksContext = createContext<TasksContextValue>({
  tasks: [],
  activeTaskId: null,
  activeTask: undefined,
  addTask: () => {},
  removeTask: () => {},
  setActiveTask: () => {},
  completeTask: () => {},
  incrementPomodoro: () => {},
});

export function TasksProvider({ children }: { children: ReactNode }): ReactElement {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      window.electronApi?.getTasks(),
      window.electronApi?.getActiveTaskId(),
    ]).then(([t, id]) => {
      if (t) setTasksState(t);
      if (id !== undefined) setActiveTaskIdState(id ?? null);
    });
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
    };
    saveTasks([...tasks, task]);
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

  const activeTask = tasks.find(t => t.id === activeTaskId && !t.completedAt);

  return (
    <TasksContext.Provider value={{
      tasks, activeTaskId, activeTask,
      addTask, removeTask, setActiveTask, completeTask, incrementPomodoro,
    }}>
      {children}
    </TasksContext.Provider>
  );
}

export const useTasks = () => useContext(TasksContext);
