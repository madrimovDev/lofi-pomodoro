import { Button } from "@shared/components/ui/button";
import {Maximize2, Minus, X} from 'lucide-react'
import { ToggleTheme } from "./toggle-theme";
import { CurrentTime } from "./current-time";
export const WindowControl = () => {

  const handleMinimize = () => {
    window.electronApi?.minimizeWindow()
  }

  const handleMaximize = () => {
    window.electronApi?.maximizeWindow()
  }

  const handleClose = () => {
    window.electronApi?.closeWindow()
  }

  return (
    <div id="window-control" className="fixed inset-x-0 grid grid-cols-[1fr_auto_1fr] items-center w-full px-2 py-2 h-10 bg-background/40 backdrop-blur-2xl">
      <h3 className="text-sm text-primary" >
        ZenFocus - Pomodoro
      </h3>
      <CurrentTime/>
      <div  className="flex justify-end">
        <div id="window-controls-button">

        <ToggleTheme/>
        <Button onClick={handleMinimize} variant="ghost" size="icon-xs">
          <Minus/>
        </Button>
        <Button onClick={handleMaximize} variant="ghost" size="icon-xs">
          <Maximize2/>
        </Button>
        <Button onClick={handleClose} variant="ghost" size="icon-xs" className="hover:bg-destructive/50">
          <X/>
        </Button>
        </div>
      </div>
    </div>
  )
};
