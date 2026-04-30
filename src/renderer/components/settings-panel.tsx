import { Dialog, Switch } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import { type AmbientSound } from '@shared/types';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NumberInput({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-foreground/80 select-none">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-16 text-center rounded-lg border border-border bg-background/30 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
      />
    </div>
  );
}

function ToggleRow({
  label, checked, onCheckedChange,
}: {
  label: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-foreground/80 select-none">{label}</label>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-border"
      >
        <Switch.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-lg transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      </Switch.Root>
    </div>
  );
}

const AMBIENT_OPTIONS: { value: AmbientSound; label: string }[] = [
  { value: 'none', label: "O'chiq" },
  { value: 'rain', label: 'Yomg\'ir' },
  { value: 'forest', label: 'O\'rmon' },
  { value: 'cafe', label: 'Kafe' },
];

function AmbientSelect({ value, onChange }: { value: AmbientSound; onChange: (v: AmbientSound) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {AMBIENT_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-xs transition-colors duration-200 border ${
            value === opt.value
              ? 'bg-primary/20 border-primary/40 text-foreground'
              : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground/50 select-none w-4">🔈</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground/50 select-none w-4">🔊</span>
    </div>
  );
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 glass w-80 rounded-2xl p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
              Sozlamalar
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Yopish">
                <X className="size-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">Vaqtlar (daqiqa)</p>
              <NumberInput label="Focus" value={settings.focusDuration} min={1} max={120}
                onChange={v => updateSettings({ focusDuration: v })} />
              <NumberInput label="Qisqa tanaffus" value={settings.shortBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ shortBreakDuration: v })} />
              <NumberInput label="Uzun tanaffus" value={settings.longBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ longBreakDuration: v })} />
              <NumberInput label="Sessiyalar soni" value={settings.sessionsBeforeLongBreak} min={1} max={10}
                onChange={v => updateSettings({ sessionsBeforeLongBreak: v })} />
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">Ambient ovoz</p>
              <AmbientSelect
                value={settings.ambientSound}
                onChange={v => updateSettings({ ambientSound: v })}
              />
              {settings.ambientSound !== 'none' && (
                <VolumeSlider
                  value={settings.ambientVolume}
                  onChange={v => updateSettings({ ambientVolume: v })}
                />
              )}
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">Bildirishnomalar</p>
              <ToggleRow label="Ovoz" checked={settings.soundEnabled}
                onCheckedChange={v => updateSettings({ soundEnabled: v })} />
              <ToggleRow label="Notification" checked={settings.notificationsEnabled}
                onCheckedChange={v => updateSettings({ notificationsEnabled: v })} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
