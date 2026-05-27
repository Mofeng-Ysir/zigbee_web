import {
  useDeferredValue,
  useEffect,
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
  Cpu,
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

function App() {
  const [view, setView] = useState<NavigationView>('realtime')
  const [query, setQuery] = useState('')
  const { data, connection, liveEnabled } = useDashboardData()
  const [selectedOfflineLabel, setSelectedOfflineLabel] = useState(
    data.offlineDevices[0]?.label ?? '',
  )
  const [modalTarget, setModalTarget] = useState<DeviceEntry | JoiningDevice | HistoryRecord | null>(
    null,
  )
  const nowLabel = useNowLabel()
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

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
  const sidebarStatusTone = connection.coordinatorConnected && connection.inferConnected
    ? 'connected'
    : connection.coordinatorConnected || connection.inferConnected
      ? 'partial'
      : 'disconnected'

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
            onOpenDevice={setModalTarget}
          />
        ) : (
          <OfflineView
            items={filteredOfflineDevices}
            selected={selectedOffline}
            comparison={data.comparison}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedOfflineLabel}
          />
        )}
      </main>

      {modalTarget ? (
        <FingerprintDialog
          target={modalTarget}
          onClose={() => setModalTarget(null)}
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
  const hasPrediction = hasJoiningPrediction(data.joiningDevice)
  const latestJoinTime = history[0]?.timestamp

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

      <section className="stat-row">
        <StatCard
          label="协调器 MAC"
          value={data.coordinator.ieeeAddr}
          detail="Coordinator IEEE"
          tone="cyan"
          icon={<Cpu size={14} strokeWidth={1.8} />}
          compact
        />
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

      <section className="row row-mid">
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

        <CardPanel
          className="iq-panel reverse-radius"
          title={<PanelTitle icon={<Activity size={16} strokeWidth={1.8} />} title="网络 IQ 数据" />}
        >
          <div className="iq-tabs">
            <button type="button" className="iq-tab active">
              实时特征
            </button>
            <button type="button" className="iq-tab">
              参考波形
            </button>
            <button type="button" className="iq-tab">
              频谱图
            </button>
          </div>
          <div className="chart-slot">
            {hasIqData ? (
              <EChartView option={buildIqChartOption(data.joiningDevice)} />
            ) : (
              <EmptyState message="暂无 IQ 数据" />
            )}
          </div>
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
  comparison,
  query,
  onQueryChange,
  onSelect,
}: {
  items: OfflineDevice[]
  selected?: OfflineDevice
  comparison: ComparisonItem[]
  query: string
  onQueryChange: (value: string) => void
  onSelect: (label: string) => void
}) {
  return (
    <>
      <header className="header-shell">
        <div className="header-title">
          <h1>离线设备</h1>
          <p>已知设备指纹库 · 多设备指纹比对</p>
        </div>

        <div className="header-actions">
          <GradientButton icon={<Plus size={14} strokeWidth={1.8} />} label="新建比对" />
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
              <div className="fingerprint-grid">
                {selected.fingerprint.map((matrix) => (
                  <HeatmapCard key={matrix.title} matrix={matrix} compact={false} />
                ))}
              </div>
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
              <span className="compare-badge">已选择 2 台设备</span>
            </div>
            <div className="compare-actions">
              <MutedButton icon={<RefreshCw size={14} strokeWidth={1.8} />} label="开始比对" disabled />
              <MutedButton icon={<Archive size={14} strokeWidth={1.8} />} label="导出结果" disabled />
            </div>
          </div>
        }
      >
        {comparison[0] ? (
          <div className="comparison-grid">
            <article className="comparison-card">
              <div className="comparison-card-head">
                <div>
                  <strong>{comparison[0].leftLabel}</strong>
                  <span>{comparison[0].leftIeeeAddr}</span>
                </div>
              </div>
              <div className="comparison-heatmaps">
                {comparison[0].leftFingerprint.map((matrix) => (
                  <HeatmapCard key={`${comparison[0].leftLabel}-${matrix.title}`} matrix={matrix} compact={false} />
                ))}
              </div>
            </article>

            <article className="comparison-card reverse-radius">
              <div className="comparison-card-head">
                <div>
                  <strong>{comparison[0].rightLabel}</strong>
                  <span>{comparison[0].rightIeeeAddr}</span>
                </div>
              </div>
              <div className="comparison-heatmaps">
                {comparison[0].rightFingerprint.map((matrix) => (
                  <HeatmapCard key={`${comparison[0].rightLabel}-${matrix.title}`} matrix={matrix} compact={false} />
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className="empty-shell">暂无可比对设备</div>
        )}
      </CardPanel>
    </>
  )
}

function FingerprintDialog({
  target,
  onClose,
  onExport,
}: {
  target: DeviceEntry | JoiningDevice | HistoryRecord
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
            <ModalColumn title="待入网设备指纹 · 实时样本" items={target.fingerprint.primary} />
            <ModalColumn title="指纹库设备对照 · 参考样本" items={target.fingerprint.reference} />
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
}: {
  title: string
  items: FingerprintMatrix[]
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
          <EmptyState message="暂无指纹数据" />
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

function GradientButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button type="button" className="gradient-button">
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

function HeatmapCard({ matrix, compact }: { matrix: FingerprintMatrix; compact: boolean }) {
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
}

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

function buildIqChartOption(device: JoiningDevice): EChartsCoreOption {
  return {
    animationDuration: 500,
    animationEasing: 'cubicOut',
    grid: {
      left: 14,
      right: 14,
      top: 28,
      bottom: 20,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(11, 18, 32, 0.94)',
      borderColor: '#243049',
      textStyle: {
        color: '#dce6f7',
      },
    },
    legend: {
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
        name: '实部',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#2dd4bf',
        },
        areaStyle: {
          color: 'rgba(45, 212, 191, 0.12)',
        },
        data: device.iqSamples.real,
      },
      {
        type: 'line',
        name: '虚部',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#38bdf8',
        },
        areaStyle: {
          color: 'rgba(56, 189, 248, 0.1)',
        },
        data: device.iqSamples.imag,
      },
    ],
  }
}

function buildHeatmapOption(matrix: FingerprintMatrix, compact: boolean): EChartsCoreOption {
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
        },
    visualMap: {
      min: 0,
      max: matrix.max,
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
        color: ['#09101c', '#0f2c4b', '#155e75', '#22d3ee', '#f59e0b'],
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

export default App
