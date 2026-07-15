import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

const noopClient = {
  capture: () => {},
  flush: async () => {},
} as unknown as PostHog

export function getPostHogClient(): PostHog {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) return noopClient
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}
