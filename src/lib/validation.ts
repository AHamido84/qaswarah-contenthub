import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, `الحد الأقصى ${max} حرف`);

/** Field rules without defaults – the base for both create and patch schemas. */
const fields = {
  title: text(300).min(1, "عنوان الفكرة مطلوب"),
  description: text(4000),
  referenceUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), "رابط غير صالح، يجب أن يبدأ بـ https://"),
  platform: text(100),
  priority: text(100),
  status: text(100),
  owner: text(150),
  targetDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "تاريخ غير صالح"),
  notes: text(4000),
};

export const ideaInputSchema = z.object({
  title: fields.title,
  description: fields.description.default(""),
  referenceUrl: fields.referenceUrl.default(""),
  platform: fields.platform.default(""),
  priority: fields.priority.default(""),
  status: fields.status.default(""),
  owner: fields.owner.default(""),
  targetDate: fields.targetDate.default(""),
  notes: fields.notes.default(""),
});

export type IdeaInputValues = z.infer<typeof ideaInputSchema>;

/**
 * A patch must only contain the fields the user changed. It is built from the default-free
 * base on purpose: `.partial()` on a schema with `.default("")` would fill every missing field
 * with "" and silently clear it in the sheet.
 */
export const ideaPatchSchema = z.object({
  version: z.string().min(1),
  patch: z.object(fields).partial().strict(),
});

export const companyInputSchema = z.object({ name: z.string().trim().min(2).max(80) });

export const duplicateFixSchema = z.object({
  confirmName: z.string().min(1),
  planHash: z.string().min(1),
});
