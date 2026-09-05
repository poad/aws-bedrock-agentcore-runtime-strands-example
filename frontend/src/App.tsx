import { Authenticator, Button, Input } from '@aws-amplify/ui-react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  MessageInput,
  Message,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useRef, useState, useEffect } from 'react';
import { Streamdown } from 'streamdown';

import { SignOutButton } from './components/SignOut.jsx';
import { runAgentTurn } from './service/AgentCoreRuntimeService.ts';

import 'streamdown/styles.css';

type MessageSegment = { type: 'text'; content: string } | { type: 'tool'; toolCall: ToolCall };

interface History {
  content: string;
  sender: 'あなた' | 'AI';
  segments: MessageSegment[];
}

interface InterruptPayload {
  id: string;
  name: string;
  reason: unknown;
}

const config = await (await fetch('/config.json')).json();
const endpoint = `https://bedrock-agentcore.${config.region}.amazonaws.com`;
const escapedArn = encodeURIComponent(config.runtimeArn);
const url = `${endpoint}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`;

type ToolCallStatus = 'streaming' | 'executing' | 'complete';

interface ToolCall {
  toolUseId: string;
  name: string;
  input: string;
  result?: string;
  status: ToolCallStatus;
}

const streamEventHandler = async (
  event: unknown,
  updateMessage: (segments: MessageSegment[]) => void,
  setIsLoading: (state: boolean) => void,
) => {
  console.log(event);
  updateMessage([
    {
      type: 'text',
      content: event as string,
    },
  ]);
  setIsLoading(false);
};

function InterruptModal({
  interrupt,
  onSubmit,
  onCancel,
}: {
  interrupt: InterruptPayload;
  onSubmit: (response: string) => void;
  onCancel: () => void;
}) {
  const [response, setResponse] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(response);
  };

  // Auto-focus the input when modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>
          {interrupt.name || '確認が必要です'}
        </h2>
        <p style={{ margin: '0 0 24px 0', color: '#666', whiteSpace: 'pre-wrap' }}>
          {typeof interrupt.reason === 'string'
            ? interrupt.reason
            : JSON.stringify(interrupt.reason, null, 2)}
        </p>
        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            placeholder="回答を入力してください..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            style={{ width: '100%', marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variation="link" onClick={onCancel}>
              キャンセル
            </Button>
            <Button variation="primary" onClick={handleSubmit} disabled={!response.trim()}>
              送信
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const inputRef = useRef(null);
  const [messages, setMessages] = useState<History[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [currentInterrupt, setCurrentInterrupt] = useState<InterruptPayload | null>(null);
  const [interruptResolve, setInterruptResolve] = useState<((response: string) => void) | null>(
    null,
  );

  const updateMessage = (segments: MessageSegment[]) => {
    // Build content from text segments for backward compat
    const content = segments
      .filter((s): s is Extract<MessageSegment, { type: 'text' }> => s.type === 'text')
      .map((s) => s.content)
      .join('');

    setMessages((prev) => {
      const updated = [...prev];
      if (prev[prev.length - 1].sender === 'AI') {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          sender: 'AI',
          content: prev[prev.length - 1].content + content,
          segments: [...segments],
        };
      } else {
        updated.push({
          sender: 'AI',
          content: content,
          segments: segments,
        });
      }
      return updated;
    });
  };

  async function invoke({ message, sessionId }: { message: string; sessionId: string }) {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) {
      throw new Error('failed to fetch to access token.');
    }

    setIsLoading(true);
    await runAgentTurn({
      endpoint: url,
      sessionId,
      prompt: message,
      authToken: accessToken?.toString(),
      onAskUser: async (interrupt: InterruptPayload) => {
        // Show modal and wait for user response
        return new Promise<string>((resolve) => {
          setCurrentInterrupt(interrupt);
          setInterruptResolve(() => resolve);
        });
      },
      onDelta: (text) => {
        // トークン単位で届く応答をそのままUIに追記していく
        streamEventHandler(text, updateMessage, setIsLoading);
      },
      onMessage: (event) => streamEventHandler(event, updateMessage, setIsLoading),
    });
  }

  return (
    <Authenticator hideSignUp>
      {({ signOut }) => (
        <main>
          <div>
            <SignOutButton signOut={signOut} />
          </div>
          <div style={{ position: 'relative', height: '75vh', width: '50vw' }}>
            <MainContainer>
              <ChatContainer>
                <MessageList>
                  {messages.map((message, index) => (
                    <Message
                      key={`message-${index}`}
                      model={{
                        sender: message.sender,
                        direction: message.sender === 'あなた' ? 'incoming' : 'outgoing',
                        position: 'normal',
                      }}
                    >
                      <Message.CustomContent>
                        <div>
                          <Streamdown
                            key={index}
                            animated
                            // plugins={{ code, mermaid, math, cjk }}
                            isAnimating={true}
                          >
                            {message.content}
                          </Streamdown>
                        </div>
                      </Message.CustomContent>
                    </Message>
                  ))}
                  {isLoading ? <TypingIndicator content="thinking" /> : <></>}
                </MessageList>
                <MessageInput
                  ref={inputRef}
                  placeholder="メッセージを入力..."
                  onSend={async (_innerHtml: string, textContent: string) => {
                    setMessages((history) => [
                      ...history,
                      {
                        content: textContent,
                        sender: 'あなた',
                        segments: [
                          {
                            type: 'text',
                            content: textContent,
                          },
                        ],
                      },
                    ]);
                    await invoke({ message: textContent, sessionId });
                  }}
                />
              </ChatContainer>
            </MainContainer>
            {currentInterrupt && interruptResolve && (
              <InterruptModal
                interrupt={currentInterrupt}
                onSubmit={(response) => {
                  interruptResolve(response);
                  setCurrentInterrupt(null);
                  setInterruptResolve(null);
                }}
                onCancel={() => {
                  interruptResolve('');
                  setCurrentInterrupt(null);
                  setInterruptResolve(null);
                }}
              />
            )}
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
