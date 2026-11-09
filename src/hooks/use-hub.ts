"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import type { Company, Idea, Workbook } from "@/lib/sheets/types";
import type { IdeaInputValues } from "@/lib/validation";

export const WORKBOOK_KEY = ["workbook"] as const;

export function useWorkbook() {
  return useQuery({
    queryKey: WORKBOOK_KEY,
    queryFn: () => api<Workbook>("/api/workbook"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useCompany(id: number) {
  const q = useWorkbook();
  const company = q.data?.companies.find((c) => c.id === id);
  return { ...q, company };
}

export function useRefresh() {
  const qc = useQueryClient();
  return async () => {
    const wb = await api<Workbook>("/api/workbook?fresh=1");
    qc.setQueryData(WORKBOOK_KEY, wb);
    return wb;
  };
}

function patchCompany(wb: Workbook | undefined, companyId: number, fn: (c: Company) => Company): Workbook | undefined {
  if (!wb) return wb;
  return { ...wb, companies: wb.companies.map((c) => (c.id === companyId ? fn(c) : c)) };
}

function reportError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    toast.error(err.message, err.status === 409 ? { description: "تم تحديث البيانات من الجدول." } : undefined);
  } else toast.error(fallback);
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { companyId: number; idea: Idea; patch: Partial<IdeaInputValues> }) =>
      api<Idea>(`/api/companies/${v.companyId}/ideas/${v.idea.row}`, {
        method: "PATCH",
        json: { version: v.idea.version, patch: v.patch },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: WORKBOOK_KEY });
      const prev = qc.getQueryData<Workbook>(WORKBOOK_KEY);
      qc.setQueryData<Workbook>(WORKBOOK_KEY, (wb) =>
        patchCompany(wb, v.companyId, (c) => ({
          ...c,
          ideas: c.ideas.map((i) =>
            i.row === v.idea.row
              ? {
                  ...i,
                  ...v.patch,
                  targetDateIso: v.patch.targetDate !== undefined ? v.patch.targetDate || null : i.targetDateIso,
                }
              : i,
          ),
        })),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(WORKBOOK_KEY, ctx.prev);
      reportError(err, "تعذر حفظ التعديل");
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
        void qc.invalidateQueries({ queryKey: WORKBOOK_KEY });
      }
    },
    onSuccess: (idea, v) => {
      qc.setQueryData<Workbook>(WORKBOOK_KEY, (wb) =>
        patchCompany(wb, v.companyId, (c) => ({ ...c, ideas: c.ideas.map((i) => (i.row === idea.row ? idea : i)) })),
      );
    },
  });
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { companyId: number; input: IdeaInputValues }) =>
      api<Idea>(`/api/companies/${v.companyId}/ideas`, { method: "POST", json: v.input }),
    onSuccess: (idea, v) => {
      qc.setQueryData<Workbook>(WORKBOOK_KEY, (wb) =>
        patchCompany(wb, v.companyId, (c) => ({
          ...c,
          ideas: [...c.ideas.filter((i) => i.row !== idea.row), idea].sort((a, b) => a.row - b.row),
        })),
      );
      toast.success("تمت إضافة الفكرة", { description: `في الصف ${idea.row} من الجدول` });
    },
    onError: (err) => reportError(err, "تعذر إضافة الفكرة"),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { companyId: number; idea: Idea }) =>
      api(`/api/companies/${v.companyId}/ideas/${v.idea.row}`, { method: "DELETE", json: { version: v.idea.version } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: WORKBOOK_KEY });
      const prev = qc.getQueryData<Workbook>(WORKBOOK_KEY);
      qc.setQueryData<Workbook>(WORKBOOK_KEY, (wb) =>
        patchCompany(wb, v.companyId, (c) => ({ ...c, ideas: c.ideas.filter((i) => i.row !== v.idea.row) })),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(WORKBOOK_KEY, ctx.prev);
      reportError(err, "تعذر حذف الفكرة");
    },
    onSuccess: () => toast.success("تم حذف الفكرة"),
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ id: number; name: string; from: string | null }>("/api/companies", { method: "POST", json: { name } }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: WORKBOOK_KEY });
      toast.success(`تمت إضافة «${res.name}»`, {
        description: res.from ? `تبويب جديد بنفس تنسيق «${res.from}»` : "تبويب جديد بالعناوين القياسية",
      });
    },
    onError: (err) => reportError(err, "تعذر إضافة الشركة"),
  });
}
