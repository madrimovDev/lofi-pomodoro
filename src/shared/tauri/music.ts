import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type { AudioFile } from '@shared/types';

/** list_music_files xom natijasi (Rust AudioFileRaw). */
interface AudioFileRaw {
  name: string;
  path: string;
}

/**
 * Faza 6 musiqa papkasi command'lari.
 * convertFileSrc shu yerda qo'llanadi — renderer xom yo'lni ko'rmaydi.
 */
export const musicApi = {
  pickMusicFolder: () => invoke<string | null>('pick_music_folder'),

  listMusicFiles: async (folderPath: string): Promise<AudioFile[]> => {
    const raw = await invoke<AudioFileRaw[]>('list_music_files', { folderPath });
    return raw.map(f => ({ name: f.name, url: convertFileSrc(f.path) }));
  },
};
