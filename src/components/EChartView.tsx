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
  const frameRef = useRef<number | null>(null)
  const mountedRef = useRef(false)
  const optionRef = useRef(option)
  optionRef.current = option

  const scheduleRender = () => {
    if (!mountedRef.current) {
      return
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const host = hostRef.current
      if (!host || host.clientWidth === 0 || host.clientHeight === 0) {
        return
      }

      let chart = chartRef.current
      if (!chart) {
        chart = init(host, undefined, {
          renderer: 'canvas',
        })
        chartRef.current = chart
      }

      try {
        chart.setOption(optionRef.current, true)
        chart.resize()
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
      scheduleRender()
    })

    resizeObserver.observe(host)
    window.addEventListener('resize', scheduleRender)
    scheduleRender()

    return () => {
      mountedRef.current = false
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleRender)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
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
    scheduleRender()
  }, [option])

  return <div ref={hostRef} className="echart-host" />
}
