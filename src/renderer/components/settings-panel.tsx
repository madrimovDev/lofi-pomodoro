import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Switch } from 'radix-ui';
import { Sheet, SheetContent, SheetClose } from '@shared/components/ui/sheet';
import { Loader2, RefreshCw, X, Minimize2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import { useUpdater } from '@renderer/hooks/use-updater';
import { winApi } from '@shared/tauri/window';
import { dialogApi } from '@shared/tauri/dialog';

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


export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { settings, updateSettings, t } = useSettings();
  const { status, check, install } = useUpdater();
  const isBusy = status?.type === 'checking' || status?.type === 'downloading';

  const [appVersion, setAppVersion] = useState<string>('');
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" title="Sozlamalar" className="glass overflow-y-auto p-6 focus:outline-none">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
              {t('settings')}
            </span>
            <SheetClose asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t('close')}>
                <X className="size-3.5" />
              </Button>
            </SheetClose>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('durations')}</p>
              <NumberInput label={t('focusDuration')} value={settings.focusDuration} min={1} max={120}
                onChange={v => updateSettings({ focusDuration: v })} />
              <NumberInput label={t('shortBreakDuration')} value={settings.shortBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ shortBreakDuration: v })} />
              <NumberInput label={t('longBreakDuration')} value={settings.longBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ longBreakDuration: v })} />
              <NumberInput label={t('sessionsBeforeLongBreak')} value={settings.sessionsBeforeLongBreak} min={1} max={10}
                onChange={v => updateSettings({ sessionsBeforeLongBreak: v })} />
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('notifications')}</p>
              <ToggleRow label={t('sound')} checked={settings.soundEnabled}
                onCheckedChange={v => updateSettings({ soundEnabled: v })} />
              <ToggleRow label={t('notification')} checked={settings.notificationsEnabled}
                onCheckedChange={v => updateSettings({ notificationsEnabled: v })} />
              {settings.soundEnabled && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground/60 truncate max-w-[140px] select-none">
                    {settings.notificationSoundPath
                      ? settings.notificationSoundPath.split('/').pop()
                      : t('defaultBell')}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-xs"
                      onClick={async () => {
                        const p = await dialogApi.pickNotificationSound();
                        if (p) updateSettings({ notificationSoundPath: p });
                      }}
                    >
                      {t('selectFile')}
                    </Button>
                    {settings.notificationSoundPath && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => updateSettings({ notificationSoundPath: null })}
                        aria-label="Reset"
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('autoStartBreaks').split(' ')[0]}</p>
              <ToggleRow label={t('autoStartBreaks')} checked={settings.autoStartBreaks ?? false}
                onCheckedChange={v => updateSettings({ autoStartBreaks: v })} />
              <ToggleRow label={t('autoStartFocus')} checked={settings.autoStartFocus ?? false}
                onCheckedChange={v => updateSettings({ autoStartFocus: v })} />
              <ToggleRow label={t('alwaysOnTop')} checked={settings.alwaysOnTop ?? false}
                onCheckedChange={v => { updateSettings({ alwaysOnTop: v }); winApi.setAlwaysOnTop(v).catch(err => console.error('setAlwaysOnTop failed:', err)); }} />
              <ToggleRow label={t('breakScreen')} checked={settings.showBreakScreen ?? true}
                onCheckedChange={v => updateSettings({ showBreakScreen: v })} />
              <ToggleRow
                label={t('forceBreakFullscreen')}
                checked={settings.forceBreakFullscreen}
                onCheckedChange={v => updateSettings({ forceBreakFullscreen: v })}
              />
              <ToggleRow
                label={t('animations')}
                checked={settings.animationsEnabled}
                onCheckedChange={v => updateSettings({ animationsEnabled: v })}
              />
              <NumberInput label={t('dailyGoal')} value={settings.dailyGoal ?? 0} min={0} max={20}
                onChange={v => updateSettings({ dailyGoal: v })} />
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-foreground/80 select-none">{t('miniMode')}</label>
                <Button variant="outline" size="xs" className="text-xs gap-1.5"
                  onClick={() => winApi.setMiniMode(true).catch(err => console.error('setMiniMode failed:', err))}>
                  <Minimize2 className="size-3" />
                  {t('miniMode')}
                </Button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('language')}</p>
              <div className="flex gap-1.5">
                {(['uz', 'en', 'ru'] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => updateSettings({ locale: loc })}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors duration-200 border ${
                      settings.locale === loc
                        ? 'bg-primary/20 border-primary/40 text-foreground'
                        : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
                    }`}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('app')}</p>
                {appVersion && <span className="text-xs opacity-60">v{appVersion}</span>}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={check}
                  disabled={isBusy}
                  className="gap-1.5 text-xs"
                >
                  {isBusy
                    ? <Loader2 className="size-3 animate-spin" />
                    : <RefreshCw className="size-3" />
                  }
                  {t('checkUpdates')}
                </Button>
                {status?.type === 'downloaded' && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={install}
                    className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                  >
                    {t('install')}
                  </Button>
                )}
              </div>
              {status && (
                <p className={`text-xs select-none ${
                  status.type === 'error' ? 'text-destructive/70' :
                  status.type === 'downloaded' ? 'text-primary/80' :
                  status.type === 'not-available' ? 'text-muted-foreground/50' :
                  'text-muted-foreground/60'
                }`}>
                  {status.type === 'checking' && t('checking')}
                  {status.type === 'available' && `v${status.version} — ${t('downloading')}`}
                  {status.type === 'downloading' && `${t('downloading')} ${status.percent}%`}
                  {status.type === 'downloaded' && `v${status.version} ${t('updateReady')}`}
                  {status.type === 'not-available' && t('upToDate')}
                  {status.type === 'error' && `${t('updateError')}: ${status.message}`}
                </p>
              )}
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
