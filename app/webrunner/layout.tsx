import DashboardShell from "@/components/DashboardShell";

export default function WebRunnerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
