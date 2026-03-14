"use client";
import { useDevice } from "@/lib/deviceContext";

export default function DevicePicker() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  if (devices.length === 0) return null;
  return (
    <select
      value={selectedDeviceId ?? ""}
      onChange={e => setSelectedDeviceId(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 6,
        color: "rgba(255,255,255,0.85)",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "inherit",
        padding: "4px 8px",
        cursor: "pointer",
        outline: "none",
        width: "100%",
      }}
    >
      {devices.map(d => (
        <option key={d.device_id} value={d.device_id}>
          {d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}
        </option>
      ))}
    </select>
  );
}
