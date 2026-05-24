import { startTransition, useEffect, useState } from 'react'
import { createMockDashboardData, tickDashboardData } from './mockData'
import type {
  DashboardData,
  DeviceDecision,
  DeviceEntry,
  DeviceStatus,
  FingerprintBundle,
  FingerprintMatrix,
  HistoryRecord,
} from './types'

const LIVE_ENABLED = import.meta.env.VITE_ENABLE_LIVE !== 'false'
const COORDINATOR_HTTP_BASE = trimTrailingSlash(
  import.meta.env.VITE_COORDINATOR_HTTP_BASE ?? 'http://127.0.0.1:8787',
)
const COORDINATOR_WS_URL =
  import.meta.env.VITE_COORDINATOR_WS_URL ?? 'ws://127.0.0.1:8787/api/v1/ws'
const INFER_WS_URL = import.meta.env.VITE_INFER_WS_URL ?? 'ws://127.0.0.1:8000/ws/infer'

interface CoordinatorStatusResponse {
  coordinator?: {
    pan_id?: string
    channel?: number
    ieee_addr?: string
    permit_join_open?: boolean
    permit_join_remaining?: number
    network_state?: string
    model_identifier?: string
  }
  decision_mode?: string
  pending_requests?: unknown[]
  device_count?: number
}

interface CoordinatorDeviceResponse {
  items?: CoordinatorDevice[]
}

interface CoordinatorDevice {
  short_addr?: string
  ieee_addr?: string
  capability?: string
  status?: string
  last_seen_at?: string
  last_decision?: string
  parent_short?: string
  metadata?: Record<string, unknown>
}

interface CoordinatorEventsResponse {
  items?: CoordinatorEvent[]
}

interface CoordinatorEvent {
  id?: number
  event_type?: string
  timestamp?: string
  payload?: Record<string, unknown>
}

interface InferResultMessage {
  type: 'infer_result'
  pred?: {
    label?: string
    confidence?: number
  }
  iq?: {
    real?: number[]
    imag?: number[]
  }
  gaf?: {
    shape?: number[]
    data?: number[][][]
  }
}

interface DashboardConnectionState {
  mode: 'mock' | 'live'
  coordinatorConnected: boolean
  inferConnected: boolean
  lastError: string | null
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(() =>
    LIVE_ENABLED ? createLiveDashboardData() : createMockDashboardData(),
  )
  const [connection, setConnection] = useState<DashboardConnectionState>({
    mode: LIVE_ENABLED ? 'live' : 'mock',
    coordinatorConnected: false,
    inferConnected: false,
    lastError: null,
  })

