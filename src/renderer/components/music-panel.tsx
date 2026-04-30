import { useState, useRef } from 'react';
import { Dialog } from 'radix-ui';
import {
  X, Music2, FolderOpen, SkipBack, SkipForward, Play, Pause,
  RefreshCw, MonitorPlay, AlertCircle, Loader2, Shuffle, ArrowDownAZ,
  Volume2,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useMusic } from '@renderer/hooks/use-music';
import { cn } from '@shared/lib/utils';

interface MusicPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'folder' | 'youtube';

// ─── Volume Slider ────────────────────────────────────────────────────────────

function VolumeRow() {
  const { config, setVolume } = useMusic();
  return (
    <div className="flex items-center gap-2 px-1">
      <Volume2 className="size-3 text-muted-foreground/40 shrink-0" />
      <input
        type="range" min={0} max={1} step={0.02}
        value={config.volume}
        onChange={e => setVolume(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
    </div>
  );
}

// ─── Playback Controls ────────────────────────────────────────────────────────

function PlaybackBar() {
  const { source, isPlaying, play, pause, next, prev, files, ytPlaylist,
    currentFileIndex, ytCurrentIndex, ytStreamInfo, ytLoading } = useMusic();

  const hasContent = (source === 'folder' && files.length > 0)
    || (source === 'youtube' && (ytStreamInfo || ytLoading));

  const currentName = source === 'folder'
    ? files[currentFileIndex]?.name.replace(/\.[^.]+$/, '')
    : ytStreamInfo?.title ?? (ytLoading ? 'Yuklanmoqda...' : null);

  const trackInfo = source === 'folder' && files.length > 1
    ? `${currentFileIndex + 1} / ${files.length}`
    : source === 'youtube' && ytPlaylist.length > 1
      ? `${ytCurrentIndex + 1} / ${ytPlaylist.length}`
      : null;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {currentName && (
            <p className="text-xs text-foreground/70 truncate">{currentName}</p>
          )}
          {trackInfo && (
            <p className="text-[10px] text-muted-foreground/40 tabular-nums">{trackInfo}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon-xs" onClick={prev} disabled={!hasContent}>
            <SkipBack className="size-3" />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={isPlaying ? pause : play} disabled={ytLoading}>
            {ytLoading
              ? <Loader2 className="size-3 animate-spin" />
              : isPlaying ? <Pause className="size-3" /> : <Play className="size-3 translate-x-px" />
            }
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={next} disabled={!hasContent}>
            <SkipForward className="size-3" />
          </Button>
        </div>
      </div>
      <VolumeRow />
    </div>
  );
}

// ─── Folder Tab ───────────────────────────────────────────────────────────────

function FolderTab() {
  const { config, updateConfig, files, currentFileIndex, pickFolder, refreshFiles, playFile, isPlaying, source } = useMusic();

  const sortMode = config.sortMode;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="xs" onClick={pickFolder} className="flex-1 gap-1.5">
          <FolderOpen className="size-3.5" />
          {config.folderPath ? 'Papkani o\'zgartirish' : 'Papka tanlash'}
        </Button>
        {config.folderPath && (
          <>
            <Button
              variant="ghost" size="icon-xs"
              onClick={() => updateConfig({ sortMode: sortMode === 'shuffle' ? 'alphabetical' : 'shuffle' })}
              title={sortMode === 'shuffle' ? 'Shuffle' : 'Alifbo'}
            >
              {sortMode === 'shuffle'
                ? <Shuffle className="size-3.5" />
                : <ArrowDownAZ className="size-3.5" />
              }
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={refreshFiles} title="Yangilash">
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {config.folderPath && (
        <p className="text-[10px] text-muted-foreground/40 truncate px-0.5">
          📁 {config.folderPath}
        </p>
      )}

      {files.length === 0 && config.folderPath && (
        <p className="text-xs text-muted-foreground/40 text-center py-3 select-none">
          Audio fayllar topilmadi
        </p>
      )}

      {files.length > 0 && (
        <div className="flex flex-col max-h-44 overflow-y-auto gap-0.5">
          {files.map((file, i) => (
            <button
              key={file.url}
              onClick={() => playFile(i)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs',
                i === currentFileIndex && source === 'folder'
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground/60 hover:bg-border/20 hover:text-muted-foreground',
              )}
            >
              {i === currentFileIndex && source === 'folder' && isPlaying
                ? <span className="text-primary shrink-0">♪</span>
                : <span className="w-3 shrink-0 text-[10px] tabular-nums text-muted-foreground/30">{i + 1}</span>
              }
              <span className="truncate">{file.name.replace(/\.[^.]+$/, '')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── YouTube Tab ──────────────────────────────────────────────────────────────

function YoutubeTab() {
  const {
    config, ytAvailable, ytPlaylist, ytCurrentIndex, ytStreamInfo,
    ytLoading, ytError, loadYoutube, playYtTrack, source, isPlaying,
  } = useMusic();

  const [inputUrl, setInputUrl] = useState(config.youtubeUrl ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => {
    const url = inputUrl.trim();
    if (!url) return;
    loadYoutube(url);
  };

  if (ytAvailable === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  if (!ytAvailable) {
    return (
      <div className="flex flex-col gap-3 items-center text-center py-4">
        <AlertCircle className="size-8 text-muted-foreground/20" />
        <div>
          <p className="text-sm text-muted-foreground/60">yt-dlp o'rnatilmagan</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Terminalda: <code className="bg-border/30 px-1 rounded">pip install yt-dlp</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
          placeholder="YouTube URL yoki playlist..."
          className="flex-1 bg-background/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button variant="outline" size="xs" onClick={handleLoad} disabled={ytLoading || !inputUrl.trim()}>
          {ytLoading ? <Loader2 className="size-3 animate-spin" /> : 'Ijro'}
        </Button>
      </div>

      {ytError && (
        <div className="flex items-center gap-2 text-xs text-destructive/70">
          <AlertCircle className="size-3 shrink-0" />
          <span>{ytError}</span>
        </div>
      )}

      {/* Single stream info */}
      {ytStreamInfo && ytPlaylist.length === 0 && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <MonitorPlay className="size-3.5 text-primary/70 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-foreground/80 truncate">{ytStreamInfo.title}</p>
            {ytStreamInfo.isLive && (
              <p className="text-[10px] text-red-400/70">🔴 Live</p>
            )}
          </div>
        </div>
      )}

      {/* Playlist */}
      {ytPlaylist.length > 0 && (
        <div className="flex flex-col max-h-44 overflow-y-auto gap-0.5">
          {ytPlaylist.map((item, i) => (
            <button
              key={item.id}
              onClick={() => playYtTrack(i)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs',
                i === ytCurrentIndex && source === 'youtube'
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground/60 hover:bg-border/20 hover:text-muted-foreground',
              )}
            >
              {i === ytCurrentIndex && source === 'youtube' && isPlaying
                ? <span className="text-primary shrink-0">♪</span>
                : <span className="w-3 shrink-0 text-[10px] tabular-nums text-muted-foreground/30">{i + 1}</span>
              }
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MusicPanel({ open, onOpenChange }: MusicPanelProps) {
  const [tab, setTab] = useState<Tab>('folder');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 glass w-80 rounded-2xl p-5 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Music2 className="size-3.5 text-muted-foreground" />
              <Dialog.Title className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                Musiqa
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Yopish">
                <X className="size-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-border/20">
            {(['folder', 'youtube'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs transition-colors duration-150',
                  tab === t
                    ? 'bg-background/60 text-foreground shadow-sm'
                    : 'text-muted-foreground/50 hover:text-muted-foreground/80',
                )}
              >
                {t === 'folder' ? '📁 Papka' : '▶ YouTube'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'folder' ? <FolderTab /> : <YoutubeTab />}

          {/* Shared playback controls */}
          <PlaybackBar />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
