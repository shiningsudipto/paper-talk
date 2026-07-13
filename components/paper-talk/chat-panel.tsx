"use client";

import * as React from "react";
import { SendIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

const REPLIES = [
  "Got it — I've cross-referenced that against the uploaded resource. Want the short summary or the full breakdown?",
  "That checks out with what's in your workspace document. I can draft a follow-up if that's useful.",
  "Noted. I'll keep that context for the rest of this session — anything else you'd like me to look at?",
];

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatPanel() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "seed-1",
      role: "assistant",
      content:
        "Hi, I'm your Paper Talk assistant. Upload a document in the workspace and ask me anything about it, or just start chatting.",
      time: timestamp(),
    },
  ]);
  const [draft, setDraft] = React.useState("");
  const [isReplying, setIsReplying] = React.useState(false);

  function handleSend() {
    const content = draft.trim();
    if (!content || isReplying) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      time: timestamp(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsReplying(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: REPLIES[Math.floor(Math.random() * REPLIES.length)],
          time: timestamp(),
        },
      ]);
      setIsReplying(false);
    }, 900);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Chat
          </h2>
          <p className="text-xs text-muted-foreground">
            Text conversation with context from your workspace
          </p>
        </div>
      </div>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport className="px-4 py-4">
            <MessageScrollerContent>
              {messages.map((message, index) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={index === messages.length - 1}
                >
                  <MessageRow message={message} />
                </MessageScrollerItem>
              ))}
              {isReplying && (
                <MessageScrollerItem>
                  <TypingRow />
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-card px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message Paper Talk..."
            rows={1}
            className="min-h-0 flex-1 resize-none border-0 bg-card p-0 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={!draft.trim() || isReplying}
            className="mb-0.5 shrink-0"
          >
            <SendIcon className="size-3.5" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2.5", isUser && "flex-row-reverse")}>
      <Avatar size="sm" className="mb-4 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            RA
          </AvatarFallback>
        ) : (
          <AvatarFallback className="bg-primary/15 text-primary">
            <SparklesIcon className="size-3" />
          </AvatarFallback>
        )}
      </Avatar>
      <BubbleGroup className={isUser ? "items-end" : "items-start"}>
        <Bubble
          align={isUser ? "end" : "start"}
          variant={isUser ? "default" : "secondary"}
        >
          <BubbleContent>{message.content}</BubbleContent>
        </Bubble>
        <span className="px-1 font-mono text-[10px] text-muted-foreground/70">
          {message.time}
        </span>
      </BubbleGroup>
    </div>
  );
}

function TypingRow() {
  return (
    <div className="flex items-end gap-2.5">
      <Avatar size="sm" className="mb-4 shrink-0">
        <AvatarFallback className="bg-primary/15 text-primary">
          <SparklesIcon className="size-3" />
        </AvatarFallback>
      </Avatar>
      <Bubble variant="secondary">
        <BubbleContent>
          <span className="flex items-center gap-1 py-0.5">
            <span className="size-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current opacity-60" />
          </span>
        </BubbleContent>
      </Bubble>
    </div>
  );
}

export { ChatPanel };
