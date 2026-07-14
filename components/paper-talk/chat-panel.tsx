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

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChatPanel({ systemInstruction }: { systemInstruction: string }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "seed-1",
      role: "assistant",
      content:
        "Hi, I'm your Paper Talk assistant, running on Gemini. Ask me anything, or start a voice call from the left rail.",
      time: timestamp(),
    },
  ]);
  const [draft, setDraft] = React.useState("");
  const [isReplying, setIsReplying] = React.useState(false);

  async function handleSend() {
    const content = draft.trim();
    if (!content || isReplying) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      time: timestamp(),
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setDraft("");
    setIsReplying(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          systemInstruction,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to generate chat response");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "I am processing your request...",
          time: timestamp(),
        },
      ]);
    } catch (error) {
      console.error("Error communicating with chat API:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Sorry, I ran into an issue connecting with the backend server. Please verify your GEMINI_API_KEY environment configuration.",
          time: timestamp(),
        },
      ]);
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Chat
          </h2>
          <p className="text-xs text-muted-foreground">Gemini-3.5-flash text engine</p>
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
            disabled={isReplying}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
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
          <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
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
