import {
  memo,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import {
  Activity,
  Archive,
  ArrowUpRight,
  Boxes,
  Brain,
  ChevronRight,
  Clock3,
  Fingerprint,
  GitCompare,
  Grid2x2,
  Hexagon,
  Info,
  Library,
  Link2,
  Network,
  Plus,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  X,
} from 'lucide-react'
import './App.css'
import { EChartView } from './components/EChartView'
import { exportFingerprintSnapshot } from './mockData'
import type {
  ComparisonItem,
  DashboardData,
  DeviceEntry,
  FingerprintMatrix,
  HistoryRecord,
  JoiningDevice,
  NavigationView,
  OfflineDevice,
} from './types'
import { useDashboardData } from './useDashboardData'

type IqChartKey =
  | 'waveform'
  | 'constellation'
  | 'envelope'
  | 'spectrum'
  | 'autocorrelation'
  | 'histogram'
  | 'phaseCloud'
  | 'radar'

interface IqChartCard {
  key: IqChartKey
  label: string
  title: string
  description: string
  highlights: string[]
  option: EChartsCoreOption
  previewOption: EChartsCoreOption
}

interface IqAnalysis {
  sampleCount: number
  labels: string[]
  pairs: Array<[number, number]>
  amplitude: number[]
  phase: number[]
  phaseCloud: Array<[number, number]>
  spectrumLabels: string[]
  spectrumValues: number[]
  histogramLabels: string[]
  histogramValues: number[]
  autocorrelationLabels: string[]
  autocorrelationValues: number[]
  rmsReal: number
  rmsImag: number
  meanAmplitude: number
  peakAmplitude: number
  phaseSpan: number
  zeroCrossRate: number
  balanceScore: number
  stabilityScore: number
  spectralFocus: number
  dominantSpectrumIndex: number
  dominantHistogramIndex: number
  autocorrelationPeak: number
}

function App() {
  const [view, setView] = useState<NavigationView>('realtime')
  const [query, setQuery] = useState('')
  const { data, connection, liveEnabled, loadAdmissionTarget, loadReferenceFingerprintByIeee } =
    useDashboardData()
  const [selectedOfflineLabel, setSelectedOfflineLabel] = useState(
    data.offlineDevices[0]?.label ?? '',
  )
  const [selectedOfflineFingerprint, setSelectedOfflineFingerprint] = useState<FingerprintMatrix[] | null>(
    null,
  )
  const [comparisonLeftLabel, setComparisonLeftLabel] = useState(
    data.offlineDevices[0]?.label ?? '',
  )
  const [comparisonRightLabel, setComparisonRightLabel] = useState(
    data.offlineDevices[1]?.label ?? data.offlineDevices[0]?.label ?? '',
  )
  const [comparisonResult, setComparisonResult] = useState<ComparisonItem | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const [modalTarget, setModalTarget] = useState<DeviceEntry | JoiningDevice | HistoryRecord | null>(
    null,
  )
  const [modalLoading, setModalLoading] = useState(false)
  const modalRequestRef = useRef(0)
  const offlineRequestRef = useRef(0)
  const loadReferenceFingerprintRef = useRef(loadReferenceFingerprintByIeee)
  const nowLabel = useNowLabel()
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    loadReferenceFingerprintRef.current = loadReferenceFingerprintByIeee
  }, [loadReferenceFingerprintByIeee])

  useEffect(() => {
    if (data.offlineDevices.length === 0) {
      return
    }

    setComparisonLeftLabel((previous) =>
      data.offlineDevices.some((item) => item.label === previous) ? previous : data.offlineDevices[0]?.label ?? '',
    )
    setComparisonRightLabel((previous) => {
      if (data.offlineDevices.some((item) => item.label === previous)) {
        return previous
      }

      return (
        data.offlineDevices.find((item) => item.label !== (data.offlineDevices[0]?.label ?? ''))?.label ??
        data.offlineDevices[0]?.label ??
        ''
      )
    })
  }, [data.offlineDevices])

  useEffect(() => {
    if (
      comparisonResult &&
      (comparisonResult.leftLabel !== comparisonLeftLabel || comparisonResult.rightLabel !== comparisonRightLabel)
    ) {
      setComparisonResult(null)
    }

    setComparisonError(null)
  }, [comparisonLeftLabel, comparisonRightLabel])

  useEffect(() => {
    if (!modalTarget) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalTarget(null)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [modalTarget])

  const filteredDevices = data.devices.filter((device) => {
    if (!deferredQuery) {
      return true
    }

    return (
      device.ieeeAddr.toLowerCase().includes(deferredQuery) ||
      device.shortAddr.toLowerCase().includes(deferredQuery) ||
      device.role.toLowerCase().includes(deferredQuery) ||
      device.fingerprintId.toLowerCase().includes(deferredQuery)
    )
  })

  const filteredHistory = data.history.filter((item) => {
    if (!deferredQuery) {
      return true
    }

    return (
      item.ieeeAddr.toLowerCase().includes(deferredQuery) ||
      item.shortAddr.toLowerCase().includes(deferredQuery) ||
      item.matchedLabel.toLowerCase().includes(deferredQuery) ||
      item.reason.toLowerCase().includes(deferredQuery)
    )
  })

  const filteredOfflineDevices = data.offlineDevices.filter((device) => {
    if (!deferredQuery) {
      return true
    }

    return (
      device.label.toLowerCase().includes(deferredQuery) ||
      device.family.toLowerCase().includes(deferredQuery) ||
      device.ieeeAddr.toLowerCase().includes(deferredQuery)
    )
  })

  const selectedOffline =
    filteredOfflineDevices.find((item) => item.label === selectedOfflineLabel) ??
    data.offlineDevices.find((item) => item.label === selectedOfflineLabel) ??
    filteredOfflineDevices[0] ??
    data.offlineDevices[0]
  const comparisonLeftDevice = data.offlineDevices.find((item) => item.label === comparisonLeftLabel)
  const comparisonRightDevice = data.offlineDevices.find((item) => item.label === comparisonRightLabel)
  const comparisonSelectedCount = countDistinctSelections(comparisonLeftLabel, comparisonRightLabel)
  const comparisonSimilarity = comparisonResult
    ? calculateFingerprintSimilarity(comparisonResult.leftFingerprint, comparisonResult.rightFingerprint)
    : null
  const selectedOfflineHeatmaps = liveEnabled
    ? selectedOfflineFingerprint ?? []
    : selectedOffline?.fingerprint ?? []
  const sidebarStatusTone = connection.coordinatorConnected && connection.inferConnected
    ? 'connected'
    : connection.coordinatorConnected || connection.inferConnected
      ? 'partial'
      : 'disconnected'

  useEffect(() => {
    const requestId = offlineRequestRef.current + 1
    offlineRequestRef.current = requestId
    setSelectedOfflineFingerprint(null)

    if (!liveEnabled || !selectedOffline?.ieeeAddr) {
      return
    }

    void loadReferenceFingerprintRef.current(selectedOffline.ieeeAddr).then((reference) => {
      if (offlineRequestRef.current !== requestId) {
        return
      }

      setSelectedOfflineFingerprint(reference?.length ? reference : null)
    })
  }, [liveEnabled, selectedOffline?.ieeeAddr])

  const handleOpenDevice = async (target: DeviceEntry | JoiningDevice | HistoryRecord) => {
    const requestId = modalRequestRef.current + 1
    modalRequestRef.current = requestId
    setModalTarget(target)
    setModalLoading(true)

    try {
      const hydratedTarget = await loadAdmissionTarget(target)
      if (modalRequestRef.current !== requestId) {
        return
      }
      setModalTarget(hydratedTarget)
    } finally {
      if (modalRequestRef.current === requestId) {
        setModalLoading(false)
      }
    }
  }

  const handleCloseModal = () => {
    modalRequestRef.current += 1
    setModalLoading(false)
    setModalTarget(null)
  }

  const handleCreateComparison = () => {
    if (!data.offlineDevices.length) {
      return
    }

    const leftLabel = selectedOffline?.label ?? data.offlineDevices[0]?.label ?? ''
    const rightLabel =
      data.offlineDevices.find((item) => item.label !== leftLabel)?.label ?? data.offlineDevices[0]?.label ?? ''

    setComparisonLeftLabel(leftLabel)
    setComparisonRightLabel(rightLabel)
    setComparisonResult(null)
    setComparisonError(null)
  }

  const handleRunComparison = async () => {
    if (!comparisonLeftDevice || !comparisonRightDevice) {
      setComparisonError('请选择两台已知设备')
      setComparisonResult(null)
      return
    }

    if (comparisonLeftDevice.label === comparisonRightDevice.label) {
      setComparisonError('请选择两台不同的设备进行比对')
      setComparisonResult(null)
      return
    }

    setComparisonLoading(true)
    setComparisonError(null)

    try {
      const [leftFingerprint, rightFingerprint] = liveEnabled
        ? await Promise.all([
            loadReferenceFingerprintByIeee(comparisonLeftDevice.ieeeAddr, undefined, true),
            loadReferenceFingerprintByIeee(comparisonRightDevice.ieeeAddr, undefined, true),
          ])
        : [comparisonLeftDevice.fingerprint, comparisonRightDevice.fingerprint]

      if (!leftFingerprint?.length || !rightFingerprint?.length) {
        setComparisonResult(null)
        setComparisonError('有设备未返回可用的参考指纹图')
        return
      }

      setComparisonResult({
        leftLabel: comparisonLeftDevice.label,
        leftIeeeAddr: comparisonLeftDevice.ieeeAddr,
        leftFingerprint,
        rightLabel: comparisonRightDevice.label,
        rightIeeeAddr: comparisonRightDevice.ieeeAddr,
        rightFingerprint,
      })
    } catch {
      setComparisonResult(null)
      setComparisonError('指纹比对失败')
    } finally {
      setComparisonLoading(false)
    }
  }

  const handleExportComparison = () => {
    if (!comparisonResult) {
      return
    }

    exportComparisonSnapshot(comparisonResult, comparisonSimilarity)
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <Activity size={16} strokeWidth={1.8} />
          </div>
          <div className="brand-copy">
            <strong>Zigbee Monitor</strong>
            <span>实时监测系统</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-group">
          <span className="sidebar-label">导航</span>
          <button
            type="button"
            className={view === 'realtime' ? 'nav-link active' : 'nav-link'}
            onClick={() => setView('realtime')}
          >
            <Activity size={14} strokeWidth={1.8} />
            <span>实时展示</span>
          </button>
          <button
            type="button"
            className={view === 'offline' ? 'nav-link active' : 'nav-link'}
            onClick={() => setView('offline')}
          >
            <Grid2x2 size={14} strokeWidth={1.8} />
            <span>离线设备</span>
          </button>
        </div>

        <div className="sidebar-fill" />

        <div className="sidebar-status">
          <div className={`sidebar-status-dot ${sidebarStatusTone}`} />
          <div>
            <strong>{liveEnabled ? '实时联调' : '模拟数据'}</strong>
            <span>
              {connection.lastError ??
                `协调器 ${connection.coordinatorConnected ? '在线' : '离线'} · 推理 ${
                  connection.inferConnected ? '模型已就绪' : '模型未就绪'
                }`}
            </span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        {view === 'realtime' ? (
          <RealtimeView
            data={data}
            devices={filteredDevices}
            history={filteredHistory}
            nowLabel={nowLabel}
            query={query}
            onQueryChange={setQuery}
            onOpenDevice={handleOpenDevice}
          />
        ) : (
          <OfflineView
            items={filteredOfflineDevices}
            selected={selectedOffline}
            selectedFingerprint={selectedOfflineHeatmaps}
            comparisonDevices={data.offlineDevices}
            comparisonLeftLabel={comparisonLeftLabel}
            comparisonRightLabel={comparisonRightLabel}
            comparisonSelectedCount={comparisonSelectedCount}
            comparisonResult={comparisonResult}
            comparisonLoading={comparisonLoading}
            comparisonError={comparisonError}
            comparisonSimilarity={comparisonSimilarity}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedOfflineLabel}
            onCreateComparison={handleCreateComparison}
            onChangeComparisonLeft={setComparisonLeftLabel}
            onChangeComparisonRight={setComparisonRightLabel}
            onRunComparison={handleRunComparison}
            onExportComparison={handleExportComparison}
          />
        )}
      </main>

      {modalTarget ? (
        <FingerprintDialog
          target={modalTarget}
          loading={modalLoading}
          onClose={handleCloseModal}
          onExport={() => exportFingerprintSnapshot(modalTarget)}
        />
      ) : null}
    </div>
  )
}

