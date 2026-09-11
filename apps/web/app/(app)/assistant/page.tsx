"use client"

import { Send, Sparkles, User } from "lucide-react"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

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

import { formatFullDate, toISODate, toPersianDigits } from "@/lib/date/jalali"
import { useLessonPlans, useLookups } from "@/features/teaching/hooks"
import { systemPrompt, type ChatMessage } from "@/features/assistant/ai"
import { chat, getAiSettings } from "@/features/assistant/api"

type Bubble = {
  id: string
  role: "user" | "assistant"
  text: string
  at: number
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
  "سه ایده فعالیت کوتاه برای شروع کلاس بده",
  "بازی آموزشی برای مرور درس پیشنهاد بده",
  "تکلیف خلاقانه برای این هفته پیشنهاد بده",
] as const

export default function AssistantPage() {
  // Settings ride on the account, so any device with this login sees them.
  const { data: settings } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
  })
  const { classes, subjects, periods } = useLookups()

  // The assistant knows today's program: names feed the system prompt.
  const todayIso = useMemo(() => toISODate(new Date()), [])
  const todayPlans = useLessonPlans(todayIso, todayIso)

  const [messages, setMessages] = useState<Bubble[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  const system = systemPrompt({
    classes: classes.map((c) => c.name),
    subjects: subjects.map((s) => s.name),
    periods: periods.map((p) => p.label),
    date: formatFullDate(new Date()),
    plans: todayPlans?.map((p) => p.activity) ?? [],
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
      setMessages([...next, makeBubble("assistant", reply)])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد")
    } finally {
      setBusy(false)
    }
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
    <div className="mx-auto flex h-[calc(100dvh_-_10.5rem_-_env(safe-area-inset-bottom))] w-full max-w-3xl flex-col gap-3 md:h-[calc(100dvh-6rem)]">
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
                        <MessageContent>
                          <MessageHeader>شما</MessageHeader>
                          <p className="w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 whitespace-pre-wrap text-primary-foreground">
                            {message.text}
                          </p>
                          <MessageFooter>{timeOf(message.at)}</MessageFooter>
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
                          <div className="w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 whitespace-pre-wrap">
                            <p>{message.text}</p>
                          </div>
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
    <a href="/settings" className="text-primary underline underline-offset-4">
      تنظیمات
    </a>
  )
}
