import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { WorkflowCanvas } from "@/components/workflow-canvas";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  return <WorkflowCanvas username={session.username} />;
}
