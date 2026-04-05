import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (user?.role === "admin") redirect("/admin");
  else redirect("/dashboard");
}
