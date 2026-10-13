'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeedItem, TableName } from '@/lib/types'
import { AI_NEWS_TABLE, INVESTMENT_NEWS_TABLE, JOB_NEWS_TABLE } from '@/lib/supabase'
import { groupByDate, NEWSLETTER_SECTIONS } from '@/lib/newsFeed'
import { useNewsFeed } from '@/lib/useNewsFeed'
import { useSubmitJob } from '@/lib/useSubmitJob'
import NewsPickRow from '@/components/NewsPickRow'
import DateGroupHeader from '@/components/DateGroupHeader'
import ContentGeneratorPanel from '@/components/ContentGeneratorPanel'
import NewsletterStepTracker from '@/components/NewsletterStepTracker'
import NewsletterPickSidebar from '@/components/NewsletterPickSidebar'
import SubmittedBanner from '@/components/SubmittedBanner'

const TABLES: TableName[] = [AI_NEWS_TABLE, INVESTMENT_NEWS_TABLE, JOB_NEWS_TABLE]
const SKELETON_KEYS = [0, 1, 2, 3]

type StepKey = 'world' | 'tools' | 'insights' | 'trending'

interface Step {
  key: StepKey
  heading: string
  shortLabel: string
  section: string
  description: string
  emptyLabel: string
  max: number
}

// Each step's "section" string is sent to the generator as-is — it must match a
// heading in formats/newsletter.md exactly so the model maps the pick correctly.
const STEPS: Step[] = [
  {
    key: 'world',
    heading: 'AI World of this news',
    shortLabel: 'World',
    section: NEWSLETTER_SECTIONS[0],
    description: 'Pick 5 stories (not tools or models) with the biggest impact this period.',
    emptyLabel: 'No non-tool stories available yet.',
    max: 5,
  },
  {
    key: 'tools',
    heading: 'AI Tools update of the week',
    shortLabel: 'Tools',
    section: NEWSLETTER_SECTIONS[1],
    description: 'Pick 5 AI tool stories.',
    emptyLabel: 'No tool stories available yet.',
    max: 5,
  },
  {
    key: 'insights',
    heading: 'AI Insights',
    shortLabel: 'Insights',
    section: NEWSLETTER_SECTIONS[2],
    description: 'Pick 5 models, investment or generic AI stories (no tools).',
    emptyLabel: 'No insight stories available yet.',
    max: 5,
  },
  {
    key: 'trending',
    heading: 'AI Trending Tool of the week',
    shortLabel: 'Trending',
    section: NEWSLETTER_SECTIONS[3],
    description: 'Pick 1 AI tool story to feature as the trending tool.',
    emptyLabel: 'No tool stories available yet.',
    max: 1,
  },
]

const TOTAL_MAX = STEPS.reduce((sum, s) => sum + s.max, 0)

const isTopic = (item: FeedItem, topic: string) => item.Topic?.toLowerCase() === topic

