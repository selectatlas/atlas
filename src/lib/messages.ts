/** Find or create a direct-message thread with another profile. */
export async function createMessageThread(talentId: string): Promise<string | null> {
  const response = await fetch('/api/messages/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ talent_id: talentId }),
  })
  if (!response.ok) return null
  const data = await response.json() as { thread_id?: string }
  return data.thread_id ?? null
}
