'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { PageShell } from '@/components/layout/PageShell'
import { JobForm, EMPTY_JOB_FORM, type JobFormValues } from '@/components/jobs/JobForm'
import { JobDraftComposer } from '@/components/jobs/JobDraftComposer'
import { JobDraftBanner } from '@/components/jobs/JobDraftBanner'
import type { JobDraft } from '@/lib/job-draft'

// compose → drafting → review is the default path; manual is the escape hatch
// and doubles as the edit surface for a draft.
type Mode = 'compose' | 'drafting' | 'review' | 'manual'

function draftToFormValues(draft: JobDraft): JobFormValues {
  return {
    title: draft.title ?? '',
    description: draft.description ?? '',
    category: draft.category ?? '',
    skills: draft.skills_required,
    location: draft.location ?? '',
    budget: draft.budget ?? '',
    workType: draft.work_type ?? '',
    startDate: draft.start_date ?? '',
    endDate: draft.end_date ?? '',
    applicationDeadline: draft.application_deadline ?? '',
    duration: draft.duration ?? '',
    usageRights: draft.usage_rights ?? '',
    travelRequired: draft.travel_required ?? false,
  }
}

export default function NewJobPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('compose')
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [brief, setBrief] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultsRef = useRef<Partial<JobFormValues>>({})
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDefaults() {
      if (isLocalDemoMode()) return
      try {
        const response = await fetch('/api/me/settings')
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (cancelled) return
        defaultsRef.current = {
          category: data.job_defaults?.category ?? undefined,
          skills: Array.isArray(data.job_defaults?.skills_required) ? data.job_defaults.skills_required : undefined,
          location: data.job_defaults?.location ?? undefined,
          budget: data.job_defaults?.budget ?? undefined,
        }
      } catch {
        // Prefill is best-effort; the form still works empty.
      }
    }
    void loadDefaults()
    return () => { cancelled = true }
  }, [])

  // Workspace defaults only fill a field the hirer left empty, and never
  // overwrite a draft: what the AI understood from the brief wins.
  function applyDefaults(current: JobFormValues): JobFormValues {
    const defaults = defaultsRef.current
    return {
      ...current,
      category: current.category || (defaults.category ?? ''),
      skills: current.skills.length > 0 ? current.skills : (defaults.skills ?? []),
      location: current.location || (defaults.location ?? ''),
      budget: current.budget || (defaults.budget ?? ''),
    }
  }

  // `isRegenerate` keeps a retry inside the review view: dropping back to the
  // composer would hide the draft the hirer is still deciding about.
  async function runDraft(nextBrief: string, isRegenerate = false) {
    setDraftError(null)
    if (isRegenerate) setRegenerating(true)
    else setMode('drafting')
    try {
      const res = await fetch('/api/jobs/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: nextBrief }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDraftError(data.error ?? 'Could not draft this brief. Try again or fill it in manually.')
        if (!isRegenerate) setMode('compose')
        return
      }
      setValues(applyDefaults(draftToFormValues(data.draft as JobDraft)))
      setMode('review')
    } catch {
      setDraftError('Network error. Try again or fill it in manually.')
      if (!isRegenerate) setMode('compose')
    } finally {
      if (isRegenerate) setRegenerating(false)
    }
  }

  function regenerate() {
    if (brief.trim()) void runDraft(brief.trim(), true)
  }

  function goManual() {
    setValues(current => applyDefaults(current))
    setMode('manual')
  }

  function focusForm() {
    formRef.current?.querySelector('input')?.focus()
  }

  async function handleSubmit() {
    if (!values.title.trim() || !values.description.trim() || !values.category || !values.location.trim()) {
      setError('Title, description, category, and location are required.')
      return
    }
    setPosting(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          category: values.category,
          skills_required: values.skills,
          location: values.location,
          budget: values.budget,
          work_type: values.workType || null,
          start_date: values.startDate || null,
          end_date: values.endDate || null,
          application_deadline: values.applicationDeadline || null,
          duration: values.duration || null,
          usage_rights: values.usageRights || null,
          travel_required: values.travelRequired,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to post job'); return }
      // Land on the job itself: that is where the matched-talent shortlist is.
      router.push(`/my-jobs/${data.job.id}?posted=1`)
    } catch {
      setError('Network error')
    } finally {
      setPosting(false)
    }
  }

  const showForm = mode === 'review' || mode === 'manual'

  return (
    <div className="space-y-4">
      <PageShell />

      {(mode === 'compose' || mode === 'drafting') && (
        <JobDraftComposer
          brief={brief}
          onBriefChange={setBrief}
          onDraft={runDraft}
          drafting={mode === 'drafting'}
          error={draftError}
          onManual={goManual}
        />
      )}

      {mode === 'review' && (
        <>
          <JobDraftBanner
            values={values}
            onEdit={focusForm}
            onRegenerate={regenerate}
            regenerating={regenerating}
          />
          {draftError && (
            <p className="text-destructive border-destructive/20 bg-destructive/10 rounded-xl border px-4 py-3 text-sm">
              {draftError}
            </p>
          )}
        </>
      )}

      {showForm && (
        <div ref={formRef}>
          <JobForm
            values={values}
            onChange={setValues}
            onSubmit={handleSubmit}
            submitting={posting}
            error={error}
          />
        </div>
      )}
    </div>
  )
}
