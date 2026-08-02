import { createAgent } from './agent.js';
import { init } from './observability/exporters.js';
import { ChatRequest, requestSchema } from './types.js';
import { BedrockAgentCoreApp, RequestContext } from 'bedrock-agentcore/runtime';
import { z } from 'zod';
import { setupTracer } from '@strands-agents/sdk/telemetry';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { withAccessToken } from 'bedrock-agentcore/identity';
import { Agent, AgentResult, AgentStreamEvent, Interrupt, InterruptResponseContent } from '@strands-agents/sdk';

/** SDKの Interrupt から、フロントエンドに渡す分だけを取り出した型 */
type InterruptPayload = Pick<Interrupt, 'id' | 'name' | 'reason'>;

type Request = z.infer<typeof requestSchema>;

/** リクエストボディを agent.stream() に渡す InvokeArgs に変換する */
function toInvokeArgs(request: ChatRequest): string | InterruptResponseContent[] {
  if ('message' in request) {
    return request.message;
  }
  return request.interruptResponses.map(
    (r) => new InterruptResponseContent({ interruptId: r.interruptId, response: r.response }),
  );
}

/**
 * AgentCore Runtime は同一 sessionId のリクエストを同じマイクロVM
 * (=同じNodeプロセス) にルーティングする。そのため、プロセス内メモリの
 * Map にセッションIDごとの Agent インスタンスをキャッシュしておけば、
 * 会話履歴・割り込み状態は自然に引き継がれる。
 *
 * 注意: マイクロVMは非アクティブになると破棄されうるため、
 * 「数分後に回答が来る」といった長時間の割り込みに耐えたい場合は
 * @strands-agents/sdk の SessionManager + 永続ストレージ(S3等)を
 * 併用してディスク/外部ストアにも状態を保存すること。
 */
const sessions = new Map<string, Agent>();

async function getOrCreateAgent(sessionId: string): Promise<Agent> {
  let agent = sessions.get(sessionId);
  if (!agent) {
    agent = await createAgent({ session: sessionId });
    sessions.set(sessionId, agent);
  }
  return agent;
}

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema,
    process: async function* (request: Request, context: RequestContext) {

      interface CachedToken { readonly token: string; readonly expiresAt: number }

      const createDatabricksTokenProvider = () => {
        const providerName = process.env.DATABRICKS_OAUTH_PROVIDER_NAME;

        if (!providerName) {
          return async () => undefined;
        }

        const fetchToken = withAccessToken({
          providerName,
          scopes: ['all-apis'],
          authFlow: 'M2M',
        })(async (accessToken: string) => accessToken);

        let cached: CachedToken | undefined;

        // この関数は「リクエストハンドラーのコンテキスト内」で呼ばれることが前提
        return async (): Promise<string | undefined> => {
          const now = Date.now();
          if (cached && cached.expiresAt > now) {
            return cached.token;
          }
          const token = await fetchToken();
          cached = { token, expiresAt: now + 50 * 60 * 1000 }; // 50分でリフレッシュ
          return token;
        };
      };

      const getDatabricksToken = createDatabricksTokenProvider();
      // OTLPエクスポーターのAuthorizationヘッダーに設定
      const token = await getDatabricksToken();

      const exporters = await init(token);
      if (exporters.trace) {
        const provider = new NodeTracerProvider({
          spanProcessors: [
            // Configure OTLP endpoint programmatically
            new SimpleSpanProcessor(
              exporters.trace,
            ),
          ],
        });
        setupTracer({
          provider,
          exporters: { otlp: true, console: false },
        });
      }

      const agent = await getOrCreateAgent(context.sessionId);
      const args = toInvokeArgs(request);

      // agent.stream() は AsyncGenerator<AgentStreamEvent, AgentResult, undefined>。
      // for-await では戻り値(最終的なAgentResult)が取れないため、
      // .next() を手動で回してイベントと最終結果の両方を受け取る。
      const streamGen = await agent.stream(args);
      let step: IteratorResult<AgentStreamEvent, AgentResult> = await streamGen.next();

      while (!step.done) {
        const event = step.value;

        // トークン単位のテキストデルタをそのままSSEで流す
        if (event.type === 'modelStreamUpdateEvent' && event.event.type === 'modelContentBlockDeltaEvent' && event.event.delta?.type === 'textDelta') {
          yield { event: 'messageDelta', data: { text: event.event.delta.text } };
        }

        step = await streamGen.next();
      }

      // ループを抜けた時点で step.done は true。
      // step.value は AsyncGenerator の第2型引数 (AgentResult)。
      const result: AgentResult = step.value;

      if (result.stopReason === 'interrupt') {
        // Agent Loop がユーザー入力待ちで停止。
        // フロントエンドはこのイベントを受けて質問を表示し、
        // 同じ sessionId で interruptResponses を送り返す。
        const interrupts: InterruptPayload[] = (result.interrupts ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          reason: i.reason,
        }));

        yield { event: 'interrupt', data: { interrupts } };
        return;
      }

      yield { event: 'message', data: { message: result.lastMessage } };
    },
  },
});

app.run();
