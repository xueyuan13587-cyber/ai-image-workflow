import { WorkflowCanvas } from "@/modules/workflow/components/workflow-canvas";
import { requireSession } from "@/modules/auth/server/server-session";

export default async function ProjectCanvasPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const [session, { projectId }] = await Promise.all([requireSession(), params]);

  return <WorkflowCanvas username={session.username} projectId={projectId} />;
}