export default function NewsletterPage() {
  const { items, loading, error } = useNewsFeed({ tables: TABLES, channel: 'newsletter-feed' })
  const job = useSubmitJob()

  const [picks, setPicks] = useState<Record<StepKey, string[]>>({
    world: [],
    tools: [],
    insights: [],
    trending: [],
  })
  const [activeStep, setActiveStep] = useState<StepKey>('world')
  const stepTopRef = useRef<HTMLDivElement>(null)

  // Every step change (auto-advance or a manual tracker/sidebar tap) lands the
  // viewport back at the top of the tracker, never mid-scroll in the list below.
  useEffect(() => {
    stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeStep])

  const toolsPool = useMemo(() => items.filter(i => isTopic(i, 'tools')), [items])
  const worldPool = useMemo(
    () => items.filter(i => !isTopic(i, 'tools') && !isTopic(i, 'models')),
    [items]
  )
  const insightsPool = useMemo(() => items.filter(i => !isTopic(i, 'tools')), [items])

  const poolOf: Record<StepKey, FeedItem[]> = {
    world: worldPool,
    tools: toolsPool,
    insights: insightsPool,
    trending: toolsPool,
  }

  const handleToggle = useCallback(
    (step: StepKey, id: string) => {
      const max = STEPS.find(s => s.key === step)!.max
      const current = picks[step]
      let next: string[]
      if (current.includes(id)) next = current.filter(i => i !== id)
      else if (max === 1) next = [id]
      else if (current.length >= max) return
      else next = [...current, id]

      setPicks(prev => ({ ...prev, [step]: next }))

      // Filling a section to its cap moves the manager straight on to the next one.
      const idx = STEPS.findIndex(s => s.key === step)
      if (!current.includes(id) && next.length >= max && idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].key)
    },
    [picks]
  )

  const slots = STEPS.map(step => ({
    key: step.key,
    label: step.heading,
    shortLabel: step.shortLabel,
    items: picks[step.key]
      .map(id => poolOf[step.key].find(i => i.id === id))
      .filter((i): i is FeedItem => !!i),
    max: step.max,
  }))
  const doneKeys = new Set(slots.filter(s => s.items.length > 0).map(s => s.key))
  const allDone = doneKeys.size === STEPS.length

  const pickedItems = useMemo(
    () =>
      STEPS.flatMap(step =>
        picks[step.key]
          .map(id => poolOf[step.key].find(i => i.id === id))
          .filter((i): i is FeedItem => !!i)
          .map(item => ({ ...item, Section: step.section }))
      ),
    [picks, worldPool, toolsPool, insightsPool]
  )

  const handleClear = useCallback(() => {
    setPicks({ world: [], tools: [], insights: [], trending: [] })
    setActiveStep('world')
  }, [])

  // Queue the picks for the morning run; on success start a fresh set of picks
  const handleSubmit = useCallback(async () => {
    if (await job.submit('newsletter', pickedItems)) handleClear()
  }, [job, pickedItems, handleClear])

  const currentStep = STEPS.find(s => s.key === activeStep)!
  const currentPool = poolOf[currentStep.key]
  const currentGroups = useMemo(() => groupByDate(currentPool), [currentPool])
  const latestDate = items[0]?.Date ?? ''

  return (
    <div className="min-h-screen bg-[--bg-primary] pb-32 sm:pb-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        <div className="mb-6 pt-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[--text-primary]">Newsletter</h1>
          <p className="text-[--text-muted] mt-1 text-sm sm:text-base">
            Pick 5 stories each for AI World, AI Tools and AI Insights, then 1 trending tool. Each section moves on automatically once it is full. The rest of the newsletter is written for you.
          </p>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div ref={stepTopRef} className="scroll-mt-[100px] lg:scroll-mt-24" />

        {!loading && items.length > 0 && (
          <div className="mb-6">
            <NewsletterStepTracker
              steps={STEPS.map(s => ({ key: s.key, shortLabel: s.shortLabel }))}
              activeKey={activeStep}
              doneKeys={doneKeys}
              onSelect={key => setActiveStep(key as StepKey)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {SKELETON_KEYS.map(i => (
              <div key={i} className="bg-[--bg-card] border border-[--border-subtle] rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[--text-muted] text-center">
            <div className="text-5xl mb-4" aria-hidden="true">📧</div>
            <p className="text-lg font-medium text-[--text-primary]">No news to pick from yet.</p>
            <p className="text-sm mt-2">News appears here as soon as the AI agent publishes it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div className="order-2 lg:order-1 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[--text-primary]">{currentStep.heading}</h2>
                <p className="text-sm text-[--text-muted] mt-0.5">{currentStep.description}</p>
              </div>

              {currentPool.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[--text-muted] text-center border border-dashed border-[--border-subtle] rounded-xl">
                  <p className="text-sm">{currentStep.emptyLabel}</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {currentGroups.map(group => (
                    <section key={group.date} className="space-y-3">
                      <DateGroupHeader date={group.date} latestDate={latestDate} count={group.items.length} />
                      <div className="flex flex-col gap-2">
                        {group.items.map(item => (
                          <NewsPickRow
                            key={item.id}
                            item={item}
                            checked={picks[currentStep.key].includes(item.id)}
                            onToggle={id => handleToggle(currentStep.key, id)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2">
              <NewsletterPickSidebar
                slots={slots}
                activeKey={activeStep}
                onSelect={key => setActiveStep(key as StepKey)}
              />
            </div>
          </div>
        )}
      </div>

      <ContentGeneratorPanel
        selectedCount={allDone && !job.error ? pickedItems.length : 0}
        format="newsletter"
        maxItems={TOTAL_MAX}
        onGenerate={handleSubmit}
        onClear={handleClear}
        isGenerating={job.isSubmitting}
        actionLabel="Submit Newsletter →"
        busyLabel="Submitting..."
      />

      {/* Shares the bottom slot with the Submit bar: success shows once picks reset, an error replaces the bar until dismissed */}
      {(job.error || !(allDone && pickedItems.length > 0)) && (
        <SubmittedBanner kind="newsletter" submittedId={job.submittedId} error={job.error} onDismiss={job.dismiss} />
      )}
    </div>
  )
}
