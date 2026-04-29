import { useEffect, useState } from "react"
import { Sun, Moon } from 'lucide-react'
import { Button } from "@shared/components/ui/button"

export const ToggleTheme = () => {
  const [theme, setTheme] = useState<'dark' | 'light' | undefined>()

  useEffect(() => {
    const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light'
    setTheme(currentTheme)
  }, [])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <Button size='icon-xs' className="rounded-full mr-4" variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
