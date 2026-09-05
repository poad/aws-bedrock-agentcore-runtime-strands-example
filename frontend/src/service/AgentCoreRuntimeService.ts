/**
 * AgentCore Runtimeエンドポイント(SSE)と通信し、
 * 割り込み(interrupt)が発生したらコールバックでユーザーに確認を取り、
 * 回答を送り返して Agent Loop を再開するクライアント。
 * agent側が agent.stream() ベースになったため、'messageDelta' で
 * トークン単位の応答も逐次受け取れる。
 *
 * 認証(Cognito JWTなど)を使う場合は fetch の headers に
 * Authorization: `Bearer ${accessToken}` を追加する。
 */

interface InterruptPayload {
  id: string;
  name: string;
  reason: unknown;
}

type AgentEvent =
  | { event: 'messageDelta'; data: { text: string } }
  | { event: 'interrupt'; data: { interrupts: InterruptPayload[] } }
  | { event: 'message'; data: { message: unknown } };

export type AskUserFn = (interrupt: InterruptPayload) => Promise<string>;

export async function runAgentTurn(params: {
  endpoint: string;
  sessionId: string;
  prompt: string;
  authToken?: string;
  onAskUser: AskUserFn;
  onDelta?: (text: string) => void;
  onMessage: (message: unknown) => void;
}): Promise<void> {
  const { endpoint, sessionId, prompt, authToken, onAskUser, onDelta, onMessage } = params;

  let body: Record<string, unknown> = { message: prompt };

  // interrupt が返ってくる限りループして送り返す
  // (1ターンの中で複数回ユーザーに確認を取るケースに対応)

  while (true) {
    let pendingInterrupts: InterruptPayload[] | null = null;
    let finalMessage: unknown = undefined;

    await postAndReadSSE(endpoint, sessionId, body, authToken, (event) => {
      if (event.event === 'messageDelta') {
        onDelta?.(event.data.text);
      } else if (event.event === 'interrupt') {
        pendingInterrupts = event.data.interrupts;
      } else if (event.event === 'message') {
        finalMessage = event.data.message;
      }
    });

    if (!pendingInterrupts) {
      onMessage(finalMessage);
      return;
    }

    // ユーザーに質問を提示し、回答を集める
    const interrupts: InterruptPayload[] = pendingInterrupts;
    const interruptResponses = await Promise.all(
      interrupts.map(async (interrupt: InterruptPayload) => ({
        interruptId: interrupt.id,
        response: await onAskUser(interrupt),
      })),
    );

    body = { interruptResponses };
  }
}

async function postAndReadSSE(
  endpoint: string,
  sessionId: string,
  body: Record<string, unknown>,
  authToken: string | undefined,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Agent request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSEは "\n\n" 区切りのイベント単位で届く
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const eventLine = chunk.split('\n').find((l) => l.startsWith('event:'));
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;

      const eventName = eventLine.replace('event:', '').trim();
      const data = JSON.parse(dataLine.replace('data:', '').trim());
      onEvent({ event: eventName, data } as AgentEvent);
    }
  }
}
