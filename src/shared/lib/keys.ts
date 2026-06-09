// Human-readable label for a KeyboardEvent.code value.
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);       // KeyS → S
  if (code.startsWith('Digit')) return code.slice(5);     // Digit1 → 1
  const map: Record<string, string> = {
    Space: 'Space', Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
    BracketLeft: '[', BracketRight: ']', Enter: 'Enter', Escape: 'Esc',
  };
  return map[code] ?? code;
}
