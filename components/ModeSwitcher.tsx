"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ModeSwitcher() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!(session?.user as any)?.is_admin) return null;

  const isOverlord = pathname.startsWith("/admin");

  return (
    <div className="mx-3 mb-4 mt-2">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2 px-1">Mode</p>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => router.push("/admin")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isOverlord
              ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          <span className="text-base">⚡</span>
          <span>Overlord</span>
          {isOverlord && (
            <span className="ml-auto text-[10px] bg-violet-500/40 px-1.5 py-0.5 rounded font-mono">
              ACTIVE
            </span>
          )}
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            !isOverlord
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          <span className="text-base">📡</span>
          <span>My Dashboard</span>
          {!isOverlord && (
            <span className="ml-auto text-[10px] bg-zinc-600/60 px-1.5 py-0.5 rounded font-mono">
              ACTIVE
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
