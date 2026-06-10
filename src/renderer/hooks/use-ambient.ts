import { useEffect, useRef } from 'react';
import { type AmbientSound } from '@shared/types';

const FADE_MS = 800;
const FADE_STEPS = 16;

export function useAmbient(sound: AmbientSound | undefined, volume: number | undefined, isPlaying: boolean) {
  const currentRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<AmbientSound>('none');
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadingRef = useRef<HTMLAudioElement | null>(null);
  const safeVolume = typeof volume === 'number' && isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.4;
  const safeSound = sound ?? 'none';

  const cancelFade = () => {
    if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null; }
    if (fadingRef.current) { fadingRef.current.pause(); fadingRef.current = null; }
  };

  // sound-change → crossfade (the ONLY crossfade trigger)
  useEffect(() => {
    if (soundRef.current === safeSound) return;
    cancelFade();
    const old = currentRef.current;
    const target = safeVolume;

    if (safeSound === 'none') {
      const startVol = old?.volume ?? 0;
      const step = startVol / FADE_STEPS;
      let v = startVol;
      currentRef.current = null;
      fadingRef.current = old;            // track the element fading out
      fadeRef.current = setInterval(() => {
        v -= step;
        if (old) old.volume = Math.max(0, v);
        if (v <= 0) { cancelFade(); }     // clears interval + pauses fadingRef(old)
      }, FADE_MS / FADE_STEPS);
      soundRef.current = 'none';
      return;
    }

    const next = new Audio(`/${safeSound}.mp3`);
    next.loop = true;
    next.volume = 0;
    currentRef.current = next;
    fadingRef.current = old;              // old fades out; tracked so an interrupt pauses it
    soundRef.current = safeSound;
    if (isPlaying) next.play().catch(() => {});

    let step = 0;
    fadeRef.current = setInterval(() => {
      step++;
      const f = step / FADE_STEPS;
      next.volume = Math.min(target, target * f);
      if (old) old.volume = Math.max(0, target * (1 - f));
      if (step >= FADE_STEPS) {
        next.volume = target;
        cancelFade();                      // clears interval + pauses fadingRef(old)
      }
    }, FADE_MS / FADE_STEPS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSound]);

  // volume-change → set gain directly, NO fade (guard: don't fight an in-flight fade)
  useEffect(() => {
    if (currentRef.current && !fadeRef.current) currentRef.current.volume = safeVolume;
  }, [safeVolume]);

  // isPlaying-change → play/pause
  useEffect(() => {
    const a = currentRef.current;
    if (!a) return;
    if (isPlaying) a.play().catch(() => {}); else a.pause();
  }, [isPlaying]);

  // unmount cleanup — cancelFade() pauses fadingRef; also pause currentRef
  useEffect(() => () => { cancelFade(); currentRef.current?.pause(); currentRef.current = null; }, []);
}
