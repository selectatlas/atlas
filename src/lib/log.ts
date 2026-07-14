type LogLevel = 'info' | 'warn' | 'error'

// Structured server logs. Never pass message content, emails, tokens, or
// AI prompt text in fields - identifiers and counts only.
export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
) {
  const entry = JSON.stringify({
    level,
    event,
    ...fields,
    timestamp: new Date().toISOString(),
  })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}
