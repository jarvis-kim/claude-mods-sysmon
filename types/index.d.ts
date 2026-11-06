export type DiskStat = { usedRatio: number; freeBytes: number; totalBytes: number }
export type MemoryStat = { usedBytes: number; totalBytes: number }
export type CpuStat = { usedRatio: number }

declare module 'claude-code' {
  interface PluginState {
    sysmon: {
      disk: Shaped<DiskStat | null>
      memory: Shaped<MemoryStat | null>
      cpu: Shaped<CpuStat | null>
    }
  }
}
