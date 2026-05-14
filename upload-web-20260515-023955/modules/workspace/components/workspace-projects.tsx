"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Grid2X2, List, MoreVertical, Plus, Search } from "lucide-react";

type WorkspaceProject = {
  id: string;
  name: string;
  updatedAt: string;
  coverClassName: string;
};

const PROJECTS_KEY = "ai-image-workflow-projects";
const PROJECT_WORKFLOW_PREFIX = "ai-image-workflow-project-";
const coverStyles = [
  "from-blue-400/70 via-sky-300/35 to-zinc-900",
  "from-fuchsia-300/55 via-indigo-300/25 to-zinc-900",
  "from-amber-200/55 via-rose-300/20 to-zinc-900",
  "from-emerald-300/55 via-cyan-300/20 to-zinc-900"
];

function createProjectId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readProjects() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceProject[]) : [];
  } catch {
    window.localStorage.removeItem(PROJECTS_KEY);
    return [];
  }
}

function writeProjects(projects: WorkspaceProject[]) {
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function formatUpdatedAt(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.round(diffMs / 1000 / 60 / 60));

  if (diffHours < 24) return `编辑于 ${diffHours} 小时前`;
  return `编辑于 ${Math.round(diffHours / 24)} 天前`;
}

export function WorkspaceProjects() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingProject, setRenamingProject] = useState<WorkspaceProject | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setProjects(readProjects());
  }, []);

  useEffect(() => {
    function closeMenu() {
      setOpenMenuId(null);
    }

    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(keyword));
  }, [projects, query]);

  function createProject() {
    const nextProject: WorkspaceProject = {
      id: createProjectId(),
      name: `未命名项目 ${projects.length + 1}`,
      updatedAt: new Date().toISOString(),
      coverClassName: coverStyles[projects.length % coverStyles.length]
    };
    const nextProjects = [nextProject, ...projects];

    writeProjects(nextProjects);
    setProjects(nextProjects);
    window.location.href = `/workspace/${nextProject.id}`;
  }

  function openRenameDialog(project: WorkspaceProject) {
    setRenamingProject(project);
    setRenameValue(project.name);
    setOpenMenuId(null);
  }

  function renameProject() {
    if (!renamingProject) return;

    const nextName = renameValue.trim();
    if (!nextName) return;

    const nextProjects = projects.map((item) =>
      item.id === renamingProject.id
        ? { ...item, name: nextName, updatedAt: new Date().toISOString() }
        : item
    );

    writeProjects(nextProjects);
    setProjects(nextProjects);
    setRenamingProject(null);
    setRenameValue("");
  }

  function deleteProject(project: WorkspaceProject) {
    const confirmed = window.confirm(`确定删除项目「${project.name}」吗？这个项目的画布也会被删除。`);

    if (!confirmed) return;

    const nextProjects = projects.filter((item) => item.id !== project.id);

    writeProjects(nextProjects);
    window.localStorage.removeItem(`${PROJECT_WORKFLOW_PREFIX}${project.id}`);
    setProjects(nextProjects);
    setOpenMenuId(null);
  }

  return (
    <main className="mx-auto max-w-[1380px] px-6 py-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button className="border-b border-white pb-2 text-sm font-semibold" type="button">
            个人
          </button>
          <button className="pb-2 text-sm text-white/45" type="button">
            团队项目
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-3 text-sm text-white/38">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索"
              className="w-32 bg-transparent text-white outline-none placeholder:text-white/35"
            />
          </label>
          <button className="rounded-xl bg-white/[0.07] px-3 py-2 text-sm text-white/78" type="button">
            显示全部
          </button>
          <div className="flex rounded-xl bg-white/[0.07] p-1">
            <button className="rounded-lg bg-white/[0.1] p-2" type="button" title="网格">
              <Grid2X2 className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-white/45" type="button" title="列表">
              <List className="h-4 w-4" />
            </button>
          </div>
          <button className="rounded-xl bg-white/[0.07] p-2 text-white/78" type="button" title="新建文件夹">
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.09] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
            type="button"
            onClick={createProject}
          >
            <Plus className="h-4 w-4" />
            新建项目
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={createProject}
          className="flex min-h-[242px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-white transition hover:bg-white/[0.08]"
        >
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
            <Plus className="h-6 w-6" />
          </span>
          <span className="text-sm font-semibold">新建项目</span>
        </button>

        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="group relative overflow-visible rounded-2xl border border-white/10 bg-white/[0.055] transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Link href={`/workspace/${project.id}`} className="block overflow-hidden rounded-2xl">
              <div className={`h-40 rounded-b-xl bg-gradient-to-br ${project.coverClassName}`} />
              <div className="p-3">
                <h2 className="truncate text-sm font-semibold">{project.name}</h2>
                <p className="mt-1 text-xs text-white/38">{formatUpdatedAt(project.updatedAt)}</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpenMenuId((current) => (current === project.id ? null : project.id));
              }}
              className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/35 text-white/75 opacity-100 backdrop-blur transition hover:bg-black/55 hover:text-white"
              title="项目选项"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {openMenuId === project.id && (
              <div
                className="absolute right-3 top-16 z-30 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#242424] py-2 text-sm text-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <Link
                  href={`/workspace/${project.id}`}
                  className="block px-5 py-3 text-left transition hover:bg-white/[0.08]"
                >
                  打开
                </Link>
                <button
                  type="button"
                  onClick={() => openRenameDialog(project)}
                  className="block w-full px-5 py-3 text-left transition hover:bg-white/[0.08]"
                >
                  重命名
                </button>
                <button
                  type="button"
                  onClick={() => deleteProject(project)}
                  className="block w-full border-t border-white/10 px-5 py-3 text-left text-red-300 transition hover:bg-red-400/10"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {renamingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#202124] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">重命名项目</h2>
            <p className="mt-1 text-sm text-white/42">给这个项目起一个更好识别的名字。</p>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") renameProject();
                if (event.key === "Escape") setRenamingProject(null);
              }}
              autoFocus
              className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/45"
              placeholder="项目名称"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingProject(null)}
                className="rounded-xl bg-white/[0.07] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.12] hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={renameProject}
                disabled={!renameValue.trim()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/88 disabled:cursor-not-allowed disabled:opacity-45"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
