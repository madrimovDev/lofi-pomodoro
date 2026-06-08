// Throttle'siz tick manbai — yashirin sahifada ham (tray'ga yashiringan oyna) ishlaydi.
let id: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<'start' | 'stop'>) => {
  if (e.data === 'start') {
    if (id === null) id = setInterval(() => self.postMessage('tick'), 500);
  } else if (e.data === 'stop') {
    if (id !== null) {
      clearInterval(id);
      id = null;
    }
  }
};