function RealtimeView({
  data,
  devices,
  history,
  nowLabel,
  query,
  onQueryChange,
  onOpenDevice,
}: {
  data: DashboardData
  devices: DeviceEntry[]
  history: HistoryRecord[]
  nowLabel: string
  query: string
  onQueryChange: (value: string) => void
  onOpenDevice: (target: DeviceEntry | JoiningDevice | HistoryRecord) => void
}) {
  const hasDevices = devices.length > 0
  const hasJoiningDevice = hasJoiningIdentity(data.joiningDevice)
  const hasIqData = hasIqSamples(data.joiningDevice)
  const [activeIqChart, setActiveIqChart] = useState<IqChartKey>('waveform')
  const hasPrediction = hasJoiningPrediction(data.joiningDevice)
  const latestJoinTime = history[0]?.timestamp
  const iqCharts = hasIqData ? buildIqChartCards(data.joiningDevice) : []
  const activeIqCard = iqCharts.find((chart) => chart.key === activeIqChart) ?? iqCharts[0] ?? null

  return (
    <>
      <header className="header-shell">
        <div className="header-title">
          <h1>实时展示</h1>
          <p>Zigbee 网络与指纹识别监控总览</p>
        </div>

        <div className="header-actions">
          <SearchBox value={query} onChange={onQueryChange} placeholder="搜索设备…" />
          <InfoBox icon={<Clock3 size={14} strokeWidth={1.8} />} text={nowLabel} />
          <GradientButton icon={<RefreshCw size={14} strokeWidth={1.8} />} label="重连设备" />
          <GradientButton icon={<Link2 size={14} strokeWidth={1.8} />} label="开关入网" />
        </div>
      </header>

      <section className="stat-row stat-row-compact">
        <StatCard
          label="PAN ID"
          value={data.coordinator.panId}
          detail="Personal Area Network"
          tone="blue"
          icon={<Hexagon size={14} strokeWidth={1.8} />}
        />
        <StatCard
          label="工作信道"
          value={formatChannelValue(data.coordinator.channel)}
          detail="2425 MHz · 2.4GHz Band"
          tone="green"
          icon={<Radio size={14} strokeWidth={1.8} />}
        />
        <StatCard
          label="网络设备总数"
          value={`${data.coordinator.deviceCount}`}
          detail="已连接路由器与终端节点"
          tone="amber"
          icon={<Boxes size={14} strokeWidth={1.8} />}
          trailing="在线"
        />
      </section>

      <section className="row row-device">
        <CardPanel
          className="device-panel"
          title={
            <div className="panel-title-group">
              <PanelTitle icon={<Network size={16} strokeWidth={1.8} />} title="网络入网设备" />
              <span className="panel-hint">长地址 / 短地址</span>
            </div>
          }
        >
          {hasDevices ? (
            <div className="device-list">
              {devices.map((device, index) => (
                <button
                  key={device.ieeeAddr}
                  type="button"
                  className={index === 0 ? 'device-row active' : 'device-row'}
                  onClick={() => onOpenDevice(device)}
                >
                  <div className="device-row-main">
                    <span className={`status-dot ${device.status}`} />
                    <div>
                      <strong>{device.ieeeAddr}</strong>
                      <span>{device.role}</span>
                    </div>
                  </div>
                  <div className="device-row-side">
                    <span className="address-chip">{device.shortAddr}</span>
                    <small>{formatShortTimestamp(device.lastSeenAt)}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState message="暂无网络设备数据" />
          )}
        </CardPanel>
      </section>

      <section className="row row-iq">
        <CardPanel
          className="iq-panel reverse-radius"
          title={<PanelTitle icon={<Activity size={16} strokeWidth={1.8} />} title="网络 IQ 数据" />}
        >
          {hasIqData && activeIqCard ? (
            <div className="iq-shell">
              <div className="iq-tabs" role="tablist" aria-label="IQ 图表类型">
                {iqCharts.map((chart) => (
                  <button
                    key={chart.key}
                    type="button"
                    className={chart.key === activeIqCard.key ? 'iq-tab active' : 'iq-tab'}
                    onClick={() => setActiveIqChart(chart.key)}
                  >
                    {chart.label}
                  </button>
                ))}
              </div>
              <div className="iq-dashboard">
                <article className="iq-stage">
                  <div className="iq-stage-head">
                    <div className="iq-stage-copy">
                      <strong>{activeIqCard.title}</strong>
                      <span>{activeIqCard.description}</span>
                    </div>
                    <div className="iq-stage-badges">
                      {activeIqCard.highlights.map((highlight) => (
                        <span key={highlight} className="iq-stage-badge">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="chart-slot iq-stage-chart">
                    <EChartView option={activeIqCard.option} />
                  </div>
                </article>

                <div className="iq-preview-grid">
                  {iqCharts
                    .filter((chart) => chart.key !== activeIqCard.key)
                    .map((chart) => (
                      <button
                        key={chart.key}
                        type="button"
                        className="iq-preview-card"
                        onClick={() => setActiveIqChart(chart.key)}
                      >
                        <div className="iq-preview-head">
                          <strong>{chart.label}</strong>
                          <span>{chart.title}</span>
                        </div>
                        <div className="iq-preview-chart">
                          <EChartView option={chart.previewOption} />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="chart-slot">
              <EmptyState message="暂无 IQ 数据" />
            </div>
          )}
        </CardPanel>
      </section>

      <section className="row row-bottom">
        <CardPanel
          className="pending-panel"
          title={
            <div className="panel-title-group">
              <PanelTitle icon={<Radio size={16} strokeWidth={1.8} />} title="正在入网设备" />
              <span className="pulse-badge">
                <span className="pulse-dot" />
                {getJoiningBadgeText(data.joiningDevice)}
              </span>
            </div>
          }
        >
          {hasJoiningDevice ? (
            <div className="pending-body">
              <button
                type="button"
                className="pending-card"
                onClick={() => onOpenDevice(data.joiningDevice)}
              >
                <div className="pending-card-head">
                  <div className="pending-avatar">
                    <ScanLine size={18} strokeWidth={1.8} />
                  </div>
                  <div className="pending-card-copy">
                    <em>长地址 (IEEE)</em>
                    <strong>{data.joiningDevice.ieeeAddr}</strong>
                    <span>
                      请求时间 {latestJoinTime ? formatShortTimestamp(latestJoinTime) : '暂无'}
                    </span>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.8} className="pending-chevron" />
                </div>
              </button>

              {hasPrediction ? (
                <div className="decision-card">
                  <div className="decision-card-head">
                    <div className="decision-title-wrap">
                      <div className="decision-icon-box">
                        <Brain size={13} strokeWidth={1.8} />
                      </div>
                      <strong>神经网络识别</strong>
                    </div>
                    <span className={`decision-state ${data.joiningDevice.decision}`}>
                      <span className="decision-state-dot" />
                      {getJoiningStateText(data.joiningDevice)}
                    </span>
                  </div>
                  <div className="decision-score-row">
                    <span>匹配置信度</span>
                    <strong>{Math.round(data.joiningDevice.confidence * 1000) / 10}%</strong>
                  </div>
                  <div className="decision-progress">
                    <div
                      className={`decision-progress-fill ${data.joiningDevice.decision}`}
                      style={{ width: `${Math.round(data.joiningDevice.confidence * 1000) / 10}%` }}
                    />
                  </div>
                  <div className="decision-footer compact">
                    <div className="decision-footer-item plain">
                      <span>模型</span>
                      <strong>FP-CNN v2</strong>
                    </div>
                    <div className="decision-footer-item plain">
                      <span>推理标签</span>
                      <strong>{data.joiningDevice.predictedLabel || '--'}</strong>
                    </div>
                    <div className="decision-footer-item plain">
                      <span>决策</span>
                      <strong className={`decision-${data.joiningDevice.decision}`}>
                        {data.joiningDevice.decisionText}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="decision-card empty-card">
                  <EmptyState message="等待推理结果" />
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="当前没有入网中的设备" />
          )}
        </CardPanel>

        <CardPanel
          className="history-panel reverse-radius"
          title={
            <div className="panel-title-group">
              <PanelTitle icon={<Archive size={16} strokeWidth={1.8} />} title="历史入网设备" />
              <span className="filter-pill">最近 10 条</span>
            </div>
          }
        >
          <div className="table-head">
            <span>长地址</span>
            <span>短地址</span>
            <span>状态</span>
            <span>时间</span>
            <span />
          </div>
          {history.length > 0 ? (
            <div className="history-list">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="history-row"
                  onClick={() => onOpenDevice(item)}
                >
                  <span>{item.ieeeAddr}</span>
                  <span>{item.shortAddr}</span>
                  <span className={`decision-tag ${item.decision}`}>{item.decisionLabel}</span>
                  <span>{formatShortTimestamp(item.timestamp)}</span>
                  <span className="row-link">
                    <ArrowUpRight size={14} strokeWidth={1.8} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <EmptyState message="暂无历史入网记录" />
            </div>
          )}
        </CardPanel>
      </section>
    </>
  )
}

function OfflineView({
  items,
  selected,
  selectedFingerprint,
  comparisonDevices,
  comparisonLeftLabel,
  comparisonRightLabel,
  comparisonSelectedCount,
  comparisonResult,
  comparisonLoading,
  comparisonError,
  comparisonSimilarity,
  query,
  onQueryChange,
  onSelect,
  onCreateComparison,
  onChangeComparisonLeft,
  onChangeComparisonRight,
  onRunComparison,
  onExportComparison,
}: {
  items: OfflineDevice[]
  selected?: OfflineDevice
  selectedFingerprint: FingerprintMatrix[]
  comparisonDevices: OfflineDevice[]
  comparisonLeftLabel: string
  comparisonRightLabel: string
  comparisonSelectedCount: number
  comparisonResult: ComparisonItem | null
  comparisonLoading: boolean
  comparisonError: string | null
  comparisonSimilarity: number | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (label: string) => void
  onCreateComparison: () => void
  onChangeComparisonLeft: (value: string) => void
  onChangeComparisonRight: (value: string) => void
  onRunComparison: () => void
  onExportComparison: () => void
}) {
  return (
    <>
      <header className="header-shell">
        <div className="header-title">
          <h1>离线设备</h1>
          <p>已知设备指纹库 · 多设备指纹比对</p>
        </div>

        <div className="header-actions">
          <GradientButton
            icon={<Plus size={14} strokeWidth={1.8} />}
            label="新建比对"
            onClick={onCreateComparison}
          />
        </div>
      </header>

      <section className="row row-offline-top">
        <CardPanel
          className="library-panel"
          title={<PanelTitle icon={<Library size={16} strokeWidth={1.8} />} title="已知设备标签" />}
        >
          <div className="library-search">
            <SearchBox value={query} onChange={onQueryChange} placeholder="搜索设备标签" compact />
          </div>
          {items.length > 0 ? (
            <div className="offline-list">
              {items.map((device) => (
                <button
                  key={device.label}
                  type="button"
                  className={device.label === selected?.label ? 'offline-row selected' : 'offline-row'}
                  onClick={() => onSelect(device.label)}
                >
                  <div className="offline-row-copy">
                    <strong>{device.label}</strong>
                    <span>{device.ieeeAddr}</span>
                  </div>
                  <div className="offline-row-side">
                    <span className="select-indicator" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState message="暂无离线设备数据" />
          )}
        </CardPanel>

        <CardPanel
          className="fingerprint-panel reverse-radius"
          title={
            <div className="panel-title-group spread">
              <PanelTitle icon={<Fingerprint size={16} strokeWidth={1.8} />} title="当前设备指纹" />
              <ScaleLegend />
            </div>
          }
        >
          {selected ? (
            <div className="fingerprint-single">
              <div className="fingerprint-column-head">
                <strong>{selected.label}</strong>
                <span>{selected.ieeeAddr}</span>
              </div>
              {selectedFingerprint.length > 0 ? (
                <div className="fingerprint-grid">
                  {selectedFingerprint.map((matrix) => (
                    <HeatmapCard key={matrix.title} matrix={matrix} compact={false} />
                  ))}
                </div>
              ) : (
                <div className="empty-shell">暂无参考指纹图</div>
              )}
            </div>
          ) : (
            <div className="empty-shell">暂无离线设备数据</div>
          )}
        </CardPanel>
      </section>

      <CardPanel
        className="comparison-panel"
        title={
          <div className="panel-title-group spread">
            <div className="panel-title-group">
              <PanelTitle icon={<GitCompare size={16} strokeWidth={1.8} />} title="多设备指纹比对" />
              <span className="compare-badge">已选择 {comparisonSelectedCount} 台设备</span>
            </div>
            <div className="compare-actions">
              <MutedButton
                icon={<RefreshCw size={14} strokeWidth={1.8} />}
                label={comparisonLoading ? '比对中…' : '开始比对'}
                onClick={onRunComparison}
                disabled={comparisonLoading || comparisonSelectedCount < 2}
              />
              <MutedButton
                icon={<Archive size={14} strokeWidth={1.8} />}
                label="导出结果"
                onClick={onExportComparison}
                disabled={!comparisonResult}
              />
            </div>
          </div>
        }
      >
        <div className="comparison-toolbar">
          <label className="compare-field">
            <span>左侧设备</span>
            <select
              className="compare-select"
              value={comparisonLeftLabel}
              onChange={(event) => onChangeComparisonLeft(event.target.value)}
            >
              {comparisonDevices.map((device) => (
                <option key={`left-${device.label}`} value={device.label}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <label className="compare-field">
            <span>右侧设备</span>
            <select
              className="compare-select"
              value={comparisonRightLabel}
              onChange={(event) => onChangeComparisonRight(event.target.value)}
            >
              {comparisonDevices.map((device) => (
                <option key={`right-${device.label}`} value={device.label}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <div className="compare-meta">
            <span className={comparisonSimilarity !== null ? 'compare-score active' : 'compare-score'}>
              {comparisonSimilarity !== null ? `相似度 ${comparisonSimilarity}%` : '等待比对结果'}
            </span>
            {comparisonError ? <span className="compare-error">{comparisonError}</span> : null}
          </div>
        </div>

        {comparisonLoading ? (
          <div className="empty-shell">正在加载参考指纹图…</div>
        ) : comparisonResult ? (
          <div className="comparison-grid">
            <article className="comparison-card">
              <div className="comparison-card-head">
                <div>
                  <strong>{comparisonResult.leftLabel}</strong>
                  <span>{comparisonResult.leftIeeeAddr}</span>
                </div>
              </div>
              <div className="comparison-heatmaps">
                {comparisonResult.leftFingerprint.map((matrix) => (
                  <HeatmapCard
                    key={`${comparisonResult.leftLabel}-${matrix.title}`}
                    matrix={matrix}
                    compact={false}
                  />
                ))}
              </div>
            </article>

            <article className="comparison-card reverse-radius">
              <div className="comparison-card-head">
                <div>
                  <strong>{comparisonResult.rightLabel}</strong>
                  <span>{comparisonResult.rightIeeeAddr}</span>
                </div>
              </div>
              <div className="comparison-heatmaps">
                {comparisonResult.rightFingerprint.map((matrix) => (
                  <HeatmapCard
                    key={`${comparisonResult.rightLabel}-${matrix.title}`}
                    matrix={matrix}
                    compact={false}
                  />
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className="empty-shell">请选择两台设备并开始比对</div>
        )}
      </CardPanel>
    </>
  )
}

function FingerprintDialog({
  target,
  loading,
  onClose,
  onExport,
}: {
  target: DeviceEntry | JoiningDevice | HistoryRecord
  loading: boolean
  onClose: () => void
  onExport: () => void
}) {
  const titleMetrics = createDialogMetrics(target)
  const hasFingerprint = hasFingerprintBundle(target.fingerprint)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="入网设备窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-title-icon">
              <Fingerprint size={16} strokeWidth={1.8} />
            </div>
            <div>
              <strong>入网设备详情</strong>
              <span>实时比对指纹图 / Fingerprint Comparison</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-metrics">
            {titleMetrics.map(([label, value]) => (
              <div key={label} className="modal-metric">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="modal-columns">
            <ModalColumn title="待入网设备指纹 · 实时样本" items={target.fingerprint.primary} loading={loading} />
            <ModalColumn title="指纹库设备对照 · 参考样本" items={target.fingerprint.reference} loading={false} />
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-note">
            <Info size={14} strokeWidth={1.8} />
            <span>基于 IQ 数据生成的设备物理层指纹</span>
          </div>
          <div className="modal-footer-actions">
            <MutedButton label="关闭" onClick={onClose} />
            <MutedButton label="导出指纹图" onClick={onExport} disabled={!hasFingerprint} />
          </div>
        </div>
      </section>
    </div>
  )
}

function ModalColumn({
  title,
  items,
  loading = false,
}: {
  title: string
  items: FingerprintMatrix[]
  loading?: boolean
}) {
  return (
    <div className="modal-column">
      <div className="modal-column-head">
        <strong>{title}</strong>
      </div>
      {items.length > 0 ? (
        <div className="modal-heatmap-grid">
          {items.map((matrix) => (
            <HeatmapCard key={matrix.title} matrix={matrix} compact={false} />
          ))}
        </div>
      ) : (
        <div className="modal-empty">
          <EmptyState message={loading ? '正在加载指纹数据…' : '暂无指纹数据'} />
        </div>
      )}
    </div>
  )
}

function CardPanel({
  title,
  className,
  children,
}: {
  title: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      <div className="panel-header">{title}</div>
      <div className="panel-divider" />
      <div className="panel-content">{children}</div>
    </section>
  )
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
  compact = false,
  trailing,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  tone: 'cyan' | 'blue' | 'green' | 'amber'
  compact?: boolean
  trailing?: string
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-head">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>{icon}</div>
      </div>
      <div className="stat-card-value">
        <strong className={compact ? 'compact' : ''}>{value}</strong>
        {trailing ? <em>{trailing}</em> : null}
      </div>
      <small>{detail}</small>
    </article>
  )
}

function SearchBox({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  compact?: boolean
}) {
  return (
    <label className={compact ? 'search-box compact' : 'search-box'}>
      <Search size={14} strokeWidth={1.8} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function InfoBox({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="info-box">
      {icon}
      <span>{text}</span>
    </div>
  )
}

function GradientButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button type="button" className="gradient-button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function MutedButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon?: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="muted-button" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <strong>{title}</strong>
    </div>
  )
}

const HeatmapCard = memo(function HeatmapCard({
  matrix,
  compact,
}: {
  matrix: FingerprintMatrix
  compact: boolean
}) {
  return (
    <article className="heatmap-card">
      <div className="heatmap-card-title">
        <strong>{matrix.title}</strong>
        <span>{matrix.subtitle}</span>
      </div>
      <div className={compact ? 'heatmap-chart compact' : 'heatmap-chart'}>
        <EChartView option={buildHeatmapOption(matrix, compact)} />
      </div>
    </article>
  )
})

function EmptyState({ message }: { message: string }) {
  return <div className="empty-shell">{message}</div>
}

function ScaleLegend() {
  return (
    <div className="scale-legend">
      <span>低</span>
      <div className="scale-bar" />
      <span>高</span>
    </div>
  )
}

function createDialogMetrics(target: DeviceEntry | JoiningDevice | HistoryRecord) {
  if ('decisionLabel' in target) {
    return [
      ['长地址', target.ieeeAddr],
      ['短地址', target.shortAddr],
      ['识别结果', target.decisionLabel],
      ['匹配设备', target.matchedLabel],
    ] as const
  }

  if ('fingerprintId' in target) {
    return [
      ['长地址', target.ieeeAddr],
      ['短地址', target.shortAddr],
      ['设备类型', target.role],
      ['指纹标签', target.fingerprintId],
    ] as const
  }

  return [
    ['长地址', target.ieeeAddr],
    ['短地址', target.shortAddr],
    ['设备类型', target.role],
    ['识别结果', target.predictedLabel || target.decisionText],
  ] as const
}

function hasJoiningIdentity(target: JoiningDevice) {
  return isPresentText(target.ieeeAddr) || isPresentText(target.shortAddr)
}

function hasJoiningPrediction(target: JoiningDevice) {
  return target.predictedLabel.trim().length > 0 || target.confidence > 0 || target.decision !== 'pending'
}

function getJoiningStateText(target: JoiningDevice) {
  return `自动判定 · ${target.decision === 'allow' ? '通过' : target.decision === 'deny' ? '拒绝' : '待判定'}`
}

function getJoiningBadgeText(target: JoiningDevice) {
  return target.decision === 'allow'
    ? 'AI 已放行'
    : target.decision === 'deny'
      ? 'AI 已拒绝'
      : 'AI 识别中'
}

function hasIqSamples(target: JoiningDevice) {
  return target.iqSamples.real.length > 0 || target.iqSamples.imag.length > 0
}

function hasFingerprintBundle(bundle: DeviceEntry['fingerprint']) {
  return (
    bundle.primary.some((matrix) => matrix.points.length > 0) ||
    bundle.reference.some((matrix) => matrix.points.length > 0)
  )
}

function isPresentText(value: string) {
  return value.trim().length > 0 && value !== '--'
}

function buildIqChartCards(device: JoiningDevice): IqChartCard[] {
  const analysis = analyzeIqSamples(device)
  const confidenceLabel = `${Math.round(device.confidence * 1000) / 10}%`
  const dominantSpectrumLabel = analysis.spectrumLabels[analysis.dominantSpectrumIndex] ?? 'B01'
  const dominantHistogramLabel = analysis.histogramLabels[analysis.dominantHistogramIndex] ?? 'H1'

  return [
    {
      key: 'waveform',
      label: 'I/Q 波形',
      title: '实时 I/Q 波形',
      description: '同步观察实部与虚部样本走势，适合定位抖动和幅度偏移。',
      highlights: [
        `样本 ${analysis.sampleCount} 点`,
        `RMS ${formatIqNumber(analysis.rmsReal)}/${formatIqNumber(analysis.rmsImag)}`,
        `信号 ${device.signalScore}`,
      ],
      option: buildIqWaveformOption(device),
      previewOption: buildIqWaveformOption(device, true),
    },
    {
      key: 'constellation',
      label: '星座图',
      title: 'I/Q 星座分布',
      description: '把每个采样点映射到 I-Q 平面，快速判断聚类、旋转和失真。',
      highlights: [
        `平衡度 ${Math.round(analysis.balanceScore)}%`,
        `均幅 ${formatIqNumber(analysis.meanAmplitude)}`,
        `峰值 ${formatIqNumber(analysis.peakAmplitude)}`,
      ],
      option: buildIqConstellationOption(analysis),
      previewOption: buildIqConstellationOption(analysis, true),
    },
    {
      key: 'envelope',
      label: '幅相轨迹',
      title: '包络与相位轨迹',
      description: '同时展示幅度包络和瞬时相位，便于看出突发漂移和相位跳变。',
      highlights: [
        `跨度 ${Math.round(analysis.phaseSpan)}°`,
        `稳定度 ${Math.round(analysis.stabilityScore)}%`,
        `过零率 ${Math.round(analysis.zeroCrossRate)}%`,
      ],
      option: buildIqEnvelopeOption(analysis),
      previewOption: buildIqEnvelopeOption(analysis, true),
    },
    {
      key: 'spectrum',
      label: '频谱能量',
      title: '归一化频谱',
      description: '对 IQ 序列做频域采样，查看主能量带和频谱集中程度。',
      highlights: [
        `主瓣 ${dominantSpectrumLabel}`,
        `集中度 ${Math.round(analysis.spectralFocus)}%`,
        `置信 ${confidenceLabel}`,
      ],
      option: buildIqSpectrumOption(analysis),
      previewOption: buildIqSpectrumOption(analysis, true),
    },
    {
      key: 'autocorrelation',
      label: '自相关',
      title: '时域自相关曲线',
      description: '观察 IQ 序列在不同时延下的相关性，适合看周期结构与短时重复。',
      highlights: [
        `次峰 ${formatIqNumber(analysis.autocorrelationPeak, 2)}`,
        `主瓣 ${dominantSpectrumLabel}`,
        `稳定度 ${Math.round(analysis.stabilityScore)}%`,
      ],
      option: buildIqAutocorrelationOption(analysis),
      previewOption: buildIqAutocorrelationOption(analysis, true),
    },
    {
      key: 'histogram',
      label: '幅度直方图',
      title: '包络幅度分布',
      description: '查看实时样本的能量集中区间，便于对比设备发射包络的离散程度。',
      highlights: [
        `密集区 ${dominantHistogramLabel}`,
        `均幅 ${formatIqNumber(analysis.meanAmplitude)}`,
        `峰值 ${formatIqNumber(analysis.peakAmplitude)}`,
      ],
      option: buildIqHistogramOption(analysis),
      previewOption: buildIqHistogramOption(analysis, true),
    },
    {
      key: 'phaseCloud',
      label: '相位云图',
      title: '相位-幅度云图',
      description: '将瞬时相位与包络幅度投影到散点平面，辅助识别旋转与幅度耦合关系。',
      highlights: [
        `相位跨度 ${Math.round(analysis.phaseSpan)}°`,
        `平衡 ${Math.round(analysis.balanceScore)}%`,
        `信号 ${device.signalScore}`,
      ],
      option: buildIqPhaseCloudOption(analysis),
      previewOption: buildIqPhaseCloudOption(analysis, true),
    },
    {
      key: 'radar',
      label: '特征雷达',
      title: '物理层特征雷达',
      description: '把当前设备的稳定性、平衡度和能量分布压缩成一张摘要图。',
      highlights: [
        `置信 ${confidenceLabel}`,
        `平衡 ${Math.round(analysis.balanceScore)}%`,
        `能量 ${Math.round(analysis.spectralFocus)}%`,
      ],
      option: buildIqRadarOption(device, analysis),
      previewOption: buildIqRadarOption(device, analysis, true),
    },
  ]
}

function buildIqWaveformOption(device: JoiningDevice, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 240 : 500,
    animationEasing: 'cubicOut',
    grid: {
      left: compact ? 8 : 14,
      right: compact ? 8 : 14,
      top: compact ? 12 : 28,
      bottom: compact ? 10 : 20,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'axis',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    legend: compact
      ? undefined
      : {
          top: 2,
          right: 8,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: {
            color: '#7d90af',
            fontSize: 11,
          },
        },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: device.iqSamples.real.map((_, index) => index.toString()),
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      axisLine: {
        show: compact,
        lineStyle: {
          color: '#243049',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.65)',
        },
      },
    },
    series: [
      {
        type: 'line',
        name: '实部',
        smooth: !compact,
        showSymbol: false,
        lineStyle: {
          width: compact ? 1.5 : 2,
          color: '#2dd4bf',
        },
        areaStyle: compact ? undefined : { color: 'rgba(45, 212, 191, 0.12)' },
        data: device.iqSamples.real,
      },
      {
        type: 'line',
        name: '虚部',
        smooth: !compact,
        showSymbol: false,
        lineStyle: {
          width: compact ? 1.5 : 2,
          color: '#38bdf8',
        },
        areaStyle: compact ? undefined : { color: 'rgba(56, 189, 248, 0.1)' },
        data: device.iqSamples.imag,
      },
    ],
  }
}

function buildIqConstellationOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 220 : 420,
    grid: {
      left: compact ? 8 : 16,
      right: compact ? 8 : 16,
      top: compact ? 10 : 22,
      bottom: compact ? 10 : 22,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'item',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    xAxis: {
      type: 'value',
      min: -1.2,
      max: 1.2,
      name: compact ? '' : 'I',
      nameTextStyle: {
        color: '#7d90af',
      },
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.45)',
        },
      },
    },
    yAxis: {
      type: 'value',
      min: -1.2,
      max: 1.2,
      name: compact ? '' : 'Q',
      nameTextStyle: {
        color: '#7d90af',
      },
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.45)',
        },
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: compact ? 4 : 7,
        itemStyle: {
          color: '#22d3ee',
          opacity: compact ? 0.8 : 0.9,
          shadowBlur: compact ? 0 : 8,
          shadowColor: 'rgba(34, 211, 238, 0.28)',
        },
        data: analysis.pairs,
      },
    ],
  }
}

function buildIqEnvelopeOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 240 : 460,
    grid: {
      left: compact ? 8 : 14,
      right: compact ? 8 : 14,
      top: compact ? 12 : 28,
      bottom: compact ? 10 : 20,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'axis',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    legend: compact
      ? undefined
      : {
          top: 2,
          right: 8,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: {
            color: '#7d90af',
            fontSize: 11,
          },
        },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: analysis.labels,
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
    },
    yAxis: [
      {
        type: 'value',
        name: compact ? '' : '幅度',
        axisLabel: {
          show: !compact,
          color: '#5f7599',
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(36, 48, 73, 0.65)',
          },
        },
      },
      {
        type: 'value',
        name: compact ? '' : '相位',
        min: -180,
        max: 180,
        axisLabel: {
          show: !compact,
          color: '#7c93b5',
          fontSize: 10,
          formatter: '{value}°',
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: [
      {
        type: 'line',
        name: '包络幅度',
        smooth: !compact,
        showSymbol: false,
        lineStyle: {
          width: compact ? 1.4 : 2,
          color: '#f59e0b',
        },
        areaStyle: compact ? undefined : { color: 'rgba(245, 158, 11, 0.08)' },
        data: analysis.amplitude,
      },
      {
        type: 'line',
        name: '瞬时相位',
        yAxisIndex: 1,
        smooth: !compact,
        showSymbol: false,
        lineStyle: {
          width: compact ? 1.2 : 1.8,
          color: '#c084fc',
        },
        data: analysis.phase,
      },
    ],
  }
}

function buildIqSpectrumOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 220 : 420,
    grid: {
      left: compact ? 8 : 14,
      right: compact ? 8 : 14,
      top: compact ? 12 : 24,
      bottom: compact ? 10 : 20,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    xAxis: {
      type: 'category',
      data: analysis.spectrumLabels,
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
        interval: compact ? 3 : 1,
      },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
        formatter: '{value}%',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.65)',
        },
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: compact ? '58%' : '68%',
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0],
        },
        data: analysis.spectrumValues,
      },
    ],
  }
}

function buildIqAutocorrelationOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 220 : 420,
    grid: {
      left: compact ? 8 : 14,
      right: compact ? 8 : 14,
      top: compact ? 12 : 24,
      bottom: compact ? 10 : 20,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'axis',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: analysis.autocorrelationLabels,
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      min: -1,
      max: 1,
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.65)',
        },
      },
    },
    series: [
      {
        type: 'line',
        smooth: !compact,
        showSymbol: false,
        lineStyle: {
          width: compact ? 1.4 : 2,
          color: '#34d399',
        },
        areaStyle: compact ? undefined : { color: 'rgba(52, 211, 153, 0.12)' },
        data: analysis.autocorrelationValues,
      },
    ],
  }
}

function buildIqHistogramOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 220 : 420,
    grid: {
      left: compact ? 8 : 14,
      right: compact ? 8 : 14,
      top: compact ? 12 : 24,
      bottom: compact ? 10 : 20,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    xAxis: {
      type: 'category',
      data: analysis.histogramLabels,
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
        formatter: '{value}%',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.65)',
        },
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: compact ? '54%' : '64%',
        itemStyle: {
          color: '#f59e0b',
          borderRadius: [4, 4, 0, 0],
        },
        data: analysis.histogramValues,
      },
    ],
  }
}

