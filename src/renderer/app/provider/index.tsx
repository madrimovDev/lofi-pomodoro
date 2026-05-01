import { Layout } from '../layout';
import { SettingsProvider } from '@renderer/hooks/use-settings';
import { TasksProvider } from '@renderer/hooks/use-tasks';
import { MusicProvider } from '@renderer/hooks/use-music';
import { StatsProvider } from '@renderer/hooks/use-stats';

export const AppProvider = () => (
  <SettingsProvider>
    <TasksProvider>
      <StatsProvider>
        <MusicProvider>
          <Layout />
        </MusicProvider>
      </StatsProvider>
    </TasksProvider>
  </SettingsProvider>
);
