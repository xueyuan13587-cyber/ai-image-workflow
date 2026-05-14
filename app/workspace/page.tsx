import { AppTopNav } from "@/modules/workspace/components/app-top-nav";
import { WorkspaceProjects } from "@/modules/workspace/components/workspace-projects";
import { requireSession } from "@/modules/auth/server/server-session";

export default async function WorkspacePage() {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <AppTopNav username={session.username} />
      <WorkspaceProjects />
    </div>
  );
}
