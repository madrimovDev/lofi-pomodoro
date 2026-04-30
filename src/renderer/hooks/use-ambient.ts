import { useEffect, useRef } from 'react';
import { type AmbientSound } from '@shared/types';

export function useAmbient(sound: AmbientSound | undefined, volume: number | undefined, isPlaying: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<AmbientSound | undefined>(undefined);
  const safeVolume = typeof volume === 'number' && isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.4;
  const safeSound = sound ?? 'none';

  useEffect(() => {
    if (safeSound === 'none') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      soundRef.current = 'none';
      return;
    }

    if (soundRef.current !== safeSound) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/${safeSound}.mp3`);
      audio.loop = true;
      audio.volume = safeVolume;
      audioRef.current = audio;
      soundRef.current = safeSound;
    }

    if (audioRef.current) {
      audioRef.current.volume = safeVolume;
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [safeSound, safeVolume, isPlaying]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);
}