function buildIqPhaseCloudOption(analysis: IqAnalysis, compact = false): EChartsCoreOption {
  return {
    animationDuration: compact ? 220 : 420,
    grid: {
      left: compact ? 8 : 16,
      right: compact ? 8 : 16,
      top: compact ? 10 : 22,
      bottom: compact ? 10 : 22,
      containLabel: true,
    },
    tooltip: compact
      ? undefined
      : {
          trigger: 'item',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    xAxis: {
      type: 'value',
      min: -180,
      max: 180,
      name: compact ? '' : '相位',
      nameTextStyle: {
        color: '#7d90af',
      },
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
        formatter: '{value}°',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.45)',
        },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.max(1.2, Math.ceil(analysis.peakAmplitude * 10) / 10),
      name: compact ? '' : '幅度',
      nameTextStyle: {
        color: '#7d90af',
      },
      axisLine: {
        lineStyle: {
          color: '#243049',
        },
      },
      axisLabel: {
        show: !compact,
        color: '#5f7599',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.45)',
        },
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: compact ? 4 : 6,
        itemStyle: {
          color: '#c084fc',
          opacity: compact ? 0.75 : 0.85,
          shadowBlur: compact ? 0 : 8,
          shadowColor: 'rgba(192, 132, 252, 0.22)',
        },
        data: analysis.phaseCloud,
      },
    ],
  }
}

