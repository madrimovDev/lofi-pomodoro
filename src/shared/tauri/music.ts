import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type { AudioFile, YoutubeStreamInfo, YoutubePlaylistItem } from '@shared/types';

/** list_music_files xom natijasi (Rust AudioFileRaw). */
interface AudioFileRaw {
  name: string;
  path: string;
  artist?: string;
  album?: string;
  title?: string;
}

/**
 * Faza 6 musiqa papkasi command'lari.
 * convertFileSrc shu yerda qo'llanadi — renderer xom yo'lni ko'rmaydi.
 */
export const musicApi = {
  pickMusicFolder: () => invoke<string | null>('pick_music_folder'),

  listMusicFiles: async (folderPath: string): Promise<AudioFile[]> => {
    const raw = await invoke<AudioFileRaw[]>('list_music_files', { folderPath });
    return raw.map(f => ({ name: f.name, url: convertFileSrc(f.path), artist: f.artist, album: f.album, title: f.title }));
  },

  ytCheck: () => invoke<boolean>('yt_check'),

  ytGetStream: (url: string, timeoutSecs: number): Promise<YoutubeStreamInfo | { error: string }> =>
    invoke<YoutubeStreamInfo>('yt_get_stream', { url, timeoutSecs })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),

  ytGetPlaylist: (url: string, timeoutSecs: number): Promise<YoutubePlaylistItem[] | { error: string }> =>
    invoke<YoutubePlaylistItem[]>('yt_get_playlist', { url, timeoutSecs })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),
};
