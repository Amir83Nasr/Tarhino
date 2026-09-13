"use client"

import { Plus, Send, Sparkles, User } from "lucide-react"
import Link from "next/link"
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAiSettings } from "@/features/assistant/assistant-settings"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { toast } from "@workspace/ui/components/sonner"

import {
  addDays,
  formatFullDate,
  formatNumericDate,
  toISODate,
  toPersianDigits,
} from "@/lib/date/jalali"
import { useLessonPlans, useLookups } from "@/features/teaching/hooks"
import {
  extractPlanBlocks,
  stripPlanBlocks,
  systemPrompt,
  type ChatMessage,
  type PlanDraft,
} from "@/features/assistant/ai"
import { chat } from "@/features/assistant/api"
import { PlanCards } from "@/features/assistant/plan-card"

type Bubble = {
  id: string
  role: "user" | "assistant"
  text: string
  at: number
  plans?: PlanDraft[]
  plansDismissed?: boolean
}

const timeOf = (at: number) =>
  toPersianDigits(
    new Date(at).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  )

const bubbleId = () =>
  crypto.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

function makeBubble(role: Bubble["role"], text: string): Bubble {
  return { id: bubbleId(), role, text, at: Date.now() }
}

const SUGGESTIONS = [
  "برای کلاس‌های فردام ایده فعالیت بده",
  "برنامه امروزم را بررسی کن و پیشنهاد بهبود بده",
] as const

const HISTORY_KEY = "tarhino:assistant-history"
// ponytail: local only, cap 50. Upgrade: server-side thread storage per user.

/** Minimal markdown renderer: bold, headings, lists, rules, code.
 *  No dependency, XSS-safe (text only, no HTML parsing). */
function RichText({ text }: { text: string }) {
  return <>{renderMarkdown(text)}</>
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={key} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code
          key={key}
          className="rounded bg-background px-1 py-0.5 font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      )
    return <Fragment key={key}>{part}</Fragment>
  })
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line)
}

function renderMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let list: string[] | null = null
  let ordered: string[] | null = null
  let n = 0

  function flush() {
    if (list) {
      const items = list
      list = null
      out.push(
        <ul
          key={`ul-${n++}`}
          className="flex list-disc flex-col gap-1 ps-5 pe-4"
        >
          {items.map((item, i) => (
            <li key={i}>{inline(item, `ul-${n}-${i}`)}</li>
          ))}
        </ul>
      )
    }
    if (ordered) {
      const items = ordered
      ordered = null
      out.push(
        <ol
          key={`ol-${n++}`}
          className="flex list-decimal flex-col gap-1 ps-5 pe-4"
        >
          {items.map((item, i) => (
            <li key={i}>{inline(item, `ol-${n}-${i}`)}</li>
          ))}
        </ol>
      )
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ""
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    const next = (lines[index + 1] ?? "").trim()
    if (trimmed.includes("|") && next && isTableSeparator(next)) {
      flush()
      const header = splitTableRow(trimmed)
      const rows: string[][] = []
      index += 1
      while (index + 1 < lines.length) {
        const row = (lines[index + 1] ?? "").trim()
        if (!row || !row.includes("|")) break
        rows.push(splitTableRow(row))
        index += 1
      }
      out.push(
        <div key={`table-${n++}`} className="overflow-x-auto whitespace-normal">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th
                    key={`${i}-${cell}`}
                    className="border border-foreground/10 bg-background px-2 py-1 text-start font-bold"
                  >
                    {inline(cell, `table-${n}-h-${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="odd:bg-background/50">
                  {header.map((_, i) => (
                    <td
                      key={i}
                      className="border border-foreground/10 px-2 py-1 align-top"
                    >
                      {inline(row[i] ?? "", `table-${n}-r${r}-c${i}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }
    if (!trimmed) {
      flush()
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush()
      out.push(<hr key={`hr-${n++}`} className="my-1 border-foreground/10" />)
      continue
    }
    if (/^```/.test(trimmed)) {
      flush()
      out.push(
        <pre
          key={`pre-${n++}`}
          dir="ltr"
          className="overflow-x-auto rounded bg-background p-2 text-left font-mono text-xs"
        >
          {line.replace(/^```\w*/, "") || " "}
        </pre>
      )
      continue
    }
    if (heading) {
      flush()
      out.push(
        <p key={`h-${n++}`} className="text-sm font-bold">
          {inline(heading[2] ?? "", `h-${n}`)}
        </p>
      )
      continue
    }
    if (bullet) {
      if (ordered) flush()
      list = [...(list ?? []), bullet[1] ?? ""]
      continue
    }
    if (numbered) {
      if (list) flush()
      ordered = [...(ordered ?? []), numbered[1] ?? ""]
      continue
    }
    flush()
    out.push(<p key={`p-${n++}`}>{inline(trimmed, `p-${n}`)}</p>)
  }
  flush()
  return out
}