function buildIqRadarOption(
  device: JoiningDevice,
  analysis: IqAnalysis,
  compact = false,
): EChartsCoreOption {
  const radarValues = [
    Math.round(device.confidence * 100),
    Math.round(analysis.stabilityScore),
    Math.round(analysis.balanceScore),
    Math.round(analysis.spectralFocus),
    Math.round(analysis.zeroCrossRate),
    Math.round(clampIqMetric((analysis.peakAmplitude / 1.2) * 100, 0, 100)),
  ]

  return {
    animationDuration: compact ? 220 : 420,
    tooltip: compact
      ? undefined
      : {
          trigger: 'item',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
        },
    radar: {
      center: ['50%', compact ? '54%' : '56%'],
      radius: compact ? '56%' : '68%',
      indicator: [
        { name: '置信度', max: 100 },
        { name: '稳定度', max: 100 },
        { name: '平衡度', max: 100 },
        { name: '能量集中', max: 100 },
        { name: '过零率', max: 100 },
        { name: '峰值幅度', max: 100 },
      ],
      axisName: {
        color: '#7d90af',
        fontSize: compact ? 9 : 11,
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(59, 130, 246, 0.22)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(36, 48, 73, 0.75)',
        },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(19, 28, 46, 0.65)', 'rgba(26, 36, 56, 0.65)'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: radarValues,
            name: '当前特征',
            symbol: compact ? 'none' : 'circle',
            symbolSize: 5,
            lineStyle: {
              color: '#22d3ee',
              width: 2,
            },
            areaStyle: {
              color: 'rgba(34, 211, 238, 0.18)',
            },
            itemStyle: {
              color: '#22d3ee',
            },
          },
        ],
      },
    ],
  }
}

