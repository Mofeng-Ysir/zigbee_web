import { useEffect, useRef } from 'react'
import { HeatmapChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { init, use as registerCharts, type EChartsCoreOption, type EChartsType } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

registerCharts([
  LineChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export function EChartView({ option }: { option: EChartsCoreOption }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const mountedRef = useRef(false)
  const optionRef = useRef(option)
  const optionFrameRef = useRef<number | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  optionRef.current = option

  const ensureChart = () => {
    const host = hostRef.current
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
    if (!mountedRef.current) {
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
    if (!mountedRef.current) {
      return
    }
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null
      const host = hostRef.current
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

  useEffect(() => {
    mountedRef.current = true
    const host = hostRef.current
    if (!host) {
      return () => {
        mountedRef.current = false
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleResize()
    })

    resizeObserver.observe(host)
    window.addEventListener('resize', scheduleResize)
    scheduleOptionUpdate()

    return () => {
      mountedRef.current = false
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleResize)
      if (optionFrameRef.current !== null) {
        window.cancelAnimationFrame(optionFrameRef.current)
        optionFrameRef.current = null
      }
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      const chart = chartRef.current
      chartRef.current = null
      if (chart) {
        try {
          chart.dispose()
        } catch {
          // Ignore transient dispose races from the renderer.
        }
      }
    }
  }, [])

  useEffect(() => {
    scheduleOptionUpdate()
  }, [option])

  return <div ref={hostRef} className="echart-host" />
}
