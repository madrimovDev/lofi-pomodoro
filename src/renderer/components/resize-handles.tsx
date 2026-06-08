import { winApi, type ResizeDir } from '@shared/tauri/window';

const HANDLES: { dir: ResizeDir; className: string; cursor: string }[] = [
  { dir: 'North', className: 'top-0 inset-x-0 h-1', cursor: 'ns-resize' },
  { dir: 'South', className: 'bottom-0 inset-x-0 h-1', cursor: 'ns-resize' },
  { dir: 'West', className: 'left-0 inset-y-0 w-1', cursor: 'ew-resize' },
  { dir: 'East', className: 'right-0 inset-y-0 w-1', cursor: 'ew-resize' },
  { dir: 'NorthWest', className: 'top-0 left-0 size-2.5', cursor: 'nwse-resize' },
  { dir: 'NorthEast', className: 'top-0 right-0 size-2.5', cursor: 'nesw-resize' },
  { dir: 'SouthWest', className: 'bottom-0 left-0 size-2.5', cursor: 'nesw-resize' },
  { dir: 'SouthEast', className: 'bottom-0 right-0 size-2.5', cursor: 'nwse-resize' },
];

export function ResizeHandles() {
  return (
    <>
      {HANDLES.map(h => (
        <div
          key={h.cursor + h.className}
          className={`fixed z-40 ${h.className}`}
          style={{ cursor: h.cursor }}
          onPointerDown={e => {
            if (e.button !== 0) return;
            winApi.startResizeDragging(h.dir).catch(() => {});
          }}
        />
      ))}
    </>
  );
}