  useEffect(() => {
    if (!LIVE_ENABLED) {
      const interval = window.setInterval(() => {
        startTransition(() => {
          setData((previous) => tickDashboardData(previous))
        })
      }, 4800)

      return () => window.clearInterval(interval)
    }

    const abortController = new AbortController()
    let refreshTimer: number | null = null

    const setError = (message: string) => {
      setConnection((previous) => ({
        ...previous,
        lastError: message,
      }))
    }

    const refreshCoordinatorState = async () => {
      try {
        const [status, devices, events] = await Promise.all([
          fetchJson<CoordinatorStatusResponse>(`${COORDINATOR_HTTP_BASE}/api/v1/status`, abortController.signal),
          fetchJson<CoordinatorDeviceResponse>(`${COORDINATOR_HTTP_BASE}/api/v1/devices`, abortController.signal),
          fetchJson<CoordinatorEventsResponse>(`${COORDINATOR_HTTP_BASE}/api/v1/events?limit=20`, abortController.signal),
        ])

        startTransition(() => {
          setData((previous) => mergeCoordinatorState(previous, status, devices, events))
        })

        setConnection((previous) => ({
          ...previous,
          mode: 'live',
          lastError: null,
        }))
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setError(error instanceof Error ? error.message : '加载协调器状态失败')
      }
    }

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        return
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        void refreshCoordinatorState()
      }, 250)
    }

    void refreshCoordinatorState()

    const coordinatorWs = new WebSocket(COORDINATOR_WS_URL)
    coordinatorWs.onopen = () => {
      setConnection((previous) => ({
        ...previous,
        coordinatorConnected: true,
        mode: 'live',
      }))
    }
    coordinatorWs.onerror = () => setError('协调器 WebSocket 连接失败')
    coordinatorWs.onclose = () => {
      setConnection((previous) => ({
        ...previous,
        coordinatorConnected: false,
      }))
    }
    coordinatorWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as
          | { type?: string; data?: CoordinatorStatusResponse }
          | CoordinatorEvent

        if ('type' in message && message.type === 'snapshot' && message.data) {
          startTransition(() => {
            setData((previous) =>
              applyCoordinatorSnapshotPatch(previous, message.data as CoordinatorStatusResponse),
            )
          })
          scheduleRefresh()
          return
        }

        if ('event_type' in message) {
          startTransition(() => {
            setData((previous) => mergeCoordinatorEvent(previous, message))
          })
          scheduleRefresh()
        }
      } catch {
        setError('协调器 WebSocket 消息解析失败')
      }
    }

    const inferWs = new WebSocket(INFER_WS_URL)
    inferWs.onopen = () => {
      setConnection((previous) => ({
        ...previous,
        inferConnected: true,
        mode: 'live',
      }))
    }
    inferWs.onerror = () => setError('推理服务 WebSocket 连接失败')
    inferWs.onclose = () => {
      setConnection((previous) => ({
        ...previous,
        inferConnected: false,
      }))
    }
    inferWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as InferResultMessage | { type?: string; error?: string }
        if (message.type === 'infer_result') {
          startTransition(() => {
            setData((previous) => applyInferResult(previous, message as InferResultMessage))
          })
          return
        }

        if (message.type === 'infer_error' && message.error) {
          setError(`推理服务返回错误: ${message.error}`)
        }
      } catch {
        setError('推理服务消息解析失败')
      }
    }

    return () => {
      abortController.abort()
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer)
      }
      coordinatorWs.close()
      inferWs.close()
    }
  }, [])

  return { data, connection, liveEnabled: LIVE_ENABLED }
}

