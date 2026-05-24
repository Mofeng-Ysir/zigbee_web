export type NavigationView = 'realtime' | 'offline'

export type DeviceDecision = 'allow' | 'deny' | 'pending'

export type DeviceStatus = 'allowed' | 'pending' | 'denied' | 'offline'

export interface FingerprintMatrix {
  title: string
  subtitle: string
  max: number
  points: Array<[number, number, number]>
}

export interface FingerprintBundle {
  primary: FingerprintMatrix[]
  reference: FingerprintMatrix[]
}

export interface CoordinatorCard {
  ieeeAddr: string
  panId: string
  channel: number
  permitJoinOpen: boolean
  permitJoinRemaining: number
  decisionMode: string
  pendingRequests: number
  deviceCount: number
  modelIdentifier: string
  networkState: string
}

export interface DeviceEntry {
  ieeeAddr: string
  shortAddr: string
  role: string
  capability: string
  status: DeviceStatus
  lastDecision: DeviceDecision
  lastSeenAt: string
  fingerprintId: string
  signalScore: number
  matchedConfidence: number
  parentShort: string
  fingerprint: FingerprintBundle
}

export interface JoiningDevice {
  ieeeAddr: string
  shortAddr: string
  role: string
  capability: string
  joinStage: string
  predictedLabel: string
  confidence: number
  signalScore: number
  iqSamples: {
    real: number[]
    imag: number[]
  }
  fingerprint: FingerprintBundle
}

export interface HistoryRecord {
  id: number
  ieeeAddr: string
  shortAddr: string
  decision: DeviceDecision
  decisionLabel: string
  matchedLabel: string
  timestamp: string
  latencyMs: number
  reason: string
  fingerprint: FingerprintBundle
}

export interface OfflineDevice {
  label: string
  ieeeAddr: string
  family: string
  similarity: number
  lastUpdated: string
  tags: string[]
  fingerprint: FingerprintMatrix[]
}

export interface ComparisonItem {
  leftLabel: string
  leftIeeeAddr: string
  leftFingerprint: FingerprintMatrix[]
  rightLabel: string
  rightIeeeAddr: string
  rightFingerprint: FingerprintMatrix[]
}

export interface DashboardData {
  tick: number
  coordinator: CoordinatorCard
  devices: DeviceEntry[]
  joiningDevice: JoiningDevice
  history: HistoryRecord[]
  offlineDevices: OfflineDevice[]
  comparison: ComparisonItem[]
}
