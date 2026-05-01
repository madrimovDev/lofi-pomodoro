import { useRef, useEffect } from 'react';

/**
 * Simple CSS-based visualizer — no Web Audio API so it never
 * intercepts or silences the audio element.
 * Animates canvas bars with randomised heights while playing.
 */
export function useAudioVisualizer(audioElement: HTMLAudioElement | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!audioElement || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BARS = 12;
    const heights = Array.from({ length: BARS }, () => Math.random());

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Slowly drift each bar height
      for (let i = 0; i < BARS; i++) {
        heights[i] = Math.max(0.05, Math.min(1, heights[i] + (Math.random() - 0.5) * 0.15));
      }

      const barW = canvas!.width / BARS;
      heights.forEach((h, i) => {
        const barH = h * canvas!.height;
        const lightness = 40 + h * 30;
        ctx!.fillStyle = `hsl(142 60% ${lightness}%)`;
        ctx!.fillRect(i * barW + 0.5, canvas!.height - barH, barW - 1, barH);
      });
    }
    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, [audioElement]);

  return canvasRef;
}
