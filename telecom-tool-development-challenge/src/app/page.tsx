import { getAuditWithItems, listAudits } from "@/lib/audit-service";
import { SAMPLE_BILL_SEEDS } from "@/lib/sample-bills";
import { BillDetectiveWorkspace } from "@/components/BillDetectiveWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const audits = await listAudits();

  const preferred =
    audits.find((a) => a.sampleSlug === SAMPLE_BILL_SEEDS[0].slug) ?? audits[0];

  const initialActiveAudit = preferred
    ? await getAuditWithItems(preferred.id)
    : null;

  return (
    <BillDetectiveWorkspace
      initialAudits={audits}
      initialActiveAudit={initialActiveAudit}
    />
  );
}
