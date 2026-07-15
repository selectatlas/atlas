import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl font-medium">Account suspended</h1>
      <p className="text-sm text-muted-foreground">
        Your Atlas account has been suspended for a policy violation. Contact support if you believe this is a mistake.
      </p>
      <form action={signOut}>
        <Button type="submit">Sign out</Button>
      </form>
    </main>
  )
}
