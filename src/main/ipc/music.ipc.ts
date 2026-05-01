import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdirSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { getAppStore } from '../store';
import log from '../logger';
import {
  IPC_CHANNELS,
  DEFAULT_MUSIC_CONFIG,
  type MusicConfig,
  type AudioFile,
  type YoutubeStreamInfo,
  type YoutubePlaylistItem,
} from '../../shared/types';

const execFileAsync = promisify(execFile);

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.weba', '.webm']);

/** Returns path to the bundled yt-dlp binary. */
function getYtDlpPath(): string {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', binaryName);
  }
  // Dev mode: binary sits at project-root/bin/<platform>/
  const platformDir = isWin ? 'win' : 'linux';
  return join(__dirname, '../../bin', platformDir, binaryName);
}

function toLocalFileUrl(filePath: string): string {
  // Convert system path to our custom protocol URL
  const fileUrl = pathToFileURL(filePath).href; // file:///path/to/file.mp3
  return fileUrl.replace(/^file:\/\//, 'localfile://');  // localfile:///path/to/file.mp3
}

async function runYtDlp(args: string[], timeoutMs = 30_000): Promise<string> {
  const bin = getYtDlpPath();
  const { stdout } = await execFileAsync(bin, args, { timeout: timeoutMs });
  return stdout.trim();
}

export function setupMusicIpc(): void {
  const store = getAppStore();

  // Store: get/set music config
  ipcMain.handle(IPC_CHANNELS.STORE_GET_MUSIC, () => ({
    ...DEFAULT_MUSIC_CONFIG,
    ...store.get('music'),
  }));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_MUSIC, (_e, value: MusicConfig) => {
    store.set('music', value);
  });

  // Folder: open dialog to pick a folder
  ipcMain.handle(IPC_CHANNELS.MUSIC_PICK_FOLDER, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Musiqa papkasini tanlang',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Folder: list audio files in a directory
  ipcMain.handle(IPC_CHANNELS.MUSIC_LIST_FILES, (_e, folderPath: string): AudioFile[] => {
    try {
      const entries = readdirSync(folderPath, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() && AUDIO_EXTENSIONS.has(extname(e.name).toLowerCase()))
        .map(e => ({
          name: e.name,
          url: toLocalFileUrl(join(folderPath, e.name)),
        }));
    } catch {
      return [];
    }
  });

  // YouTube: check if bundled yt-dlp binary is available
  ipcMain.handle(IPC_CHANNELS.MUSIC_YT_CHECK, async (): Promise<boolean> => {
    try {
      await runYtDlp(['--version'], 8_000);
      return true;
    } catch {
      return false;
    }
  });

  // YouTube: get stream URL + title for a single video or live stream
  ipcMain.handle(IPC_CHANNELS.MUSIC_YT_GET_STREAM, async (
    _e, url: string,
  ): Promise<YoutubeStreamInfo | { error: string }> => {
    try {
      const [streamOut, titleOut, liveOut] = await Promise.all([
        runYtDlp(['-g', '-x', '--audio-quality', '0', '--no-playlist', url]),
        runYtDlp(['--get-title', '--no-playlist', url]),
        runYtDlp(['--print', '%(is_live)s', '--no-playlist', url]).catch(() => 'False'),
      ]);
      return {
        streamUrl: streamOut.split('\n')[0], // take first URL if multiple
        title: titleOut.split('\n')[0],
        isLive: liveOut.toLowerCase().startsWith('true'),
      };
    } catch (err: unknown) {
      log.error('yt-dlp stream error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('yt-dlp')) return { error: 'yt-dlp topilmadi. Iltimos avval o\'rnating.' };
      return { error: 'URL dan stream olishda xatolik yuz berdi.' };
    }
  });

  // YouTube: get playlist items (flat, no download)
  ipcMain.handle(IPC_CHANNELS.MUSIC_YT_GET_PLAYLIST, async (
    _e, url: string,
  ): Promise<YoutubePlaylistItem[] | { error: string }> => {
    try {
      const out = await runYtDlp(
        ['--flat-playlist', '--print', '%(id)s\t%(title)s', url],
        60_000,
      );
      return out.split('\n')
        .filter(Boolean)
        .map(line => {
          const tabIdx = line.indexOf('\t');
          return {
            id: line.slice(0, tabIdx),
            title: line.slice(tabIdx + 1),
          };
        });
    } catch (err: unknown) {
      log.error('yt-dlp playlist error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('yt-dlp')) return { error: 'yt-dlp topilmadi.' };
      return { error: 'Playlist ma\'lumotlarini olishda xatolik.' };
    }
  });
}
