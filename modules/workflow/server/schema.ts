import { z } from "zod";

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "textPrompt",
    "stylePreset",
    "referenceImage",
    "imageGenerate",
    "imagePreview"
  ]),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.record(z.unknown()).default({})
});

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable()
});

export const workflowSchema = z.object({
  version: z.literal("1.0"),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema)
});

export type ParsedWorkflow = z.infer<typeof workflowSchema>;
