import { DEFAULT_PRESETS } from '@shared/types';
import { useSettings } from '@renderer/hooks/use-settings';
import { cn } from '@shared/lib/utils';

export function PresetSelector() {
  const { settings, updateSettings } = useSettings();

  const applyPreset = (preset: typeof DEFAULT_PRESETS[0]) => {
    updateSettings({
      focusDuration: preset.focusDuration,
      shortBreakDuration: preset.shortBreakDuration,
      longBreakDuration: preset.longBreakDuration,
      sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      activePreset: preset.id,
    });
  };

  return (
    <div className="flex gap-1">
      {DEFAULT_PRESETS.map(preset => (
        <button
          key={preset.id}
          onClick={() => applyPreset(preset)}
          className={cn(
            'px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider transition-colors duration-150 border',
            settings.activePreset === preset.id
              ? 'bg-primary/20 border-primary/40 text-foreground'
              : 'border-border/30 text-muted-foreground/30 hover:border-border/60 hover:text-muted-foreground/60',
          )}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}
