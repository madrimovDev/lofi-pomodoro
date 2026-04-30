import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  DEFAULT_MUSIC_CONFIG,
  type AudioFile,
  type MusicConfig,
  type MusicSortMode,
  type YoutubePlaylistItem,
  type YoutubeStreamInfo,
} from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type MusicSource = 'folder' | 'youtube' | null;

interface MusicContextValue {
  // Config
  config: MusicConfig;
  updateConfig: (patch: Partial<MusicConfig>) => void;

  // Folder
  files: AudioFile[];
  currentFileIndex: number;
  refreshFiles: () => Promise<void>;
  pickFolder: () => Promise<void>;
  playFile: (index: number) => void;

  // YouTube
  ytAvailable: boolean | null; // null = checking
  ytPlaylist: YoutubePlaylistItem[];
  ytCurrentIndex: number;
  ytStreamInfo: YoutubeStreamInfo | null;
  ytLoading: boolean;
  ytError: string | null;
  loadYoutube: (url: string) => Promise<void>;
  playYtTrack: (index: number) => Promise<void>;

  // Playback (shared)
  source: MusicSource;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const MusicContext = createContext<MusicContextValue>({
  config: DEFAULT_MUSIC_CONFIG,
  updateConfig: () => {},
  files: [],
  currentFileIndex: 0,
  refreshFiles: async () => {},
  pickFolder: async () => {},
  playFile: () => {},
  ytAvailable: null,
  ytPlaylist: [],
  ytCurrentIndex: 0,
  ytStreamInfo: null,
  ytLoading: false,
  ytError: null,
  loadYoutube: async () => {},
  playYtTrack: async () => {},
  source: null,
  isPlaying: false,
  play: () => {},
  pause: () => {},
  next: () => {},
  prev: () => {},
  setVolume: () => {},
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortFiles(files: AudioFile[], mode: MusicSortMode): AudioFile[] {
  if (mode === 'shuffle') return shuffle(files);
  return [...files].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function MusicProvider({ children }: { children: ReactNode }): ReactElement {
  const [config, setConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [source, setSource] = useState<MusicSource>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // YouTube state
  const [ytAvailable, setYtAvailable] = useState<boolean | null>(null);
  const [ytPlaylist, setYtPlaylist] = useState<YoutubePlaylistItem[]>([]);
  const [ytCurrentIndex, setYtCurrentIndex] = useState(0);
  const [ytStreamInfo, setYtStreamInfo] = useState<YoutubeStreamInfo | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load config on mount
  useEffect(() => {
    window.electronApi?.getMusic().then(c => {
      if (c) setConfig({ ...DEFAULT_MUSIC_CONFIG, ...c });
    });
    window.electronApi?.ytCheck().then(ok => setYtAvailable(ok));
  }, []);

  // Load files when folder changes
  useEffect(() => {
    if (config.folderPath) {
      window.electronApi?.listMusicFiles(config.folderPath).then(f => {
        setFiles(sortFiles(f, config.sortMode));
        setCurrentFileIndex(0);
      });
    } else {
      setFiles([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.folderPath]);

  // Re-sort files when sort mode changes
  useEffect(() => {
    setFiles(prev => sortFiles(prev, config.sortMode));
    setCurrentFileIndex(0);
  }, [config.sortMode]);

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, config.volume));
    }
  }, [config.volume]);

  // ── Audio element management ──────────────────────────────────────────────

  function getOrCreateAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = config.volume;
      audio.addEventListener('ended', () => {
        // Auto-advance to next track
        if (source === 'folder') advanceFolderTrack();
        else if (source === 'youtube' && ytPlaylist.length > 0) {
          advanceYtTrack();
        }
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  const advanceFolderTrack = useCallback(() => {
    setCurrentFileIndex(prev => {
      const next = (prev + 1) % files.length;
      loadFolderTrack(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const advanceYtTrack = useCallback(() => {
    setYtCurrentIndex(prev => {
      const next = (prev + 1) % ytPlaylist.length;
      loadYtTrackByIndex(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytPlaylist]);

  function loadFolderTrack(index: number) {
    if (!files[index]) return;
    const audio = getOrCreateAudio();
    audio.src = files[index].url;
    audio.loop = files.length === 1; // loop single file, cycle if multiple
    audio.play().catch(() => {});
    setIsPlaying(true);
  }

  async function loadYtTrackByIndex(index: number) {
    const item = ytPlaylist[index];
    if (!item) return;
    setYtLoading(true);
    setYtError(null);
    const result = await window.electronApi?.ytGetStream(
      `https://www.youtube.com/watch?v=${item.id}`,
    );
    setYtLoading(false);
    if (!result || 'error' in result) {
      setYtError((result as { error: string })?.error ?? 'Xatolik');
      return;
    }
    const audio = getOrCreateAudio();
    audio.src = result.streamUrl;
    audio.loop = ytPlaylist.length === 1;
    audio.play().catch(() => {});
    setYtStreamInfo(result);
    setIsPlaying(true);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  const updateConfig = (patch: Partial<MusicConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    window.electronApi?.setMusic(next);
  };

  const refreshFiles = async () => {
    if (!config.folderPath) return;
    const f = await window.electronApi?.listMusicFiles(config.folderPath) ?? [];
    setFiles(sortFiles(f, config.sortMode));
    setCurrentFileIndex(0);
  };

  const pickFolder = async () => {
    const path = await window.electronApi?.pickMusicFolder();
    if (!path) return;
    updateConfig({ folderPath: path });
    const f = await window.electronApi?.listMusicFiles(path) ?? [];
    const sorted = sortFiles(f, config.sortMode);
    setFiles(sorted);
    setCurrentFileIndex(0);
  };

  const playFile = (index: number) => {
    setSource('folder');
    setCurrentFileIndex(index);
    loadFolderTrack(index);
  };

  const loadYoutube = async (url: string) => {
    setYtError(null);
    setYtLoading(true);
    setYtPlaylist([]);
    setYtCurrentIndex(0);
    setYtStreamInfo(null);

    // Try to get playlist info
    const playlistResult = await window.electronApi?.ytGetPlaylist(url);
    if (playlistResult && !('error' in playlistResult) && playlistResult.length > 1) {
      setYtPlaylist(playlistResult);
      updateConfig({ youtubeUrl: url });
      setSource('youtube');
      setYtLoading(false);
      // Load first track
      setYtCurrentIndex(0);
      await loadYtTrackByIndex(0);
      return;
    }

    // Single video or live stream
    const result = await window.electronApi?.ytGetStream(url);
    setYtLoading(false);
    if (!result || 'error' in result) {
      setYtError((result as { error: string })?.error ?? 'Xatolik yuz berdi');
      return;
    }
    setYtStreamInfo(result);
    updateConfig({ youtubeUrl: url });
    setSource('youtube');

    const audio = getOrCreateAudio();
    audio.src = result.streamUrl;
    audio.loop = true;
    audio.play().catch(() => {});
    setIsPlaying(true);
  };

  const playYtTrack = async (index: number) => {
    setYtCurrentIndex(index);
    await loadYtTrackByIndex(index);
  };

  const play = () => {
    if (!audioRef.current?.src) {
      // Auto-start from folder if available
      if (files.length > 0) {
        setSource('folder');
        loadFolderTrack(currentFileIndex);
      }
      return;
    }
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const next = () => {
    if (source === 'folder' && files.length > 0) {
      const idx = (currentFileIndex + 1) % files.length;
      setCurrentFileIndex(idx);
      loadFolderTrack(idx);
    } else if (source === 'youtube' && ytPlaylist.length > 0) {
      const idx = (ytCurrentIndex + 1) % ytPlaylist.length;
      setYtCurrentIndex(idx);
      loadYtTrackByIndex(idx);
    }
  };

  const prev = () => {
    if (source === 'folder' && files.length > 0) {
      const idx = (currentFileIndex - 1 + files.length) % files.length;
      setCurrentFileIndex(idx);
      loadFolderTrack(idx);
    } else if (source === 'youtube' && ytPlaylist.length > 0) {
      const idx = (ytCurrentIndex - 1 + ytPlaylist.length) % ytPlaylist.length;
      setYtCurrentIndex(idx);
      loadYtTrackByIndex(idx);
    }
  };

  const setVolume = (v: number) => updateConfig({ volume: v });

  // Cleanup
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <MusicContext.Provider value={{
      config, updateConfig,
      files, currentFileIndex, refreshFiles, pickFolder, playFile,
      ytAvailable, ytPlaylist, ytCurrentIndex, ytStreamInfo, ytLoading, ytError,
      loadYoutube, playYtTrack,
      source, isPlaying, play, pause, next, prev, setVolume,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