function analyzeIqSamples(device: JoiningDevice): IqAnalysis {
  const sampleCount = Math.min(device.iqSamples.real.length, device.iqSamples.imag.length)
  const labels: string[] = []
  const pairs: Array<[number, number]> = []
  const amplitude: number[] = []
  const phase: number[] = []
  const phaseCloud: Array<[number, number]> = []
  let realEnergy = 0
  let imagEnergy = 0
  let amplitudeTotal = 0
  let peakAmplitude = 0
  let phaseMin = Number.POSITIVE_INFINITY
  let phaseMax = Number.NEGATIVE_INFINITY
  let zeroCrossCount = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const real = device.iqSamples.real[index] ?? 0
    const imag = device.iqSamples.imag[index] ?? 0
    const magnitude = Math.sqrt(real * real + imag * imag)
    const phaseDeg = (Math.atan2(imag, real) * 180) / Math.PI
    const roundedMagnitude = roundIqMetric(magnitude, 3)
    const roundedPhase = roundIqMetric(phaseDeg, 1)

    labels.push(index.toString())
    pairs.push([real, imag])
    amplitude.push(roundedMagnitude)
    phase.push(roundedPhase)
    phaseCloud.push([roundedPhase, roundedMagnitude])

    realEnergy += real * real
    imagEnergy += imag * imag
    amplitudeTotal += magnitude
    peakAmplitude = Math.max(peakAmplitude, magnitude)
    phaseMin = Math.min(phaseMin, phaseDeg)
    phaseMax = Math.max(phaseMax, phaseDeg)

    if (index > 0) {
      const previousReal = device.iqSamples.real[index - 1] ?? 0
      const previousImag = device.iqSamples.imag[index - 1] ?? 0
      if (Math.sign(real) !== Math.sign(previousReal)) {
        zeroCrossCount += 1
      }
      if (Math.sign(imag) !== Math.sign(previousImag)) {
        zeroCrossCount += 1
      }
    }
  }

  const meanAmplitude = sampleCount > 0 ? amplitudeTotal / sampleCount : 0
  const amplitudeVariance =
    sampleCount > 0
      ? amplitude.reduce((total, value) => total + (value - meanAmplitude) ** 2, 0) / sampleCount
      : 0
  const amplitudeStd = Math.sqrt(amplitudeVariance)
  const rmsReal = sampleCount > 0 ? Math.sqrt(realEnergy / sampleCount) : 0
  const rmsImag = sampleCount > 0 ? Math.sqrt(imagEnergy / sampleCount) : 0
  const zeroCrossRate = sampleCount > 1 ? (zeroCrossCount / ((sampleCount - 1) * 2)) * 100 : 0
  const spectrum = buildIqSpectrumProfile(pairs, 24)
  const spectrumValues = spectrum.map((item) => roundIqMetric(item.value, 1))
  const histogram = buildIqAmplitudeHistogram(amplitude, 8)
  const autocorrelation = buildIqAutocorrelation(pairs, 28)
  const dominantSpectrumIndex = spectrumValues.reduce(
    (bestIndex, value, index, source) => (value > source[bestIndex] ? index : bestIndex),
    0,
  )
  const dominantHistogramIndex = histogram.values.reduce(
    (bestIndex, value, index, source) => (value > source[bestIndex] ? index : bestIndex),
    0,
  )
  const spectralEnergyTotal = spectrumValues.reduce((total, value) => total + value, 0)
  const spectralFocus =
    spectralEnergyTotal > 0
      ? ([...spectrumValues]
          .sort((left, right) => right - left)
          .slice(0, 3)
          .reduce((total, value) => total + value, 0) /
          spectralEnergyTotal) *
        100
      : 0
  const autocorrelationPeak = autocorrelation.values.slice(1).reduce((peak, value) => Math.max(peak, value), 0)

  return {
    sampleCount,
    labels,
    pairs,
    amplitude,
    phase,
    phaseCloud,
    spectrumLabels: spectrum.map((item) => item.label),
    spectrumValues,
    histogramLabels: histogram.labels,
    histogramValues: histogram.values,
    autocorrelationLabels: autocorrelation.labels,
    autocorrelationValues: autocorrelation.values,
    rmsReal,
    rmsImag,
    meanAmplitude,
    peakAmplitude,
    phaseSpan: sampleCount > 0 ? phaseMax - phaseMin : 0,
    zeroCrossRate,
    balanceScore: clampIqMetric(
      100 - (Math.abs(rmsReal - rmsImag) / Math.max(rmsReal, rmsImag, 1e-6)) * 100,
      0,
      100,
    ),
    stabilityScore: clampIqMetric(100 - (amplitudeStd / Math.max(meanAmplitude, 1e-6)) * 100, 0, 100),
    spectralFocus,
    dominantSpectrumIndex,
    dominantHistogramIndex,
    autocorrelationPeak,
  }
}

