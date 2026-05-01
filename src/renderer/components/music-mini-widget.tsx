import { useEffect, useRef, useState } from 'react';
import { Loader2, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useMusic } from '@renderer/hooks/use-music';
import { useSettings } from '@renderer/hooks/use-settings';
import { useAudioVisualizer } from '@renderer/hooks/use-audio-visualizer';

interface MusicMiniWidgetProps {
  onOpenDrawer: () => void;
}

export function MusicMiniWidget({ onOpenDrawer }: MusicMiniWidgetProps) {
  const { t } = useSettings();
  const {
    source, isPlaying, play, pause, next, prev,
    files, currentFileIndex, ytStreamInfo, ytLoading, audioRef,
  } = useMusic();
  const canvasRef = useAudioVisualizer(isPlaying ? audioRef.current : null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  const trackName = source === 'folder'
    ? files[currentFileIndex]?.name.replace(/\.[^.]+$/, '')
    : source === 'radio'
    ? null
    : ytStreamInfo?.title ?? null;

  // Check if text overflows container → enable marquee
  // rAF ensures layout is fully settled before measuring
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;
      const isOverflowing = text.scrollWidth > container.clientWidth + 1;
      setOverflow(isOverflowing);
      if (isOverflowing) {
        text.style.setProperty('--marquee-offset', `${-(text.scrollWidth - container.clientWidth)}px`);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [trackName]);

  if (!source && !ytLoading) return null;

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={onOpenDrawer}
        className="size-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
      >
        {ytLoading
          ? <Loader2 className="size-3 animate-spin text-primary/50" />
          : <Music2 className="size-3 text-primary/50" />
        }
      </button>

      <div
        ref={containerRef}
        onClick={onOpenDrawer}
        className="marquee-container flex-1 min-w-0 cursor-pointer"
      >
        <span
          ref={textRef}
          className={`text-xs text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors${overflow ? ' marquee-text' : ''}`}
        >
          {trackName ?? t('loadingTrack')}
        </span>
      </div>

      {isPlaying && (
        <canvas
          ref={canvasRef}
          width={48}
          height={16}
          className="shrink-0 rounded opacity-60"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={prev}>
          <SkipBack className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={isPlaying ? pause : play} disabled={ytLoading}>
          {isPlaying
            ? <Pause className="size-3" />
            : <Play className="size-3 translate-x-px" />
          }
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={next}>
          <SkipForward className="size-3" />
        </Button>
      </div>
    </div>
  );
}
