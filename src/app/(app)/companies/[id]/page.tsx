import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanyWorkspace } from "@/components/workspace/company-workspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return (
    <Suspense>
      <CompanyWorkspace companyId={id} />
    </Suspense>
  );
}