export default function AssistantPage() {
  // Shared key with the settings tab: one fetch serves both, tab-hopping free.
  const settings = useAiSettings()
  const { classes, subjects, periods } = useLookups()

  // The assistant knows the program: one 14-day range covers today, tomorrow
  // and the fortnight lines below — a single GET, not three, per visit.
  const todayIso = useMemo(() => toISODate(new Date()), [])
  const tomorrowIso = useMemo(() => toISODate(addDays(new Date(), 1)), [])
  const weekEndIso = useMemo(() => toISODate(addDays(new Date(), 13)), [])
  const fortnightPlans = useLessonPlans(todayIso, weekEndIso)
  const todayPlans = useMemo(
    () => (fortnightPlans ?? []).filter((p) => p.date === todayIso),
    [fortnightPlans, todayIso]
  )
  const tomorrowPlans = useMemo(
    () => (fortnightPlans ?? []).filter((p) => p.date === tomorrowIso),
    [fortnightPlans, tomorrowIso]
  )

  const weekLines = useMemo(() => {
    const lines: string[] = []
    for (let i = 0; i < 14; i++) {
      const day = addDays(new Date(), i)
      const iso = toISODate(day)
      const acts = (fortnightPlans ?? [])
        .filter((p) => p.date === iso)
        .map((p) => p.activity)
      lines.push(
        `${formatNumericDate(day)}: ${acts.length ? acts.join(" | ") : "خالی"}`
      )
    }
    return lines
  }, [fortnightPlans])

  const [messages, setMessages] = useState<Bubble[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as Bubble[]
      return Array.isArray(parsed) ? parsed.slice(-50) : []
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-50)))
    } catch {
      // quota/full: history stays in memory for this visit.
    }
  }, [messages])

  const system = systemPrompt({
    classes: classes.map((c) => c.name),
    subjects: subjects.map((s) => s.name),
    periods: periods.map((p) => p.label),
    date: formatFullDate(new Date()),
    plans: todayPlans.map((p) => p.activity),
    tomorrowDate: formatFullDate(addDays(new Date(), 1)),
    tomorrowPlans: tomorrowPlans.map((p) => p.activity),
    weekLines,
  })

  function history(next: Bubble[]): ChatMessage[] {
    return [
      { role: "system", content: system },
      ...next.map((m) => ({ role: m.role, content: m.text }) as ChatMessage),
    ]
  }

  async function ask(text: string) {
    const next: Bubble[] = [...messages, makeBubble("user", text)]
    setMessages(next)
    setBusy(true)
    try {
      const reply = await chat(history(next))
      const plans = extractPlanBlocks(reply)
      setMessages([
        ...next,
        {
          ...makeBubble("assistant", stripPlanBlocks(reply)),
          plans,
        },
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد")
    } finally {
      setBusy(false)
    }
  }

  function dismissPlans(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, plansDismissed: true } : m))
    )
  }

  const [confirmNew, setConfirmNew] = useState(false)

  function newSession() {
    if (!confirmNew) {
      setConfirmNew(true)
      return
    }
    setConfirmNew(false)
    setMessages([])
    setDraft("")
  }

  function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    void ask(text)
  }

  const unconfigured = !settings || !settings.has_key

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] w-full max-w-3xl flex-col gap-3 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg">دستیار</h1>
          <p className="text-sm text-muted-foreground">
            دستیار شما؛ به برنامه امروز وصل است.
            {unconfigured && (
              <>
                {" "}
                کلید API را در <SettingsLink /> وارد کنید.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={confirmNew ? "destructive" : "outline"}
          onClick={newSession}
          onBlur={() => setConfirmNew(false)}
          disabled={busy || messages.length === 0}
          aria-label={confirmNew ? "تأیید پاک شدن گفتگو" : "شروع گفتگوی جدید"}
        >
          <Plus />
          {confirmNew ? "پاک شود؟" : "گفتگوی جدید"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 rounded-xl bg-card ring-1 ring-foreground/10">
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="h-full">
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-4 p-4">
                {messages.length === 0 && !busy && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Sparkles className="size-6" />
                    </span>
                    <p className="text-sm text-muted-foreground">
                      سؤال بپرسید، ایده بگیرید یا طرح درس بسازید.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <Button
                          key={suggestion}
                          size="sm"
                          variant="outline"
                          disabled={unconfigured}
                          onClick={() => void ask(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) =>
                  message.role === "user" ? (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor
                    >
                      <Message align="end">
                        <MessageContent className="items-end">
                          <MessageHeader className="w-fit">شما</MessageHeader>
                          <p className="w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 whitespace-pre-wrap text-primary-foreground">
                            {message.text}
                          </p>
                          <MessageFooter className="w-fit">
                            {timeOf(message.at)}
                          </MessageFooter>
                        </MessageContent>
                        <MessageAvatar>
                          <User className="size-4" />
                        </MessageAvatar>
                      </Message>
                    </MessageScrollerItem>
                  ) : (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                    >
                      <Message align="start">
                        <MessageAvatar>
                          <Sparkles className="size-4" />
                        </MessageAvatar>
                        <MessageContent>
                          <MessageHeader>دستیار</MessageHeader>
                          {message.text && (
                            <div className="w-full rounded-lg bg-muted px-4 py-3 text-sm leading-7 whitespace-pre-wrap">
                              <RichText text={message.text} />
                            </div>
                          )}
                          {message.plans?.length && !message.plansDismissed ? (
                            <PlanCards
                              drafts={message.plans}
                              onDone={() => dismissPlans(message.id)}
                            />
                          ) : null}
                          <MessageFooter>{timeOf(message.at)}</MessageFooter>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )
                )}

                {busy && (
                  <MessageScrollerItem messageId="typing">
                    <Message align="start">
                      <MessageAvatar>
                        <Sparkles className="size-4" />
                      </MessageAvatar>
                      <MessageContent>
                        <MessageHeader>دستیار</MessageHeader>
                        <div
                          className="flex w-fit items-center gap-1 rounded-lg bg-muted px-3 py-2.5"
                          aria-label="در حال نوشتن"
                        >
                          {[0, 1, 2].map((dot) => (
                            <span
                              key={dot}
                              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                              style={{ animationDelay: `${dot * 150}ms` }}
                            />
                          ))}
                        </div>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <form className="flex items-center gap-2" onSubmit={send}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="پیام به دستیار…"
          aria-label="پیام به دستیار"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          <Send />
          ارسال
        </Button>
      </form>
    </div>
  )
}

function SettingsLink() {
  return (
    <Link
      href="/settings"
      replace
      className="text-primary underline underline-offset-4"
    >
      تنظیمات
    </Link>
  )
}
