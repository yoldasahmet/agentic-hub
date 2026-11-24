import type { ChatMessage } from "@agentic/contracts";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

export type MessageListProps = {
  messages: ChatMessage[];
  renderMessage: (message: ChatMessage, index: number) => ReactNode;
  /** The live turn and its cards, below the last message. */
  footer?: ReactNode;
  /** Changes whenever the footer grows (streamed text), to keep the view pinned. */
  footerKey?: unknown;
};

/** How close to the bottom still counts as "following" the conversation. */
const FOLLOW_PX = 120;

/**
 * The conversation, virtualized so long chats stay fast: only messages
 * near the viewport are mounted, measured as they render. While the
 * reader is at the bottom, new messages and streamed text keep it there.
 */
export function MessageList({ messages, renderMessage, footer, footerKey }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 6,
    getItemKey: (index) => messages[index]?.id ?? index,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-pin when content grows
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, footerKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      following.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_PX;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" data-testid="message-list">
      <div className="mx-auto grid w-full max-w-3xl px-4 pt-4">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const message = messages[item.index];
            if (!message) return null;
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pb-5"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {renderMessage(message, item.index)}
              </div>
            );
          })}
        </div>
        {footer && <div className="grid gap-4 pb-4">{footer}</div>}
      </div>
    </div>
  );
}
