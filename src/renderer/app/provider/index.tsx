import { Layout } from '../layout';
import { SettingsProvider } from '@renderer/hooks/use-settings';
import { TasksProvider } from '@renderer/hooks/use-tasks';
import { MusicProvider } from '@renderer/hooks/use-music';

export const AppProvider = () => (
  <SettingsProvider>
    <TasksProvider>
      <MusicProvider>
        <Layout />
      </MusicProvider>
    </TasksProvider>
  </SettingsProvider>
);
