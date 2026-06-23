import { useState, useRef, useCallback, useEffect } from 'react';
import Chatbot, { ChatbotDisplayMode } from '@patternfly/chatbot/dist/esm/Chatbot';
import ChatbotContent from '@patternfly/chatbot/dist/esm/ChatbotContent';
import ChatbotFooter from '@patternfly/chatbot/dist/esm/ChatbotFooter';
import MessageBar from '@patternfly/chatbot/dist/esm/MessageBar';
import MessageBox from '@patternfly/chatbot/dist/esm/MessageBox';
import Message from '@patternfly/chatbot/dist/esm/Message';
import '@patternfly/chatbot/dist/css/main.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  isLoading?: boolean;
}

interface ChatPaneProps {
  sessionId: string | null;
  harnessName?: string;
}

const FALLBACK_GREETING =
  "Hello! I can help you customize your container image. " +
  "What kind of project will your agent be working on?";

export function ChatPane({ sessionId, harnessName: _harnessName }: ChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'bot', content: '', isLoading: true },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const msgCounter = useRef(0);
  const currentMessageIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const controller = new AbortController();

    async function pollWelcome() {
      const POLL_INTERVAL = 1000;
      const MAX_ATTEMPTS = 30;
      let networkErrors = 0;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/session/${sessionId}/welcome`, {
            signal: controller.signal,
          });
          if (res.status === 200) {
            const data = await res.json() as { message: string };
            if (!cancelled) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === 'welcome'
                    ? { ...m, content: data.message, isLoading: false }
                    : m,
                ),
              );
              setIsReady(true);
            }
            return;
          }
        } catch {
          if (cancelled) return;
          networkErrors++;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }

      if (!cancelled) {
        const message = networkErrors >= MAX_ATTEMPTS
          ? 'Unable to connect to the agent. Check that the server is running.'
          : FALLBACK_GREETING;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'welcome'
              ? { ...m, content: message, isLoading: false }
              : m,
          ),
        );
        setIsReady(true);
      }
    }

    pollWelcome();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId]);

  const handleSend = useCallback(
    async (messageText: string | number) => {
      if (!sessionId || isStreaming) return;

      const text = String(messageText).trim();
      if (!text) return;

      const userMsgId = `msg-${++msgCounter.current}`;
      const placeholderId = `msg-${++msgCounter.current}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: text },
        { id: placeholderId, role: 'bot', content: '', isLoading: true },
      ]);

      setIsStreaming(true);
      currentMessageIdRef.current = null;

      const controller = new AbortController();
      abortRef.current = controller;

      const accumulators = new Map<string, string>();
      let activeBotId = placeholderId;

      try {
        const response = await fetch(`/api/session/${sessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data) as {
                  content?: string;
                  messageId?: string;
                  type?: string;
                  toolName?: string;
                  args?: Record<string, unknown>;
                };

                if (parsed.type === 'tool_call' && parsed.toolName) {
                  const label = parsed.toolName.replace(/^containerspec:\s*/, '');
                  const toolText = `\n\n*> ${label}*\n\n`;
                  const currentBotId = activeBotId;
                  setMessages((prevMsgs) =>
                    prevMsgs.map((m) =>
                      m.id === currentBotId
                        ? { ...m, content: m.content + toolText }
                        : m,
                    ),
                  );
                  continue;
                }

                if (!parsed.content) continue;

                const contentText = parsed.content;
                const gooseMessageId = parsed.messageId || 'default';

                if (
                  gooseMessageId !== currentMessageIdRef.current &&
                  currentMessageIdRef.current !== null
                ) {
                  const newBotId = `msg-${++msgCounter.current}`;
                  activeBotId = newBotId;
                  accumulators.set(gooseMessageId, contentText);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: newBotId,
                      role: 'bot',
                      content: contentText,
                      isLoading: true,
                    },
                  ]);
                } else {
                  const prev = accumulators.get(gooseMessageId) || '';
                  const updated = prev + contentText;
                  accumulators.set(gooseMessageId, updated);

                  const currentBotId = activeBotId;
                  setMessages((prevMsgs) =>
                    prevMsgs.map((m) =>
                      m.id === currentBotId
                        ? { ...m, content: updated }
                        : m,
                    ),
                  );
                }

                currentMessageIdRef.current = gooseMessageId;
              } catch {
                // non-JSON SSE data, skip
              }
            }
          }

          const finalContent = accumulators.size > 0
            ? Array.from(accumulators.values()).join('')
            : '';
          if (!finalContent.trim()) {
            const currentBotId = activeBotId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentBotId
                  ? { ...m, content: "The agent didn't respond. Try sending your message again." }
                  : m,
              ),
            );
          }
        } else {
          const jsonData = (await response.json()) as { content?: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    content: jsonData.content || 'No response',
                    isLoading: false,
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.isLoading ? { ...m, isLoading: false } : m,
            ),
          );
        } else {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeBotId
                ? {
                    ...m,
                    content: `Error: ${errorMessage}`,
                    isLoading: false,
                  }
                : m,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setMessages((prev) =>
          prev.map((m) => (m.isLoading ? { ...m, isLoading: false } : m)),
        );
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Chatbot displayMode={ChatbotDisplayMode.embedded}>
        <ChatbotContent>
          <MessageBox>
            {messages.map((msg) => (
              <Message
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isLoading={msg.isLoading}
                name={msg.role === 'user' ? 'You' : 'Agent'}
              />
            ))}
            <div ref={scrollAnchorRef} />
          </MessageBox>
        </ChatbotContent>
        <ChatbotFooter>
          <MessageBar
            onSendMessage={handleSend}
            isSendButtonDisabled={!isReady || isStreaming}
            placeholder={
              isReady
                ? 'Ask the agent to customize your container...'
                : 'Initializing agent...'
            }
            hasStopButton={isStreaming}
            handleStopButton={handleStop}
            isThinking={isStreaming}
          />
        </ChatbotFooter>
      </Chatbot>
    </div>
  );
}
