import { useState } from 'react';
import {
  FolderOpen, SkipBack, SkipForward, Play, Pause,
  RefreshCw, MonitorPlay, AlertCircle, Loader2, Shuffle, ArrowDownAZ,
  Volume2, Music2, ChevronRight,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useMusic } from '@renderer/hooks/use-music';
import { cn } from '@shared/lib/utils';

type Tab = 'folder' | 'youtube';

// ─── Now Playing Bar ─────────────────────────────────────────────────────────

function NowPlayingBar() {
  const { source, isPlaying, play, pause, next, prev,
    files, currentFileIndex, ytPlaylist, ytCurrentIndex,
    ytStreamInfo, ytLoading, config, setVolume } = useMusic();

  const trackName = source === 'folder'
    ? files[currentFileIndex]?.name.replace(/\.[^.]+$/, '')
    : ytStreamInfo?.title ?? null;

  const trackCount = source === 'folder'
    ? files.length
    : ytPlaylist.length;

  const currentIndex = source === 'folder' ? currentFileIndex : ytCurrentIndex;

  if (!source && !ytLoading) return null;

  return (
    <div className="border-t border-border/30 pt-3 flex flex-col gap-2.5 shrink-0">
      {/* Track info */}
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {ytLoading
            ? <Loader2 className="size-3.5 animate-spin text-primary/50" />
            : <Music2 className="size-3.5 text-primary/50" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground/80 truncate">
            {trackName ?? (ytLoading ? 'Yuklanmoqda...' : '—')}
          </p>
          {trackCount > 0 && (
            <p className="text-[10px] text-muted-foreground/40 tabular-nums">
              {currentIndex + 1} / {trackCount}
            </p>
          )}
        </div>
      </div>

      {/* Controls + Volume */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-xs" onClick={prev}>
          <SkipBack className="size-3" />
        </Button>
        <Button variant="outline" size="icon-xs" onClick={isPlaying ? pause : play} disabled={ytLoading}>
          {ytLoading
            ? <Loader2 className="size-3 animate-spin" />
            : isPlaying ? <Pause className="size-3" /> : <Play className="size-3 translate-x-px" />
          }
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={next}>
          <SkipForward className="size-3" />
        </Button>
        <div className="flex items-center gap-1.5 flex-1 ml-1">
          <Volume2 className="size-3 text-muted-foreground/30 shrink-0" />
          <input
            type="range" min={0} max={1} step={0.02}
            value={config.volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Folder Tab ───────────────────────────────────────────────────────────────

function FolderTab() {
  const { config, updateConfig, files, currentFileIndex, pickFolder, refreshFiles, playFile, isPlaying, source } = useMusic();

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Folder picker row */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="xs" onClick={pickFolder} className="flex-1 gap-1.5 text-xs">
          <FolderOpen className="size-3.5" />
          {config.folderPath ? 'Papkani o\'zgartirish' : 'Papka tanlash'}
        </Button>
        {config.folderPath && (
          <>
            <Button
              variant="ghost" size="icon-xs"
              title={config.sortMode === 'shuffle' ? 'Shuffle' : 'Alifbo'}
              onClick={() => updateConfig({ sortMode: config.sortMode === 'shuffle' ? 'alphabetical' : 'shuffle' })}
            >
              {config.sortMode === 'shuffle'
                ? <Shuffle className="size-3.5" />
                : <ArrowDownAZ className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={refreshFiles} title="Yangilash">
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {config.folderPath && (
        <p className="text-[10px] text-muted-foreground/30 truncate shrink-0">
          {config.folderPath}
        </p>
      )}

      {/* Track list */}
      {files.length === 0 && config.folderPath ? (
        <p className="text-xs text-muted-foreground/30 text-center py-6 select-none">
          Audio fayllar topilmadi
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
          {files.map((file, i) => {
            const isActive = i === currentFileIndex && source === 'folder';
            return (
              <button
                key={file.url}
                onClick={() => playFile(i)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs w-full',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground/50 hover:bg-border/20 hover:text-muted-foreground',
                )}
              >
                <span className={cn(
                  'shrink-0 text-[10px] w-4 tabular-nums',
                  isActive ? 'text-primary' : 'text-muted-foreground/30',
                )}>
                  {isActive && isPlaying ? '♪' : i + 1}
                </span>
                <span className="truncate">{file.name.replace(/\.[^.]+$/, '')}</span>
              </button>
            );
          })}
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

  if (ytAvailable === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  if (!ytAvailable) {
    return (
      <div className="flex flex-col gap-3 items-center text-center py-6">
        <AlertCircle className="size-8 text-muted-foreground/20" />
        <div>
          <p className="text-sm text-muted-foreground/50">yt-dlp topilmadi</p>
          <p className="text-xs text-muted-foreground/30 mt-1">
            <code className="bg-border/30 px-1 rounded">pip install yt-dlp</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* URL input */}
      <div className="flex gap-2 shrink-0">
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadYoutube(inputUrl.trim())}
          placeholder="YouTube URL yoki playlist..."
          className="flex-1 bg-background/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          variant="outline" size="icon-xs"
          onClick={() => loadYoutube(inputUrl.trim())}
          disabled={ytLoading || !inputUrl.trim()}
        >
          {ytLoading ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
        </Button>
      </div>

      {ytError && (
        <p className="text-xs text-destructive/60 flex items-center gap-1.5 shrink-0">
          <AlertCircle className="size-3 shrink-0" /> {ytError}
        </p>
      )}

      {/* Single stream */}
      {ytStreamInfo && ytPlaylist.length === 0 && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <MonitorPlay className="size-3.5 text-primary/50 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-foreground/70 truncate">{ytStreamInfo.title}</p>
            {ytStreamInfo.isLive && <p className="text-[10px] text-red-400/70">🔴 Live</p>}
          </div>
        </div>
      )}

      {/* Playlist */}
      {ytPlaylist.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
          {ytPlaylist.map((item, i) => {
            const isActive = i === ytCurrentIndex && source === 'youtube';
            return (
              <button
                key={item.id}
                onClick={() => playYtTrack(i)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs w-full',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground/50 hover:bg-border/20 hover:text-muted-foreground',
                )}
              >
                <span className={cn(
                  'shrink-0 text-[10px] w-4 tabular-nums',
                  isActive ? 'text-primary' : 'text-muted-foreground/30',
                )}>
                  {isActive && isPlaying ? '♪' : i + 1}
                </span>
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Side Panel ──────────────────────────────────────────────────────────

export function MusicSidePanel() {
  const [tab, setTab] = useState<Tab>('folder');

  return (
    <div className="w-[360px] shrink-0 border-l border-border/20 flex flex-col pt-10 animate-in slide-in-from-right-4 duration-200">
      <div className="flex-1 flex flex-col gap-4 p-5 min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Music2 className="size-3.5 text-muted-foreground/60" />
            <span className="text-xs font-medium tracking-widest uppercase text-muted-foreground/60">
              Musiqa
            </span>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-border/20">
            {(['folder', 'youtube'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider transition-colors duration-150',
                  tab === t
                    ? 'bg-background/60 text-foreground'
                    : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                )}
              >
                {t === 'folder' ? 'Papka' : 'YouTube'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {tab === 'folder' ? <FolderTab /> : <YoutubeTab />}
        </div>

        {/* Now playing + controls */}
        <NowPlayingBar />
      </div>
    </div>
  );
}
