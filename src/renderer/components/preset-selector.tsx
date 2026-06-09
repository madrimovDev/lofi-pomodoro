import { DEFAULT_PRESETS, PRESET_NAME_KEYS, type TimerPreset } from '@shared/types';
import { useSettings } from '@renderer/hooks/use-settings';
import { cn } from '@shared/lib/utils';
import type { TranslationKey } from '@shared/i18n';
import { X } from 'lucide-react';

export function PresetSelector() {
  const { settings, updateSettings, t } = useSettings();
  const presets: TimerPreset[] = [...DEFAULT_PRESETS, ...(settings.customPresets ?? [])];

  const applyPreset = (preset: TimerPreset) => {
    updateSettings({
      focusDuration: preset.focusDuration,
      shortBreakDuration: preset.shortBreakDuration,
      longBreakDuration: preset.longBreakDuration,
      sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      activePreset: preset.id,
    });
  };

  const removeCustom = (id: string) => {
    updateSettings({
      customPresets: (settings.customPresets ?? []).filter(p => p.id !== id),
      ...(settings.activePreset === id ? { activePreset: null } : {}),
    });
  };

  const presetLabel = (p: TimerPreset) =>
    p.isBuiltIn ? t(PRESET_NAME_KEYS[p.id] as TranslationKey) : p.name;

  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {presets.map(preset => (
        <div key={preset.id} className="group/preset relative">
          <button
            onClick={() => applyPreset(preset)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider transition-colors duration-150 border',
              settings.activePreset === preset.id
                ? 'bg-primary/20 border-primary/40 text-foreground'
                : 'border-border/30 text-muted-foreground/30 hover:border-border/60 hover:text-muted-foreground/60',
            )}
          >
            {presetLabel(preset)}
          </button>
          {!preset.isBuiltIn && (
            <button
              onClick={() => removeCustom(preset.id)}
              className="absolute -top-1 -right-1 opacity-0 group-hover/preset:opacity-100 transition-opacity rounded-full bg-background border border-border/50 p-0.5 text-muted-foreground/50 hover:text-destructive/70"
              aria-label={t('delete')}
            >
              <X className="size-2" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
