import { SignOutButton } from './components/SignOut.jsx';
import { AgentCoreRuntimeService, StreamEvent } from './service/AgentCoreRuntimeService.ts';
import { Authenticator } from '@aws-amplify/ui-react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  MessageInput,
  Message,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react';
import { useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCall: ToolCall };

interface History {
  content: string;
  sender: 'あなた' | 'AI';
  segments: MessageSegment[];
}

const config = await (await fetch('/config.json')).json();
const endpoint = `https://bedrock-agentcore.${config.region}.amazonaws.com`;
const escapedArn = encodeURIComponent(config.runtimeArn);
const url = `${endpoint}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`;

type ToolCallStatus = 'streaming' | 'executing' | 'complete';

interface ToolCall {
  toolUseId: string
  name: string
  input: string
  result?: string
  status: ToolCallStatus
}

const streamEventHandler = async (
  event: StreamEvent,
  updateMessage: (segments: MessageSegment[]) => void,
  setIsLoading: (state: boolean) => void,
) => {
  const segments: MessageSegment[] = [];
  const toolCallMap = new Map<string, ToolCall>();

  switch (event.type) {
    case 'text': {
      // If text arrives after a tool segment, mark all pending tools as complete
      const prev = segments[segments.length - 1];
      if (prev && prev.type === 'tool') {
        for (const tc of toolCallMap.values()) {
          if (tc.status === 'streaming' || tc.status === 'executing') {
            tc.status = 'complete';
          }
        }
      }
      // Append to last text segment, or create new one
      const last = segments[segments.length - 1];
      if (last && last.type === 'text') {
        last.content += event.content;
      } else {
        segments.push({ type: 'text', content: event.content });
      }
      updateMessage(segments);
      break;
    }
    case 'tool_use_start': {
      const tc: ToolCall = {
        toolUseId: event.toolUseId,
        name: event.name,
        input: '',
        status: 'streaming',
      };
      toolCallMap.set(event.toolUseId, tc);
      segments.push({ type: 'tool', toolCall: tc });
      updateMessage(segments);
      break;
    }
    case 'tool_use_delta': {
      const tc = toolCallMap.get(event.toolUseId);
      if (tc) {
        tc.input += event.input;
      }
      updateMessage(segments);
      break;
    }
    case 'tool_result': {
      const tc = toolCallMap.get(event.toolUseId);
      if (tc) {
        tc.result = event.result;
        tc.status = 'complete';
      }
      updateMessage(segments);
      break;
    }
    case 'message': {
      if (event.role === 'assistant') {
        for (const tc of toolCallMap.values()) {
          if (tc.status === 'streaming') tc.status = 'executing';
        }
        updateMessage(segments);
      }
      break;
    }
  }
  setIsLoading(false);
};

function App() {
  const inputRef = useRef(null);
  const [messages, setMessages] = useState<History[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionId] = useState(() => crypto.randomUUID());

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

  async function invoke({ message, sessionId }: { message: string, sessionId: string }) {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) {
      throw new Error('failed to fetch to access token.');
    }

    setIsLoading(true);
    await AgentCoreRuntimeService.invoke(message, sessionId, accessToken?.toString(),
      (event) => streamEventHandler(event, updateMessage, setIsLoading), url);
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
                  {
                    messages.map((message, index) => (
                      <Message
                        key={`message-${index}`}
                        model={{
                          sender: message.sender,
                          direction: message.sender === 'あなた' ? 'incoming' : 'outgoing',
                          position: 'normal',
                        }}>
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
                    ))
                  }
                  {
                    isLoading ? <TypingIndicator content="thinking" /> : <></>
                  }
                </MessageList>
                <MessageInput
                  ref={inputRef}
                  placeholder="メッセージを入力..."
                  onSend={async (
                    _innerHtml: string,
                    textContent: string) => {
                    setMessages((history) => [...history, {
                      content: textContent,
                      sender: 'あなた',
                      segments: [{
                        type: 'text',
                        content: textContent,
                      }],
                    }]);
                    await invoke({ message: textContent, sessionId });
                  }}
                />
              </ChatContainer>
            </MainContainer>
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
