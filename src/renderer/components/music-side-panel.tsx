import { useState } from 'react';
import {
  FolderOpen, SkipBack, SkipForward, Play, Pause,
  RefreshCw, MonitorPlay, AlertCircle, Loader2, Shuffle, ArrowDownAZ,
  Volume2, Music2, ChevronRight, BookmarkPlus, Trash2, ListMusic,
  Radio, Plus, X,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Sheet, SheetContent } from '@shared/components/ui/sheet';
import { useMusic } from '@renderer/hooks/use-music';
import { useSettings } from '@renderer/hooks/use-settings';
import { cn } from '@shared/lib/utils';
import { BUILT_IN_STATIONS, type RadioStation } from '@shared/types';

type Tab = 'folder' | 'youtube' | 'radio';

// ─── Now Playing Bar ─────────────────────────────────────────────────────────

function NowPlayingBar() {
  const { t } = useSettings();
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
            {trackName ?? (ytLoading ? t('loadingTrack') : '—')}
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
  const { t } = useSettings();
  const { config, updateConfig, files, currentFileIndex, pickFolder, refreshFiles, playFile, isPlaying, source, addFolder, removeFolder, loadFolder } = useMusic();

  const savedFolders = config.savedFolders ?? [];

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Saved folders */}
      {savedFolders.length > 0 && (
        <div className="flex flex-col gap-1 shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30">Saqlangan papkalar</p>
          {savedFolders.map(folder => (
            <div key={folder.id} className="flex items-center gap-1.5 group">
              <button
                onClick={() => loadFolder(folder)}
                className={cn(
                  'flex-1 text-left px-2 py-1 rounded-md text-xs truncate transition-colors',
                  config.folderPath === folder.path
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground/50 hover:bg-border/20 hover:text-muted-foreground',
                )}
              >
                {folder.name}
              </button>
              <button
                onClick={() => removeFolder(folder.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive/60 transition-all p-0.5"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Folder picker row */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="xs" onClick={addFolder} className="flex-1 gap-1.5 text-xs">
          <Plus className="size-3.5" />
          Papka qo'shish
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

      {!config.folderPath && savedFolders.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <FolderOpen className="size-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/30">Papka tanlang</p>
        </div>
      )}

      {/* Track list */}
      {files.length === 0 && config.folderPath ? (
        <p className="text-xs text-muted-foreground/30 text-center py-6 select-none">
          {t('noAudioFiles')}
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

// ─── Radio Tab ────────────────────────────────────────────────────────────────

function RadioTab() {
  const { config, source, currentRadio, radioError, playRadio, addRadioStation, removeRadioStation, isPlaying } = useMusic();
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const allStations: RadioStation[] = [
    ...BUILT_IN_STATIONS,
    ...(config.savedRadioStations ?? []),
  ];

  const handleAdd = () => {
    if (!newUrl.trim() || !newName.trim()) return;
    addRadioStation(newName.trim(), newUrl.trim(), 'Custom');
    setNewName('');
    setNewUrl('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
        {allStations.map(station => {
          const isActive = source === 'radio' && currentRadio?.id === station.id;
          return (
            <div key={station.id} className="flex items-center gap-2 group">
              <button
                onClick={() => playRadio(station)}
                className={cn(
                  'flex-1 flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                  isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground/50 hover:bg-border/20 hover:text-muted-foreground',
                )}
              >
                <span className={cn('text-[10px] mt-0.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/30')}>
                  {isActive && isPlaying ? '♪' : <Radio className="size-3" />}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate">{station.name}</span>
                  <span className="text-[10px] text-muted-foreground/30">{station.genre}</span>
                </div>
              </button>
              {!station.isBuiltIn && (
                <button
                  onClick={() => removeRadioStation(station.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive/60 transition-all p-0.5 shrink-0"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {radioError && (
        <p className="text-xs text-destructive/60 flex items-center gap-1.5 shrink-0">
          <AlertCircle className="size-3 shrink-0" /> {radioError}
        </p>
      )}

      {showAdd ? (
        <div className="flex flex-col gap-1.5 shrink-0">
          <input
            placeholder="Stansiya nomi..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="bg-background/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-1.5">
            <input
              placeholder="Stream URL..."
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-background/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
            />
            <Button variant="outline" size="icon-xs" onClick={handleAdd} disabled={!newUrl.trim() || !newName.trim()}>
              <Plus className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setShowAdd(false)}>
              <X className="size-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="xs" onClick={() => setShowAdd(true)} className="gap-1.5 text-xs text-muted-foreground/50 shrink-0">
          <Plus className="size-3" /> URL qo'shish
        </Button>
      )}
    </div>
  );
}

// ─── YouTube Tab ──────────────────────────────────────────────────────────────

function YoutubeTab() {
  const {
    config, ytAvailable, ytPlaylist, ytCurrentIndex, ytStreamInfo,
    ytLoading, ytError, loadYoutube, playYtTrack, source, isPlaying,
    addSavedPlaylist, removeSavedPlaylist, loadSavedPlaylist,
  } = useMusic();

  const [inputUrl, setInputUrl] = useState(config.youtubeUrl ?? '');
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!inputUrl.trim()) return;
    setSaving(true);
    await addSavedPlaylist(inputUrl.trim());
    setSaving(false);
    setInputUrl('');
  };

  const savedPlaylists = config.savedPlaylists ?? [];

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* URL input row */}
      <div className="flex gap-1.5 shrink-0">
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadYoutube(inputUrl.trim())}
          placeholder="YouTube URL yoki playlist..."
          className="flex-1 bg-background/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
        />
        <Button
          variant="outline" size="icon-xs"
          onClick={() => loadYoutube(inputUrl.trim())}
          disabled={ytLoading || !inputUrl.trim()}
          title="Ijro etish"
        >
          {ytLoading && !saving ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
        </Button>
        <Button
          variant="outline" size="icon-xs"
          onClick={handleSave}
          disabled={saving || ytLoading || !inputUrl.trim()}
          title="Saqlash"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
        </Button>
      </div>

      {ytError && (
        <p className="text-xs text-destructive/60 flex items-center gap-1.5 shrink-0">
          <AlertCircle className="size-3 shrink-0" /> {ytError}
        </p>
      )}

      {/* Single stream info */}
      {ytStreamInfo && ytPlaylist.length === 0 && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <MonitorPlay className="size-3.5 text-primary/50 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-foreground/70 truncate">{ytStreamInfo.title}</p>
            {ytStreamInfo.isLive && <p className="text-[10px] text-red-400/70">🔴 Live</p>}
          </div>
        </div>
      )}

      {/* Active playlist tracks */}
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

      {/* Saved playlists */}
      {savedPlaylists.length > 0 && ytPlaylist.length === 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/30 mb-2 shrink-0 flex items-center gap-1.5">
            <ListMusic className="size-3" /> Saqlangan
          </p>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
            {savedPlaylists.map(playlist => (
              <div
                key={playlist.id}
                className="flex items-center gap-2.5 rounded-lg hover:bg-border/20 transition-colors p-1.5 group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-9 rounded-md bg-border/30 shrink-0 overflow-hidden flex items-center justify-center">
                  {playlist.thumbnailUrl
                    ? <img src={playlist.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <Music2 className="size-3 text-muted-foreground/30" />
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/70 truncate">{playlist.name}</p>
                  <p className="text-[10px] text-muted-foreground/30">
                    {playlist.itemCount > 0 ? `${playlist.itemCount} ta video` : '1 ta video'}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="icon-xs"
                    onClick={() => loadSavedPlaylist(playlist)}
                    title="Ijro etish"
                  >
                    <Play className="size-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon-xs"
                    onClick={() => removeSavedPlaylist(playlist.id)}
                    title="O'chirish"
                    className="text-destructive/50 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {savedPlaylists.length === 0 && ytPlaylist.length === 0 && !ytStreamInfo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <ListMusic className="size-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/30">
            URL kiritib <BookmarkPlus className="size-3 inline" /> bosing
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Side Panel ──────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = { folder: 'Papka', youtube: 'YouTube', radio: 'Radio' };

export function MusicSidePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('folder');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Musiqa" className="w-[360px] bg-background border-l border-border/30 shadow-xl flex flex-col outline-none">
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
              {(['folder', 'youtube', 'radio'] as Tab[]).map(t => (
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
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 flex flex-col min-h-0">
            {tab === 'folder' && <FolderTab />}
            {tab === 'youtube' && <YoutubeTab />}
            {tab === 'radio' && <RadioTab />}
          </div>

          {/* Now playing + controls */}
          <NowPlayingBar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