function buildIqSpectrumProfile(pairs: Array<[number, number]>, binCount: number) {
  const safeBins = Math.max(1, Math.min(binCount, Math.floor(pairs.length / 2) || 1))
  const magnitudes: number[] = []

  for (let bin = 1; bin <= safeBins; bin += 1) {
    let realSum = 0
    let imagSum = 0

    for (let index = 0; index < pairs.length; index += 1) {
      const [real, imag] = pairs[index]
      const angle = (2 * Math.PI * bin * index) / Math.max(pairs.length, 1)
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)

      realSum += real * cosine + imag * sine
      imagSum += imag * cosine - real * sine
    }

    magnitudes.push(Math.sqrt(realSum * realSum + imagSum * imagSum))
  }

  const peak = Math.max(...magnitudes, 1e-6)
  return magnitudes.map((value, index) => ({
    label: `B${String(index + 1).padStart(2, '0')}`,
    value: (value / peak) * 100,
  }))
}

function buildIqAmplitudeHistogram(amplitude: number[], bucketCount: number) {
  const safeBucketCount = Math.max(4, bucketCount)
  const safePeak = Math.max(...amplitude, 1e-6)
  const counts = Array.from({ length: safeBucketCount }, () => 0)

  amplitude.forEach((value) => {
    const ratio = Math.min(0.999999, value / safePeak)
    const bucketIndex = Math.min(safeBucketCount - 1, Math.floor(ratio * safeBucketCount))
    counts[bucketIndex] += 1
  })

  const total = Math.max(amplitude.length, 1)
  return {
    labels: counts.map((_, index) => `H${index + 1}`),
    values: counts.map((count) => roundIqMetric((count / total) * 100, 1)),
  }
}

