"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NodeShellProps = {
  title: string;
  tone: "blue" | "green" | "orange" | "slate";
  children: ReactNode;
  source?: boolean;
  target?: boolean;
};

const tones = {
  blue: "from-sky-400 to-blue-500",
  green: "from-emerald-300 to-teal-500",
  orange: "from-amber-300 to-orange-500",
  slate: "from-slate-300 to-slate-500"
};

export function NodeShell({
  title,
  tone,
  children,
  source = true,
  target = true
}: NodeShellProps) {
  return (
    <div className="tapnow-node min-w-72 overflow-visible">
      {target && (
        <Handle
          type="target"
          id="input"
          position={Position.Left}
          className="tapnow-handle tapnow-port tapnow-port-target !left-2 !h-9 !w-9 !border-0 !bg-white/85"
        />
      )}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/72"
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-br", tones[tone])} />
        {title}
      </div>
      <div className="space-y-3 p-4">{children}</div>
      {source && (
        <Handle
          type="source"
          id="output"
          position={Position.Right}
          className="tapnow-handle tapnow-port tapnow-port-source !-right-5 !h-10 !w-10 !border-0 !bg-cyan-300"
        />
      )}
    </div>
  );
}
