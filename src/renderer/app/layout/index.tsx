import { useState } from 'react';
import { WindowControl } from '@renderer/components/window-control';
import { MusicSidePanel } from '@renderer/components/music-side-panel';
import { MainLayout } from './main';

export const Layout = () => {
  const [musicOpen, setMusicOpen] = useState(false);

  const handleToggleMusic = async () => {
    const open = await window.electronApi?.toggleMusicPanel();
    // Wait for the Electron viewport to reflect the new window size before
    // adding/removing the panel from the flex layout — prevents the timer
    // from jumping during the 1-2 frames where the layout and viewport are
    // out of sync after a window resize.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMusicOpen(open ?? false);
      });
    })
  };

  return (
    <div className="h-full flex flex-col">
      <WindowControl />
      <main className="flex-1 flex pt-10 min-h-0 overflow-hidden">
        <MainLayout onToggleMusic={handleToggleMusic} musicOpen={musicOpen} />
        {musicOpen && <MusicSidePanel />}
      </main>
    </div>
  );
};