function buildIqAutocorrelation(pairs: Array<[number, number]>, lagCount: number) {
  const safeLagCount = Math.max(8, Math.min(lagCount, Math.max(1, pairs.length - 1)))
  const values: number[] = []

  for (let lag = 0; lag <= safeLagCount; lag += 1) {
    let total = 0
    let pairsCount = 0

    for (let index = 0; index + lag < pairs.length; index += 1) {
      const [realA, imagA] = pairs[index]
      const [realB, imagB] = pairs[index + lag]
      total += realA * realB + imagA * imagB
      pairsCount += 1
    }

    values.push(pairsCount > 0 ? total / pairsCount : 0)
  }

  const normalization = Math.max(Math.abs(values[0] ?? 1), 1e-6)
  return {
    labels: values.map((_, index) => `L${index}`),
    values: values.map((value) => roundIqMetric(value / normalization, 3)),
  }
}

function buildHeatmapOption(matrix: FingerprintMatrix, compact: boolean): EChartsCoreOption {
  const extent = Math.max(Math.abs(matrix.min), Math.abs(matrix.max), 1e-6)

  return {
    animationDuration: 350,
    grid: {
      left: compact ? 2 : 10,
      right: compact ? 2 : 10,
      top: compact ? 8 : 18,
      bottom: compact ? 2 : 8,
    },
    tooltip: compact
      ? undefined
      : {
          position: 'top',
          backgroundColor: 'rgba(11, 18, 32, 0.94)',
          borderColor: '#243049',
          textStyle: {
            color: '#dce6f7',
          },
          formatter: (params: { value?: [number, number, number] }) => {
            const [x, y, value] = params.value ?? [0, 0, 0]
            return `x=${x}<br/>y=${y}<br/>value=${Number(value).toFixed(4)}`
          },
        },
    visualMap: {
      min: -extent,
      max: extent,
      orient: 'horizontal',
      left: 'center',
      top: 0,
      itemWidth: compact ? 42 : 72,
      itemHeight: 6,
      textGap: 5,
      textStyle: {
        color: '#6f88af',
        fontSize: compact ? 0 : 10,
      },
      inRange: {
        color: ['#12304a', '#1d4f73', '#d8e1ec', '#d97706', '#7c2d12'],
      },
    },
    xAxis: {
      type: 'category',
      show: false,
      data: createAxisLabels(matrix.points),
    },
    yAxis: {
      type: 'category',
      show: false,
      data: createAxisLabels(matrix.points),
    },
    series: [
      {
        type: 'heatmap',
        data: matrix.points,
        progressive: 0,
        emphasis: {
          itemStyle: {
            borderColor: '#e2e8f0',
            borderWidth: 1,
          },
        },
      },
    ],
  }
}

