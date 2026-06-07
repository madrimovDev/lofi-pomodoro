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
  type RadioStation,
  type SavedMusicFolder,
  type SavedYtPlaylist,
  type YoutubePlaylistItem,
  type YoutubeStreamInfo,
} from '@shared/types';
import { api } from '@shared/tauri/api';
import { musicApi } from '@shared/tauri/music';

// ─── Types ───────────────────────────────────────────────────────────────────

type MusicSource = 'folder' | 'youtube' | 'radio' | null;

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
  addFolder: () => Promise<void>;
  removeFolder: (id: string) => void;
  loadFolder: (folder: SavedMusicFolder) => Promise<void>;

  // YouTube
  ytAvailable: boolean | null; // null = checking
  ytPlaylist: YoutubePlaylistItem[];
  ytCurrentIndex: number;
  ytStreamInfo: YoutubeStreamInfo | null;
  ytLoading: boolean;
  ytError: string | null;
  loadYoutube: (url: string) => Promise<void>;
  playYtTrack: (index: number) => Promise<void>;

  // Radio
  currentRadio: RadioStation | null;
  radioError: string | null;
  playRadio: (station: RadioStation) => void;
  addRadioStation: (name: string, url: string, genre: string) => void;
  removeRadioStation: (id: string) => void;

  // Playback (shared)
  source: MusicSource;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;

  // Saved playlists
  addSavedPlaylist: (url: string) => Promise<void>;
  removeSavedPlaylist: (id: string) => void;
  loadSavedPlaylist: (playlist: SavedYtPlaylist) => Promise<void>;

  // Audio element ref (for visualizer)
  audioRef: React.RefObject<HTMLAudioElement | null>;
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
  addFolder: async () => {},
  removeFolder: () => {},
  loadFolder: async () => {},
  ytAvailable: null,
  ytPlaylist: [],
  ytCurrentIndex: 0,
  ytStreamInfo: null,
  ytLoading: false,
  ytError: null,
  loadYoutube: async () => {},
  playYtTrack: async () => {},
  currentRadio: null,
  radioError: null,
  playRadio: () => {},
  addRadioStation: () => {},
  removeRadioStation: () => {},
  source: null,
  isPlaying: false,
  play: () => {},
  pause: () => {},
  next: () => {},
  prev: () => {},
  setVolume: () => {},
  addSavedPlaylist: async () => {},
  removeSavedPlaylist: () => {},
  loadSavedPlaylist: async () => {},
  audioRef: { current: null },
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

  // Radio state
  const [currentRadio, setCurrentRadio] = useState<RadioStation | null>(null);
  const [radioError, setRadioError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    api.getMusic()
      .then(c => { if (c) setConfig({ ...DEFAULT_MUSIC_CONFIG, ...c }); })
      .catch(err => console.error('getMusic failed:', err));
    window.electronApi?.ytCheck()
      .then(ok => setYtAvailable(ok))
      .catch(() => setYtAvailable(false));
  }, []);

  // Load files when folder changes
  useEffect(() => {
    if (config.folderPath) {
      musicApi.listMusicFiles(config.folderPath)
        .then(f => {
          setFiles(sortFiles(f, config.sortMode));
          setCurrentFileIndex(0);
        })
        .catch(err => console.error('listMusicFiles failed:', err));
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
    audio.play().catch(err => console.error('audio play failed:', err));
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
    audio.play().catch(err => console.error('audio play failed:', err));
    setYtStreamInfo(result);
    setIsPlaying(true);
  }

  // ── Audio fade ────────────────────────────────────────────────────────────

  function fadeVolume(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs = 1000,
    onComplete?: () => void,
  ) {
    const steps = 20;
    const stepTime = durationMs / steps;
    const stepSize = (to - from) / steps;
    let current = from;
    audio.volume = Math.max(0, Math.min(1, from));
    const interval = setInterval(() => {
      current += stepSize;
      if ((stepSize > 0 && current >= to) || (stepSize < 0 && current <= to)) {
        audio.volume = Math.max(0, Math.min(1, to));
        clearInterval(interval);
        onComplete?.();
      } else {
        audio.volume = Math.max(0, Math.min(1, current));
      }
    }, stepTime);
    return interval;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  const updateConfig = (patch: Partial<MusicConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    api.setMusic(next).catch(err => console.error('setMusic failed:', err));
  };

  const refreshFiles = async () => {
    if (!config.folderPath) return;
    const f = await musicApi.listMusicFiles(config.folderPath);
    setFiles(sortFiles(f, config.sortMode));
    setCurrentFileIndex(0);
  };

  const pickFolder = async () => {
    const path = await musicApi.pickMusicFolder();
    if (!path) return;
    updateConfig({ folderPath: path });
    const f = await musicApi.listMusicFiles(path);
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
    audio.play().catch(err => console.error('audio play failed:', err));
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
    const audio = audioRef.current;
    audio.play().catch(err => console.error('audio play failed:', err));
    fadeVolume(audio, 0, config.volume);
    setIsPlaying(true);
  };

  const pause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    fadeVolume(audio, audio.volume, 0, 500, () => {
      audio.pause();
      audio.volume = config.volume;
    });
    setIsPlaying(false);
  };

  // ── D2: Multiple folders ──────────────────────────────────────────────────

  const addFolder = async () => {
    const path = await musicApi.pickMusicFolder();
    if (!path) return;
    const name = path.split('/').pop() ?? path;
    const newFolder: SavedMusicFolder = { id: crypto.randomUUID(), path, name };
    const savedFolders = [...(config.savedFolders ?? []), newFolder];
    updateConfig({ folderPath: path, savedFolders });
    const f = await musicApi.listMusicFiles(path);
    setFiles(sortFiles(f, config.sortMode));
    setCurrentFileIndex(0);
  };

  const removeFolder = (id: string) => {
    const savedFolders = (config.savedFolders ?? []).filter(f => f.id !== id);
    updateConfig({ savedFolders });
  };

  const loadFolder = async (folder: SavedMusicFolder) => {
    updateConfig({ folderPath: folder.path });
    const f = await musicApi.listMusicFiles(folder.path);
    setFiles(sortFiles(f, config.sortMode));
    setCurrentFileIndex(0);
  };

  // ── D3: Radio stations ────────────────────────────────────────────────────

  const playRadio = (station: RadioStation) => {
    setRadioError(null);
    const audio = getOrCreateAudio();
    audio.src = station.url;
    audio.loop = false;
    audio.play().catch(err => {
      setRadioError(String(err));
    });
    setCurrentRadio(station);
    setSource('radio');
    setIsPlaying(true);
  };

  const addRadioStation = (name: string, url: string, genre: string) => {
    const station: RadioStation = { id: crypto.randomUUID(), name, url, genre, isBuiltIn: false };
    const savedRadioStations = [...(config.savedRadioStations ?? []), station];
    updateConfig({ savedRadioStations });
  };

  const removeRadioStation = (id: string) => {
    const savedRadioStations = (config.savedRadioStations ?? []).filter(s => s.id !== id);
    updateConfig({ savedRadioStations });
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

  // ── Saved playlists ───────────────────────────────────────────────────────

  function extractVideoId(url: string): string | null {
    const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
    return m?.[1] ?? null;
  }

  const addSavedPlaylist = async (url: string) => {
    setYtLoading(true);
    setYtError(null);
    try {
      let name = url;
      let thumbnailUrl: string | null = null;
      let itemCount = 0;
      let firstVideoId: string | null = null;

      const playlistResult = await window.electronApi?.ytGetPlaylist(url);
      if (playlistResult && !('error' in playlistResult) && playlistResult.length > 0) {
        itemCount = playlistResult.length;
        name = url; // will be overridden if stream info available
        firstVideoId = playlistResult[0].id;
        // Try to get a title from first video
        const streamResult = await window.electronApi?.ytGetStream(
          `https://www.youtube.com/watch?v=${firstVideoId}`,
        );
        if (streamResult && !('error' in streamResult)) {
          name = streamResult.title.replace(/\s*[-–|].*$/, '').trim(); // strip channel suffix
        }
      } else {
        const streamResult = await window.electronApi?.ytGetStream(url);
        if (!streamResult || 'error' in streamResult) {
          setYtError((streamResult as { error: string })?.error ?? 'Xatolik');
          return;
        }
        name = streamResult.title;
        firstVideoId = extractVideoId(url);
      }

      if (firstVideoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${firstVideoId}/mqdefault.jpg`;
      }

      const newPlaylist: SavedYtPlaylist = {
        id: crypto.randomUUID(),
        name,
        url,
        thumbnailUrl,
        itemCount,
        addedAt: Date.now(),
      };

      const next = { ...config, savedPlaylists: [...(config.savedPlaylists ?? []), newPlaylist] };
      setConfig(next);
      api.setMusic(next).catch(err => console.error('setMusic failed:', err));
    } finally {
      setYtLoading(false);
    }
  };

  const removeSavedPlaylist = (id: string) => {
    const next = { ...config, savedPlaylists: (config.savedPlaylists ?? []).filter(p => p.id !== id) };
    setConfig(next);
    api.setMusic(next).catch(err => console.error('setMusic failed:', err));
  };

  const loadSavedPlaylist = async (playlist: SavedYtPlaylist) => {
    await loadYoutube(playlist.url);
  };

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
      addFolder, removeFolder, loadFolder,
      ytAvailable, ytPlaylist, ytCurrentIndex, ytStreamInfo, ytLoading, ytError,
      loadYoutube, playYtTrack,
      currentRadio, radioError, playRadio, addRadioStation, removeRadioStation,
      source, isPlaying, play, pause, next, prev, setVolume,
      addSavedPlaylist, removeSavedPlaylist, loadSavedPlaylist,
      audioRef,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
