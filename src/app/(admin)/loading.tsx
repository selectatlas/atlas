export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
