import { useEffect, useRef } from 'react'
import colormap from 'colormap'
import { BarChart, LineChart, RadarChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, RadarComponent, TooltipComponent } from 'echarts/components'
import { init, use as registerCharts, type EChartsCoreOption, type EChartsType } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

registerCharts([
  LineChart,
  ScatterChart,
  BarChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  CanvasRenderer,
])

type HeatmapPoint = [number, number, number]

interface HeatmapSeriesLike {
  type?: string
  data?: HeatmapPoint[]
}

interface VisualMapLike {
  min?: number
  max?: number
  inRange?: {
    color?: string[]
  }
  textStyle?: {
    fontSize?: number
  }
}

interface HeatmapRenderModel {
  compact: boolean
  colors: string[]
  max: number
  min: number
  points: HeatmapPoint[]
  xCount: number
  yCount: number
}

const DEFAULT_HEATMAP_COLORS = ['#12304a', '#1d4f73', '#d8e1ec', '#d97706', '#7c2d12']

export function EChartView({ option }: { option: EChartsCoreOption }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartHostRef = useRef<HTMLDivElement | null>(null)
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const mountedRef = useRef(false)
  const optionRef = useRef(option)
  const optionFrameRef = useRef<number | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const heatmapFrameRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const heatmapModel = getHeatmapModel(option)
  const heatmapModelRef = useRef(heatmapModel)
  const heatmapModeRef = useRef(Boolean(heatmapModel))

  optionRef.current = option
  heatmapModelRef.current = heatmapModel
  heatmapModeRef.current = Boolean(heatmapModel)

  const disposeChart = () => {
    const chart = chartRef.current
    chartRef.current = null
    sizeRef.current = { width: 0, height: 0 }
    if (!chart) {
      return
    }

    try {
      chart.dispose()
    } catch {
      // Ignore transient dispose races from the renderer.
    }
  }

  const ensureChart = () => {
    const host = chartHostRef.current
    if (!host || host.clientWidth === 0 || host.clientHeight === 0) {
      return null
    }

    let chart = chartRef.current
    if (!chart) {
      chart = init(host, undefined, {
        renderer: 'canvas',
      })
      chartRef.current = chart
      sizeRef.current = {
        width: host.clientWidth,
        height: host.clientHeight,
      }
    }

    return chart
  }

  const scheduleOptionUpdate = () => {
    if (!mountedRef.current || heatmapModeRef.current) {
      return
    }
    if (optionFrameRef.current !== null) {
      window.cancelAnimationFrame(optionFrameRef.current)
    }

    optionFrameRef.current = window.requestAnimationFrame(() => {
      optionFrameRef.current = null
      const chart = ensureChart()
      if (!chart) {
        return
      }

      try {
        chart.setOption(optionRef.current, true)
      } catch {
        // Ignore transient resize/dispose races during mount-unmount transitions.
      }
    })
  }

  const scheduleResize = () => {
    if (!mountedRef.current || heatmapModeRef.current) {
      return
    }
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null
      const host = chartHostRef.current
      if (!host || host.clientWidth === 0 || host.clientHeight === 0) {
        return
      }

      const width = host.clientWidth
      const height = host.clientHeight
      const previous = sizeRef.current
      if (previous.width === width && previous.height === height && chartRef.current) {
        return
      }
      sizeRef.current = { width, height }

      const chart = ensureChart()
      if (!chart) {
        return
      }

      try {
        chart.resize({ width, height })
      } catch {
        // Ignore transient resize/dispose races during mount-unmount transitions.
      }
    })
  }

  const scheduleHeatmapRender = () => {
    if (!mountedRef.current || !heatmapModeRef.current) {
      return
    }
    if (heatmapFrameRef.current !== null) {
      window.cancelAnimationFrame(heatmapFrameRef.current)
    }

    heatmapFrameRef.current = window.requestAnimationFrame(() => {
      heatmapFrameRef.current = null
      renderHeatmap(heatmapCanvasRef.current, heatmapModelRef.current)
    })
  }

  useEffect(() => {
    mountedRef.current = true
    const host = containerRef.current
    if (!host) {
      return () => {
        mountedRef.current = false
      }
    }

    const handleResize = () => {
      if (heatmapModeRef.current) {
        scheduleHeatmapRender()
        return
      }
      scheduleResize()
    }

    const resizeObserver = new ResizeObserver(handleResize)

    resizeObserver.observe(host)
    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      mountedRef.current = false
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      if (optionFrameRef.current !== null) {
        window.cancelAnimationFrame(optionFrameRef.current)
        optionFrameRef.current = null
      }
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      if (heatmapFrameRef.current !== null) {
        window.cancelAnimationFrame(heatmapFrameRef.current)
        heatmapFrameRef.current = null
      }
      disposeChart()
    }
  }, [])

  useEffect(() => {
    if (heatmapModel) {
      disposeChart()
      scheduleHeatmapRender()
      return
    }

    scheduleResize()
    scheduleOptionUpdate()
  }, [heatmapModel, option])

  const legendStyle = heatmapModel
    ? {
        backgroundImage: `linear-gradient(90deg, ${heatmapModel.colors.join(', ')})`,
      }
    : undefined

  if (heatmapModel) {
    return (
      <div ref={containerRef} className="echart-host">
        <div className={heatmapModel.compact ? 'heatmap-canvas-shell compact' : 'heatmap-canvas-shell'}>
          <div className={heatmapModel.compact ? 'heatmap-legend compact' : 'heatmap-legend'}>
            <div className="heatmap-legend-bar" style={legendStyle} />
            {!heatmapModel.compact ? (
              <div className="heatmap-legend-labels">
                <span>{formatLegendValue(heatmapModel.min)}</span>
                <span>{formatLegendValue(heatmapModel.max)}</span>
              </div>
            ) : null}
          </div>
          <canvas ref={heatmapCanvasRef} className="heatmap-canvas" />
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="echart-host">
      <div ref={chartHostRef} className="echart-host__chart" />
    </div>
  )
}

