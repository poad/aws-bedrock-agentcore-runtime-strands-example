import { createAgent } from './agent.js';
import { logger } from './logger.js';
import { init } from './observability/exporters.js';
import { BedrockAgentCoreApp, RequestContext } from 'bedrock-agentcore/runtime';
import { z } from 'zod';
import { setupTracer } from '@strands-agents/sdk/telemetry';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { withAccessToken } from 'bedrock-agentcore/identity';

const requestSchema = z.object({ message: z.string().default('こんにちは！'), model: z.string().optional().default('us.amazon.nova-micro-v1:0') });
interface Request {
  message: string,
  model: string,
}

async function* handle(
  {
    message,
    model,
  }: {
    message: string,
    model: string,
  }, context: RequestContext) {

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

  const agent = await createAgent({ model, session: context.sessionId });
  for await (const event of agent.stream(message)) {
    logger.trace('[Event]', event.type);
    if (event.type === 'modelStreamUpdateEvent') {
      if (event.event.type === 'modelContentBlockDeltaEvent' &&
        event.event.delta.type === 'textDelta') {
        if (event.event.delta.type === 'textDelta') {
          yield { event: 'message', data: { text: event.event.delta.text } };
        }
      }
    }
  }
};

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema,
    process: async function* (request: Request, context: RequestContext) {
      yield await handle(request, context);
    },
  },
});

app.run();
