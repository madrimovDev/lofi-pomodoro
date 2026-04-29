import { useEffect, useState } from "react"

export const CurrentTime = () => {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="text-xs">
      {time.toLocaleTimeString()}
    </span>
  )
}