function getHeatmapModel(option: EChartsCoreOption): HeatmapRenderModel | null {
  const seriesEntries = normalizeArray((option as { series?: HeatmapSeriesLike | HeatmapSeriesLike[] }).series)
  const heatmapSeries = seriesEntries.find((entry) => entry?.type === 'heatmap')
  if (!heatmapSeries || !Array.isArray(heatmapSeries.data) || heatmapSeries.data.length === 0) {
    return null
  }

  const visualMap = normalizeArray((option as { visualMap?: VisualMapLike | VisualMapLike[] }).visualMap)[0]
  const colors = visualMap?.inRange?.color?.length ? visualMap.inRange.color : DEFAULT_HEATMAP_COLORS

  let xCount = 0
  let yCount = 0

  for (const [x, y] of heatmapSeries.data) {
    xCount = Math.max(xCount, x + 1)
    yCount = Math.max(yCount, y + 1)
  }

  if (xCount === 0 || yCount === 0) {
    return null
  }

  const valueExtent = getValueExtent(heatmapSeries.data)

  return {
    compact: (visualMap?.textStyle?.fontSize ?? 10) === 0,
    colors,
    max: Number.isFinite(visualMap?.max) ? Number(visualMap?.max) : valueExtent.max,
    min: Number.isFinite(visualMap?.min) ? Number(visualMap?.min) : valueExtent.min,
    points: heatmapSeries.data,
    xCount,
    yCount,
  }
}

function renderHeatmap(canvas: HTMLCanvasElement | null, model: HeatmapRenderModel | null) {
  if (!canvas || !model) {
    return
  }

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width === 0 || height === 0) {
    return
  }

  const dpr = window.devicePixelRatio || 1
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(height * dpr))

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  const raster = createHeatmapRaster(model)
  const rasterCanvas = document.createElement('canvas')
  rasterCanvas.width = raster.width
  rasterCanvas.height = raster.height

  const rasterContext = rasterCanvas.getContext('2d')
  if (!rasterContext) {
    return
  }
  rasterContext.putImageData(raster.imageData, 0, 0)

  const scale = Math.min(width / model.xCount, height / model.yCount)
  const drawWidth = Math.max(1, model.xCount * scale)
  const drawHeight = Math.max(1, model.yCount * scale)
  const offsetX = (width - drawWidth) / 2
  const offsetY = (height - drawHeight) / 2

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.scale(dpr, dpr)
  context.imageSmoothingEnabled = false
  context.drawImage(rasterCanvas, offsetX, offsetY, drawWidth, drawHeight)
}

function createHeatmapRaster(model: HeatmapRenderModel) {
  const palette = createPalette(model.colors)
  const imageData = new ImageData(model.xCount, model.yCount)
  const range = model.max - model.min || 1

  for (const [x, y, value] of model.points) {
    if (x < 0 || y < 0 || x >= model.xCount || y >= model.yCount) {
      continue
    }

    const paletteIndex = clamp(Math.round(((value - model.min) / range) * (palette.length - 1)), 0, palette.length - 1)
    const offset = (y * model.xCount + x) * 4
    const [red, green, blue] = palette[paletteIndex]
    imageData.data[offset] = red
    imageData.data[offset + 1] = green
    imageData.data[offset + 2] = blue
    imageData.data[offset + 3] = 255
  }

  return {
    imageData,
    height: model.yCount,
    width: model.xCount,
  }
}

function createPalette(colors: string[]) {
  const stops = colors.map((color, index) => ({
    index: colors.length === 1 ? 0 : index / (colors.length - 1),
    rgb: parseColor(color),
  }))

  return (colormap({
    alpha: 1,
    colormap: stops,
    format: 'rba',
    nshades: 256,
  }) as number[][]).map((entry) => [entry[0] ?? 0, entry[1] ?? 0, entry[2] ?? 0] as const)
}

function parseColor(color: string): [number, number, number] {
  const normalized = color.trim()

  if (normalized.startsWith('#')) {
    const value = normalized.slice(1)
    if (value.length === 3) {
      return [
        Number.parseInt(value[0] + value[0], 16),
        Number.parseInt(value[1] + value[1], 16),
        Number.parseInt(value[2] + value[2], 16),
      ]
    }
    if (value.length === 6) {
      return [
        Number.parseInt(value.slice(0, 2), 16),
        Number.parseInt(value.slice(2, 4), 16),
        Number.parseInt(value.slice(4, 6), 16),
      ]
    }
  }

  const rgbMatch = normalized.match(/rgba?\(([^)]+)\)/i)
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(',')
      .slice(0, 3)
      .map((segment) => Number.parseFloat(segment.trim()))
    if (channels.every((channel) => Number.isFinite(channel))) {
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0]
    }
  }

  return [0, 0, 0]
}

function getValueExtent(points: HeatmapPoint[]) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const [, , value] of points) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 }
  }

  if (min === max) {
    const padding = Math.abs(min) < 1e-6 ? 1 : Math.abs(min) * 0.1
    return { min: min - padding, max: max + padding }
  }

  return { min, max }
}

function formatLegendValue(value: number) {
  return value.toFixed(Math.abs(value) >= 10 ? 0 : 2).replace(/\.?0+$/, '')
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }
  return value ? [value] : []
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
