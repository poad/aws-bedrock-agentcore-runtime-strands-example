import { JSONValue } from '@strands-agents/sdk';
import { z } from 'zod';

export const jsonValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/**
 * BedrockAgentCoreApp の requestSchema。
 * - prompt: 新規のユーザー発話
 * - interruptResponses: 割り込みへの回答(Agent Loop再開)
 */
export const requestSchema = z.union([
  z.object({
    message: z.string(),
  }),
  z.object({
    interruptResponses: z.array(
      z.object({
        interruptId: z.string(),
        response: jsonValueSchema,
      }),
    ),
  }),
]);

export type ChatRequest = z.infer<typeof requestSchema>;
