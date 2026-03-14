
"use client";
import { SessionProvider } from "next-auth/react";
import { DeviceProvider } from "@/lib/deviceContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DeviceProvider>{children}</DeviceProvider>
    </SessionProvider>
  );
}