function createAxisLabels(points: Array<[number, number, number]>) {
  const maxIndex = points.reduce((current, [x, y]) => Math.max(current, x, y), 0)
  return Array.from({ length: maxIndex + 1 }, (_, index) => index.toString())
}

function useNowLabel() {
  const [label, setLabel] = useState(() => formatDateTime(new Date()))

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLabel(formatDateTime(new Date()))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  return label
}

function formatShortTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDateTime(date: Date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatChannelValue(channel: number) {
  return channel > 0 ? `Channel ${channel}` : '--'
}

function countDistinctSelections(leftLabel: string, rightLabel: string) {
  return new Set([leftLabel, rightLabel].filter((value) => value.trim().length > 0)).size
}

function formatIqNumber(value: number, precision = 2) {
  return Number.isFinite(value) ? value.toFixed(precision) : '--'
}

function roundIqMetric(value: number, precision: number) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function clampIqMetric(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function calculateFingerprintSimilarity(left: FingerprintMatrix[], right: FingerprintMatrix[]) {
  const pairs = Math.min(left.length, right.length)
  if (pairs === 0) {
    return 0
  }

  let similarityTotal = 0

  for (let index = 0; index < pairs; index += 1) {
    similarityTotal += calculateMatrixSimilarity(left[index], right[index])
  }

  return Math.round((similarityTotal / pairs) * 10) / 10
}

function calculateMatrixSimilarity(left: FingerprintMatrix, right: FingerprintMatrix) {
  const pointCount = Math.min(left.points.length, right.points.length)
  if (pointCount === 0) {
    return 0
  }

  const leftRange = Math.max(Math.abs(left.min), Math.abs(left.max), 1e-6)
  const rightRange = Math.max(Math.abs(right.min), Math.abs(right.max), 1e-6)
  let deltaTotal = 0

  for (let index = 0; index < pointCount; index += 1) {
    const leftValue = left.points[index]?.[2] ?? 0
    const rightValue = right.points[index]?.[2] ?? 0
    const normalizedLeft = leftValue / leftRange
    const normalizedRight = rightValue / rightRange
    deltaTotal += Math.abs(normalizedLeft - normalizedRight) / 2
  }

  const averageDelta = deltaTotal / pointCount
  const similarity = Math.max(0, Math.min(1, 1 - averageDelta))
  return similarity * 100
}

function exportComparisonSnapshot(comparison: ComparisonItem, similarity: number | null) {
  const payload = {
    exportedAt: new Date().toISOString(),
    similarity,
    comparison,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${comparison.leftLabel}-vs-${comparison.rightLabel}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default App