async function fetchJson<T>(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

function mergeCoordinatorState(
  previous: DashboardData,
  status: CoordinatorStatusResponse,
  devices: CoordinatorDeviceResponse,
  events: CoordinatorEventsResponse,
): DashboardData {
  const mappedDevices = (devices.items ?? []).map((item) => mapDevice(item, previous.devices))
  const mappedHistory = mapHistory(events.items ?? [], mappedDevices, previous.history)
  const joinContext = deriveJoiningContext(events.items ?? [], mappedDevices, previous)

  return {
    ...previous,
    coordinator: {
      ...previous.coordinator,
      ieeeAddr: status.coordinator?.ieee_addr ?? previous.coordinator.ieeeAddr,
      panId: status.coordinator?.pan_id ?? previous.coordinator.panId,
      channel: status.coordinator?.channel ?? previous.coordinator.channel,
      permitJoinOpen: status.coordinator?.permit_join_open ?? previous.coordinator.permitJoinOpen,
      permitJoinRemaining:
        status.coordinator?.permit_join_remaining ?? previous.coordinator.permitJoinRemaining,
      decisionMode: status.decision_mode ?? previous.coordinator.decisionMode,
      pendingRequests:
        Array.isArray(status.pending_requests)
          ? status.pending_requests.length
          : previous.coordinator.pendingRequests,
      deviceCount: status.device_count ?? mappedDevices.length,
      modelIdentifier:
        status.coordinator?.model_identifier ?? previous.coordinator.modelIdentifier,
      networkState: status.coordinator?.network_state ?? previous.coordinator.networkState,
    },
    devices: mappedDevices,
    history: mappedHistory,
    joiningDevice: {
      ...previous.joiningDevice,
      ...joinContext,
    },
  }
}

function applyCoordinatorSnapshotPatch(
  previous: DashboardData,
  snapshot: CoordinatorStatusResponse,
): DashboardData {
  return {
    ...previous,
    coordinator: {
      ...previous.coordinator,
      ieeeAddr: snapshot.coordinator?.ieee_addr ?? previous.coordinator.ieeeAddr,
      panId: snapshot.coordinator?.pan_id ?? previous.coordinator.panId,
      channel: snapshot.coordinator?.channel ?? previous.coordinator.channel,
      permitJoinOpen: snapshot.coordinator?.permit_join_open ?? previous.coordinator.permitJoinOpen,
      permitJoinRemaining:
        snapshot.coordinator?.permit_join_remaining ?? previous.coordinator.permitJoinRemaining,
      decisionMode: snapshot.decision_mode ?? previous.coordinator.decisionMode,
      pendingRequests:
        Array.isArray(snapshot.pending_requests)
          ? snapshot.pending_requests.length
          : previous.coordinator.pendingRequests,
      deviceCount: snapshot.device_count ?? previous.coordinator.deviceCount,
      modelIdentifier:
        snapshot.coordinator?.model_identifier ?? previous.coordinator.modelIdentifier,
      networkState: snapshot.coordinator?.network_state ?? previous.coordinator.networkState,
    },
  }
}

function mergeCoordinatorEvent(previous: DashboardData, event: CoordinatorEvent): DashboardData {
  const mappedHistory = mapHistory([event], previous.devices, previous.history)
  const joinContext = deriveJoiningContext([event], previous.devices, previous)

  return {
    ...previous,
    history:
      mappedHistory.length > 0
        ? [...mappedHistory, ...previous.history].slice(0, 10)
        : previous.history,
    joiningDevice: {
      ...previous.joiningDevice,
      ...joinContext,
    },
  }
}

function applyInferResult(previous: DashboardData, message: InferResultMessage): DashboardData {
  const predictedLabel = message.pred?.label ?? previous.joiningDevice.predictedLabel
  const confidence = clampNumber(message.pred?.confidence, previous.joiningDevice.confidence)
  const iqReal = sanitizeSeries(message.iq?.real, previous.joiningDevice.iqSamples.real)
  const iqImag = sanitizeSeries(message.iq?.imag, previous.joiningDevice.iqSamples.imag)
  const primary = buildHeatmapsFromGaf(message.gaf) ?? previous.joiningDevice.fingerprint.primary

  return {
    ...previous,
    joiningDevice: {
      ...previous.joiningDevice,
      predictedLabel,
      confidence,
      signalScore: Math.round(confidence * 100),
      iqSamples: {
        real: iqReal,
        imag: iqImag,
      },
      fingerprint: {
        primary,
        reference: previous.joiningDevice.fingerprint.reference,
      },
    },
  }
}

function mapDevice(item: CoordinatorDevice, previousDevices: DeviceEntry[]): DeviceEntry {
  const previous = previousDevices.find((device) => device.ieeeAddr === item.ieee_addr)
  const capability = item.capability ?? previous?.capability ?? '0x00'
  const shortAddr = item.short_addr ?? previous?.shortAddr ?? '--'
  const ieeeAddr = item.ieee_addr ?? previous?.ieeeAddr ?? '--'
  const fingerprintId = readString(item.metadata?.fingerprint_id) ?? previous?.fingerprintId ?? 'unknown'
  const matchedConfidence = readNumber(item.metadata?.score) ?? previous?.matchedConfidence ?? 0.88

  return {
    ieeeAddr,
    shortAddr,
    role: inferRole(capability, shortAddr),
    capability,
    status: normalizeDeviceStatus(item.status, item.last_decision),
    lastDecision: normalizeDecision(item.last_decision, item.status),
    lastSeenAt: item.last_seen_at ?? previous?.lastSeenAt ?? new Date().toISOString(),
    fingerprintId,
    signalScore: previous?.signalScore ?? Math.round(matchedConfidence * 100),
    matchedConfidence,
    parentShort: item.parent_short ?? previous?.parentShort ?? '--',
    fingerprint: previous?.fingerprint ?? createEmptyFingerprintBundle(),
  }
}

function mapHistory(
  events: CoordinatorEvent[],
  devices: DeviceEntry[],
  previous: HistoryRecord[],
): HistoryRecord[] {
  return events
    .map((event) => mapHistoryItem(event, devices))
    .filter((item): item is HistoryRecord => item !== null)
    .concat(previous)
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
    .slice(0, 10)
}

function mapHistoryItem(event: CoordinatorEvent, devices: DeviceEntry[]): HistoryRecord | null {
  if (!event.event_type || !event.timestamp) {
    return null
  }

  const payload = event.payload ?? {}
  const decision = normalizeEventDecision(event.event_type, payload)
  if (!decision) {
    return null
  }

  const shortAddr = pickString(payload, ['short_addr', 'shortAddr']) ?? '--'
  const matchedDevice = devices.find((item) => item.shortAddr === shortAddr)
  const matchedLabel =
    pickNestedString(payload, ['details', 'response', 'fingerprint_id']) ??
    pickNestedString(payload, ['response', 'fingerprint_id']) ??
    matchedDevice?.fingerprintId ??
    'unknown'

  return {
    id: event.id ?? Date.now(),
    ieeeAddr:
      pickString(payload, ['ieee_addr', 'ext_addr', 'long_addr', 'ieeeAddr']) ??
      matchedDevice?.ieeeAddr ??
      '--',
    shortAddr,
    decision,
    decisionLabel:
      decision === 'allow' ? '准许' : decision === 'deny' ? '拒绝' : '待决策',
    matchedLabel,
    timestamp: event.timestamp,
    latencyMs: Math.round(readNumber(payload.latency_ms) ?? 0),
    reason:
      pickNestedString(payload, ['details', 'response', 'reason']) ??
      pickNestedString(payload, ['response', 'reason']) ??
      event.event_type,
    fingerprint: createEmptyFingerprintBundle(),
  }
}

function deriveJoiningContext(
  events: CoordinatorEvent[],
  devices: DeviceEntry[],
  previous: DashboardData,
) {
  const joinEvent = events.find((event) =>
    ['access_request', 'device_associated', 'device_announce', 'access_decision', 'access_result'].includes(
      event.event_type ?? '',
    ),
  )

  if (!joinEvent) {
    return {}
  }

  const payload = joinEvent.payload ?? {}
  const shortAddr =
    pickString(payload, ['short_addr', 'shortAddr']) ?? previous.joiningDevice.shortAddr
  const matchedDevice = devices.find((device) => device.shortAddr === shortAddr)

  return {
    ieeeAddr:
      pickString(payload, ['ieee_addr', 'ext_addr', 'long_addr', 'ieeeAddr']) ??
      matchedDevice?.ieeeAddr ??
      previous.joiningDevice.ieeeAddr,
    shortAddr,
    role: matchedDevice?.role ?? previous.joiningDevice.role,
    capability:
      pickString(payload, ['capability']) ?? matchedDevice?.capability ?? previous.joiningDevice.capability,
    joinStage: mapJoinStage(joinEvent.event_type ?? previous.joiningDevice.joinStage),
  }
}

function buildHeatmapsFromGaf(gaf: InferResultMessage['gaf']): FingerprintMatrix[] | null {
  const shape = gaf?.shape ?? []
  const data = gaf?.data
  if (!Array.isArray(data) || shape[0] !== 2 || shape[1] !== 256 || shape[2] !== 256) {
    return null
  }

  return data.slice(0, 2).map((channel, index) =>
    matrixToHeatmap(channel, index === 0 ? '指纹图 A' : '指纹图 B', '实时 GAF'),
  )
}

function matrixToHeatmap(
  matrix: number[][],
  title: string,
  subtitle: string,
): FingerprintMatrix {
  const points: Array<[number, number, number]> = []
  let max = 0

  for (let y = 0; y < matrix.length; y += 1) {
    const row = matrix[y] ?? []
    for (let x = 0; x < row.length; x += 1) {
      const value = Number(row[x] ?? 0)
      max = Math.max(max, value)
      points.push([x, y, Number.isFinite(value) ? value : 0])
    }
  }

  return {
    title,
    subtitle,
    max: max > 0 ? max : 1,
    points,
  }
}

function createEmptyFingerprintBundle(): FingerprintBundle {
  return {
    primary: [],
    reference: [],
  }
}

function createLiveDashboardData(): DashboardData {
  const mock = createMockDashboardData()

  return {
    ...mock,
    tick: 0,
    coordinator: {
      ...mock.coordinator,
      ieeeAddr: '--',
      panId: '--',
      channel: 0,
      permitJoinOpen: false,
      permitJoinRemaining: 0,
      pendingRequests: 0,
      deviceCount: 0,
      modelIdentifier: '--',
      networkState: 'offline',
    },
    devices: [],
    history: [],
    joiningDevice: {
      ieeeAddr: '--',
      shortAddr: '--',
      role: '--',
      capability: '--',
      joinStage: '暂无入网请求',
      predictedLabel: '',
      confidence: 0,
      signalScore: 0,
      iqSamples: {
        real: [],
        imag: [],
      },
      fingerprint: createEmptyFingerprintBundle(),
    },
  }
}

function normalizeDeviceStatus(status?: string, lastDecision?: string): DeviceStatus {
  if (status === 'allowed') {
    return 'allowed'
  }
  if (status === 'denied' || lastDecision === 'deny') {
    return 'denied'
  }
  if (status === 'pending') {
    return 'pending'
  }
  if (status === 'offline') {
    return 'offline'
  }
  return 'allowed'
}

function normalizeDecision(value?: string, fallback?: string): DeviceDecision {
  const raw = (value ?? fallback ?? '').toLowerCase()
  if (raw.includes('deny')) {
    return 'deny'
  }
  if (raw.includes('pending') || raw.includes('request')) {
    return 'pending'
  }
  return 'allow'
}

function normalizeEventDecision(
  eventType: string,
  payload: Record<string, unknown>,
): DeviceDecision | null {
  const decision = pickString(payload, ['decision'])?.toLowerCase()
  if (decision === 'allow') {
    return 'allow'
  }
  if (decision === 'deny') {
    return 'deny'
  }
  if (eventType === 'access_request' || eventType === 'device_associated') {
    return 'pending'
  }
  if (eventType === 'access_result' || eventType === 'access_decision') {
    return 'allow'
  }
  return null
}

function inferRole(capability: string, shortAddr: string) {
  if (shortAddr === '0x0000') {
    return 'Coordinator'
  }
  const normalized = capability.toLowerCase()
  if (normalized === '0x8c') {
    return 'Router'
  }
  if (normalized === '0x80') {
    return 'EndDevice'
  }
  if (normalized === '0x84') {
    return 'Peer'
  }
  return 'Node'
}

function mapJoinStage(eventType: string) {
  switch (eventType) {
    case 'device_associated':
      return '设备关联'
    case 'device_announce':
      return '设备广播'
    case 'access_decision':
      return '等待判定'
    case 'access_result':
      return '回传结果'
    default:
      return '申请入网'
  }
}

function sanitizeSeries(value: number[] | undefined, fallback: number[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback
  }

  return value.slice(0, 1028).map((item) => (Number.isFinite(item) ? item : 0))
}

function clampNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.max(0, Math.min(1, value))
}

function pickString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }
  return null
}

function pickNestedString(payload: Record<string, unknown>, keys: string[]) {
  let current: unknown = payload
  for (const key of keys) {
    if (!current || typeof current !== 'object') {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNumber(value: unknown) {
  return typeof value === 'number' ? value : null
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
