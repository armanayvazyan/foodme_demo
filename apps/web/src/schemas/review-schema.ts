import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Pick a star rating").max(5),
  comment: z.string().max(1000, "Keep it under 1000 characters").optional(),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
