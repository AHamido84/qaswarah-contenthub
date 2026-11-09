"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Link2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useUpdateIdea } from "@/hooks/use-hub";
import { cn } from "@/lib/cn";
import { PRIORITY_RANK, priorityOf } from "@/lib/domain";
import type { Company, Idea } from "@/lib/sheets/types";
import { Avatar, DueChip, PlatformChip, PriorityBadge, StatusBadge } from "../chips";
import { useUser } from "../providers";

const NONE = "__none";

export function IdeaCard({ idea, onOpen, overlay }: { idea: Idea; onOpen?: () => void; overlay?: boolean }) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group cursor-pointer rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-[border,box-shadow,transform] hover:border-border-strong hover:shadow-md",
        overlay && "rotate-[-1.5deg] cursor-grabbing border-accent shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[14px] leading-snug font-semibold text-ink">{idea.title}</h3>
        <PriorityBadge priority={idea.priority} compact />
      </div>
      {idea.description ? <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{idea.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PlatformChip platform={idea.platform} />
        <DueChip iso={idea.targetDateIso} raw={idea.targetDate} status={idea.status} />
        {idea.referenceUrl ? (
          <a
            href={idea.referenceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="grid size-6 place-items-center rounded-md text-faint transition hover:bg-surface-3 hover:text-ink"
            title="فتح المرجع"
            aria-label="فتح رابط المرجع"
          >
            <Link2 className="size-3.5" />
          </a>
        ) : null}
        <span className="ms-auto">{idea.owner ? <Avatar name={idea.owner} size={22} /> : null}</span>
      </div>
    </div>
  );
}

function DraggableCard({ idea, onOpen, disabled }: { idea: Idea; onOpen: () => void; disabled: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: idea.row, disabled });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("outline-none", isDragging && "opacity-30")}>
      <IdeaCard idea={idea} onOpen={onOpen} />
    </div>
  );
}

function Column({
  id,
  label,
  ideas,
  onOpen,
  onAdd,
  canEdit,
}: {
  id: string;
  label: string;
  ideas: Idea[];
  onOpen: (i: Idea) => void;
  onAdd?: () => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-2xl border border-transparent bg-surface-3/60 transition-colors",
        isOver && "border-accent/50 bg-accent-soft/60",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StatusBadge status={id === NONE ? "" : label} />
        <span className="text-xs tabular-nums text-muted">{ideas.length}</span>
        {canEdit && onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="ms-auto grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
            aria-label={`إضافة فكرة في «${label}»`}
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {ideas.map((i) => (
          <DraggableCard key={i.row} idea={i} onOpen={() => onOpen(i)} disabled={!canEdit} />
        ))}
        {ideas.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border-strong/70 py-8 text-xs text-faint">
            {canEdit ? "اسحب فكرة إلى هنا" : "لا توجد أفكار"}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function BoardView({
  company,
  ideas,
  onOpen,
  onCreate,
}: {
  company: Company;
  ideas: Idea[];
  onOpen: (i: Idea) => void;
  onCreate: (defaults: { status: string }) => void;
}) {
  const user = useUser();
  const canEdit = user.can("editor");
  const update = useUpdateIdea();
  const [dragging, setDragging] = useState<Idea | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(() => {
    const order = [...company.options.status.values];
    for (const i of ideas) if (i.status && !order.includes(i.status)) order.push(i.status);
    const groups = new Map<string, Idea[]>(order.map((s) => [s, []]));
    const none: Idea[] = [];
    for (const i of ideas) (i.status ? groups.get(i.status)! : none).push(i);
    const sorted = (list: Idea[]) =>
      [...list].sort(
        (a, b) =>
          PRIORITY_RANK[priorityOf(a.priority)] - PRIORITY_RANK[priorityOf(b.priority)] ||
          (a.targetDateIso ?? "9999").localeCompare(b.targetDateIso ?? "9999"),
      );
    const cols = [...groups].map(([status, list]) => ({ id: status, label: status, ideas: sorted(list) }));
    if (none.length) cols.unshift({ id: NONE, label: "بدون حالة", ideas: sorted(none) });
    return cols;
  }, [company.options.status.values, ideas]);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const idea = ideas.find((i) => i.row === e.active.id);
    const target = e.over?.id as string | undefined;
    if (!idea || !target) return;
    const status = target === NONE ? "" : target;
    if (status === idea.status) return;
    update.mutate({ companyId: company.id, idea, patch: { status } });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(ideas.find((i) => i.row === e.active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="scrollbar-thin -mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {columns.map((c) => (
          <Column
            key={c.id}
            id={c.id}
            label={c.label}
            ideas={c.ideas}
            onOpen={onOpen}
            canEdit={canEdit}
            onAdd={() => onCreate({ status: c.id === NONE ? "" : c.id })}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {dragging ? (
          <div className="w-[284px]">
            <IdeaCard idea={dragging} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
