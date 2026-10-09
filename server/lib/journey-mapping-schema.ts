import { z } from "zod";
import { url } from "./validation";
export const mappingSchema = z.object({
  entryPoint: url,
  maxPages: z.number().int().min(1).max(20).default(8),
});
