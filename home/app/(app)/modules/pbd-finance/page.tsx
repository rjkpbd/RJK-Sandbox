import { cookies } from "next/headers";
import { FinanceDashboard } from "@/components/modules/pbd-finance/FinanceDashboard";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function PBDFinancePage({ searchParams }: Props) {
  const cookieStore = await cookies();
  const connected = !!cookieStore.get("qbo_realm_id")?.value;
  const { error } = await searchParams;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <FinanceDashboard connected={connected} urlError={error} />
    </div>
  );
}
