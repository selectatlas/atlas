'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Other' },
] as const

type SafetyActionsProps = {
  profileId?: string
  jobId?: string
  subjectLabel: string
}

export function SafetyActions({ profileId, jobId, subjectLabel }: SafetyActionsProps) {
  const [blocked, setBlocked] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]['value']>('inappropriate_content')
  const [details, setDetails] = useState('')
  const [reporting, setReporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function blockProfile() {
    if (!profileId || blocked) return
    if (!window.confirm(`Block ${subjectLabel}? They will not be able to contact you.`)) return
    setBlocking(true)
    setMessage(null)
    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: profileId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setMessage(data?.error ?? 'Unable to block this profile')
        return
      }
      setBlocked(true)
      setMessage(`${subjectLabel} blocked. Manage blocks in Settings.`)
    } finally {
      setBlocking(false)
    }
  }

  async function submitReport() {
    if (reporting) return
    setReporting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_profile_id: profileId,
          reported_job_id: jobId,
          reason,
          details: details.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setMessage(data?.error ?? 'Unable to submit report')
        return
      }
      setReportOpen(false)
      setDetails('')
      setMessage('Report submitted. Our team will review it.')
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Safety</p>
      <div className="flex flex-wrap gap-2">
        {profileId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blocked || blocking}
            onClick={() => void blockProfile()}
          >
            {blocked ? 'Blocked' : blocking ? 'Blocking…' : 'Block'}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setReportOpen(true)}>
          Report
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {subjectLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="report-reason" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Reason
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={e => setReason(e.target.value as typeof reason)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {REPORT_REASONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Details (optional)
              </label>
              <Textarea
                id="report-details"
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="min-h-[80px] resize-none"
                placeholder="What happened?"
                maxLength={2000}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void submitReport()} disabled={reporting}>
                {reporting ? 'Submitting…' : 'Submit report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
