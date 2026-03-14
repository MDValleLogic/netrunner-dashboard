
"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

const COOKIE = "vl_device_id";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${60 * 60 * 24 * 30}`;
}

interface DeviceInfo {
  device_id: string;
  nr_serial: string;
  nickname: string | null;
}

interface DeviceContextType {
  selectedDeviceId: string | null;
  selectedDevice: DeviceInfo | null;
  devices: DeviceInfo[];
  setSelectedDeviceId: (id: string) => void;
  setDevices: (devices: DeviceInfo[]) => void;
}

const DeviceContext = createContext<DeviceContextType>({
  selectedDeviceId: null,
  selectedDevice: null,
  devices: [],
  setSelectedDeviceId: () => {},
  setDevices: () => {},
});

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(null);
  const [devices, setDevicesState] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    // Load from cookie on mount
    const saved = getCookie(COOKIE);
    if (saved) setSelectedDeviceIdState(saved);

    // Load devices list
    fetch("/api/devices")
      .then(r => r.json())
      .then(data => {
        const list: DeviceInfo[] = (data.devices || [])
          .filter((d: any) => d.status === "claimed")
          .map((d: any) => ({
            device_id: d.device_id,
            nr_serial: d.nr_serial,
            nickname: d.nickname,
          }));
        setDevicesState(list);
        // Auto-select first device if none saved
        if (!saved && list.length > 0) {
          setSelectedDeviceIdState(list[0].device_id);
          setCookie(COOKIE, list[0].device_id);
        }
      })
      .catch(() => {});
  }, []);

  function setSelectedDeviceId(id: string) {
    setSelectedDeviceIdState(id);
    setCookie(COOKIE, id);
  }

  const selectedDevice = devices.find(d => d.device_id === selectedDeviceId) ?? null;

  return (
    <DeviceContext.Provider value={{ selectedDeviceId, selectedDevice, devices, setSelectedDeviceId, setDevices: setDevicesState }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  return useContext(DeviceContext);
}
