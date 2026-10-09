import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay,
} from 'date-fns'

export function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  return eachDayOfInterval({ start, end })
}

export function groupEventsByDay(events: { start_time: string; id: string }[]) {
  const map = new Map<string, typeof events>()
  events.forEach((e) => {
    const key = e.start_time.slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  })
  return map
}

export { isSameMonth, isSameDay }