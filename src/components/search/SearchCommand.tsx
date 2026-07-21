'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  Home,
  MessageSquare,
  Search,
  Send,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { useSearch, MIN_AI_QUERY_LENGTH } from '@/components/search/search-context'
import { examplesForScope } from '@/components/search/suggested-searches'
import {
  scopeLabel,
  scopePlaceholder,
  scopeSearchTarget,
  type SearchAudience,
  type SearchScope,
} from '@/lib/search-scope'

type NavEntry = {
  id: string
  label: string
  href: string
  keywords?: string[]
  icon: typeof Home
}

/** Icon per global-search category, so grouped results stay scannable. */
const GLOBAL_ICONS: Record<string, typeof Home> = {
  talent: UserRound,
  jobs: BriefcaseBusiness,
  messages: MessageSquare,
  settings: Settings,
}

/** How many inline results the palette shows before deferring to the page. */
const INLINE_RESULT_LIMIT = 6

function navEntries(audience: SearchAudience): { heading: string; items: NavEntry[] }[] {
  if (audience === 'public') {
    return [
      {
        heading: 'Browse',
        items: [
          { id: 'talent', label: 'Browse talent', href: '/talent', icon: Search },
          { id: 'jobs', label: 'Browse jobs', href: '/jobs', icon: BriefcaseBusiness },
        ],
      },
    ]
  }

  const role: NavEntry[] =
    audience === 'hirer'
      ? [
          { id: 'search', label: 'Search talent', href: '/search', icon: Search, keywords: ['find', 'browse'] },
          { id: 'my-jobs', label: 'My jobs', href: '/my-jobs', icon: BriefcaseBusiness },
          { id: 'outreach', label: 'Outreach', href: '/outreach', icon: Send },
          { id: 'shortlists', label: 'Saved talent', href: '/shortlists', icon: Bookmark, keywords: ['liked', 'bookmarks'] },
        ]
      : [
          { id: 'discover', label: 'Discover jobs', href: '/discover', icon: Compass, keywords: ['jobs', 'opportunities'] },
          { id: 'applications', label: 'My applications', href: '/applications', icon: BriefcaseBusiness },
        ]

  return [
    { heading: audience === 'hirer' ? 'Hiring' : 'Discover', items: role },
    {
      heading: 'Navigate',
      items: [
        { id: 'home', label: 'Home', href: '/home', icon: Home, keywords: ['dashboard'] },
        { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare, keywords: ['inbox', 'chat'] },
        { id: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
        { id: 'profile', label: 'Profile', href: '/profile', icon: UserRound },
        { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ]
}

/**
 * The one search surface in the app. Mounted once per shell (authed and
 * public), opened by Cmd/Ctrl+K or the top-bar trigger. Its behaviour is
 * driven entirely by the resolved scope in `search-context`.
 */
export function SearchCommand() {
  const router = useRouter()
  const {
    audience, scope, routeScope, setScope,
    open, setOpen, query, setQuery, ai, canRunAi, fallback, mode, scoped,
    global: globalResults, commitSearch,
  } = useSearch()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  const trimmed = query.trim()
  const target = scopeSearchTarget(scope, audience)

  // cmdk filters nav items for us, but AI results arrive already ranked by
  // the server - re-filtering them client-side would drop valid matches whose
  // relevance came from the embedding rather than the literal characters.
  // cmdk must not re-filter server-ranked results; it only filters when we
  // are showing nothing but static nav entries.
  const serverDriven = mode !== 'none' && trimmed.length >= MIN_AI_QUERY_LENGTH
  const shouldFilter = !serverDriven

  // With cmdk's filter off, nav items would otherwise all render under a
  // talent query. Filter them here so the list stays about what was typed.
  const groups = useMemo(() => {
    const all = navEntries(audience)
    if (shouldFilter) return all
    const needle = trimmed.toLowerCase()
    return all
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          [item.label, ...(item.keywords ?? [])].some(text =>
            text.toLowerCase().includes(needle),
          ),
        ),
      }))
      .filter(group => group.items.length > 0)
  }, [audience, shouldFilter, trimmed])

  function close() {
    setOpen(false)
  }

  function goTo(href: string) {
    close()
    router.push(href)
  }

  function runSearch() {
    // Commit before navigating: a surface that owns its own data and is
    // already on `target` will not remount, so the URL alone cannot tell it
    // the query changed.
    commitSearch(trimmed)
    goTo(trimmed ? `${target}?q=${encodeURIComponent(trimmed)}` : target)
  }

  const searchable = trimmed.length >= MIN_AI_QUERY_LENGTH
  const inlineResults = (ai.results ?? []).slice(0, INLINE_RESULT_LIMIT)
  const hasAiResults = (ai.results?.length ?? 0) > 0
  const showTalentResults = canRunAi && searchable && hasAiResults

  // "No matches" is only true once a search has actually completed for the
  // query on screen - not while one is still in flight.
  const showNoResults =
    canRunAi && searchable && !ai.searching && ai.results !== null && !hasAiResults && !ai.error

  // Stale keyword hits must never render under a newer query.
  const showFallback =
    showNoResults && fallback.forQuery === trimmed && fallback.results.length > 0

  // Every scope guards on forQuery so a slower response cannot land under a
  // query the user has already moved past.
  const showScopedResults =
    (mode === 'jobs-ai' || mode === 'public-talent' || mode === 'public-jobs') &&
    searchable && scoped.forQuery === trimmed && scoped.hits.length > 0

  const showGlobalResults =
    mode === 'global' && searchable &&
    globalResults.forQuery === trimmed && globalResults.groups.length > 0

  // The scoped/global equivalent of the talent no-result state.
  const showScopedEmpty =
    searchable && !showNoResults &&
    ((mode === 'jobs-ai' || mode === 'public-talent' || mode === 'public-jobs') &&
      !scoped.loading && scoped.forQuery === trimmed && scoped.hits.length === 0 && !scoped.error ||
     mode === 'global' &&
      !globalResults.loading && globalResults.forQuery === trimmed && globalResults.groups.length === 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search talent, jobs and pages"
      commandProps={{ shouldFilter }}
    >
      {/* Scope pill sits with the input so the box always states what it is
          about to search, and switching to global never leaves the page. */}
      <div className="flex items-center gap-1.5 px-2 pt-2">
        {scope !== 'global' && (
          <Badge
            render={
              <button
                type="button"
                onClick={() => setScope('global')}
                aria-label={`Searching ${scopeLabel(scope)}. Switch to search everything`}
              />
            }
            variant="secondary"
            className="shrink-0 cursor-pointer gap-1 hover:bg-secondary/70"
          >
            {scopeLabel(scope)}
            <X className="size-3 opacity-60" />
          </Badge>
        )}
        {scope === 'global' && routeScope !== 'global' && (
          <Badge
            render={
              <button
                type="button"
                onClick={() => setScope(routeScope)}
                aria-label={`Searching everything. Switch back to ${scopeLabel(routeScope)}`}
              />
            }
            variant="outline"
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Back to {scopeLabel(routeScope)}
          </Badge>
        )}
        <span className="sr-only" aria-live="polite">
          Searching {scopeLabel(scope)}
        </span>
      </div>

      <CommandInput
        placeholder={scopePlaceholder(scope)}
        value={query}
        onValueChange={setQuery}
        autoFocus
      />

      <CommandList>
        {!showNoResults && !showScopedEmpty && (
          <CommandEmpty>
            {ai.searching || scoped.loading || globalResults.loading ? 'Searching…' : 'No matches'}
          </CommandEmpty>
        )}

        {/* Talent scope: live AI results, ranked server-side. */}
        {showTalentResults && (
          <CommandGroup heading={ai.searching ? 'Searching…' : `Talent · ${ai.results?.length ?? 0} matches`}>
            {inlineResults.map(({ profile, match_score }) => (
              <CommandItem
                key={profile.id}
                value={`talent-${profile.id}`}
                onSelect={() => goTo(`/talent/${profile.id}`)}
              >
                <UserRound className="text-muted-foreground" />
                <span className="truncate">{profile.full_name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {Math.round(match_score)}% match
                </span>
              </CommandItem>
            ))}
            {(ai.results?.length ?? 0) > INLINE_RESULT_LIMIT && (
              <CommandItem value="see-all-talent" onSelect={runSearch}>
                <Search className="text-muted-foreground" />
                <span>See all {ai.results?.length} results</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Jobs scope and the signed-out keyword scopes. */}
        {showScopedResults && (
          <CommandGroup
            heading={scoped.loading ? 'Searching…' : `${scopeLabel(scope)} · ${scoped.hits.length} matches`}
          >
            {scoped.hits.map(hit => (
              <CommandItem
                key={hit.id}
                value={`scoped-${hit.id}`}
                onSelect={() => goTo(hit.href)}
              >
                <BriefcaseBusiness className="text-muted-foreground" />
                <span className="truncate">{hit.title}</span>
                {hit.subtitle && (
                  <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                    {hit.subtitle}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Global scope: one query, grouped by the surface it matched. */}
        {showGlobalResults && globalResults.groups.map(group => (
          <CommandGroup key={group.category} heading={group.label}>
            {group.hits.map(hit => {
              const Icon = GLOBAL_ICONS[group.category] ?? Search
              return (
                <CommandItem
                  key={hit.id}
                  value={`global-${group.category}-${hit.id}`}
                  onSelect={() => goTo(hit.href)}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="truncate">{hit.title}</span>
                  {hit.subtitle && (
                    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                      {hit.subtitle}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}

        {/* No AI matches: say so plainly, prompt a rephrase, and offer
            whatever plain keyword matching found for the same words. */}
        {(showNoResults || showScopedEmpty) && (
          <div className="px-3 py-4">
            <p className="text-sm font-medium">No matches for “{trimmed}”</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {scope === 'jobs'
                ? 'Try rephrasing - name a role, a city, or a day rate.'
                : scope === 'global'
                  ? 'Try rephrasing - a person, a job title, or a page name.'
                  : 'Try rephrasing - name a skill, a city, or when you need them.'}
            </p>
          </div>
        )}

        {showFallback && (
          <CommandGroup heading="Keyword matches">
            {fallback.results.map(match => (
              <CommandItem
                key={match.id}
                value={`fallback-${match.id}`}
                onSelect={() => goTo(`/talent/${match.id}`)}
              >
                <UserRound className="text-muted-foreground" />
                <span className="truncate">{match.name}</span>
                {match.detail && (
                  <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                    {match.detail}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {ai.error && canRunAi && (
          <CommandGroup heading="Search">
            <CommandItem value="search-error" onSelect={runSearch}>
              <Search className="text-muted-foreground" />
              <span>{ai.error} · open full search</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Empty state: two or three examples relevant to this scope. */}
        {!trimmed && (
          <CommandGroup heading="Try searching for">
            {examplesForScope(scope).map(suggestion => (
              <CommandItem
                key={suggestion.query}
                value={suggestion.label}
                onSelect={() => setQuery(suggestion.query)}
              >
                <Sparkles className="text-primary" />
                <span>{suggestion.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Non-talent scopes still navigate on Enter; live results land in
            phase 3 when the jobs and global routers exist. */}
        {!canRunAi && scope !== 'global' && (
          <CommandGroup heading="Search">
            <CommandItem value={`run-search ${trimmed}`} onSelect={runSearch}>
              <Search className="text-muted-foreground" />
              <span>
                {trimmed ? `Search ${scopeLabel(scope)} for “${trimmed}”` : 'Open search'}
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        {groups.map(group => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map(item => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  keywords={item.keywords}
                  onSelect={() => goTo(item.href)}
                >
                  <Icon className="text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>

      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> to navigate ·{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> to select ·{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd> to close
      </div>
    </CommandDialog>
  )
}

export type { SearchScope }
