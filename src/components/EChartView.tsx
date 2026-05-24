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

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const chart = init(hostRef.current, undefined, {
      renderer: 'canvas',
    })
    chartRef.current = chart

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })

    resizeObserver.observe(hostRef.current)

    return () => {
      resizeObserver.disconnect()
      chartRef.current = null
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) {
      return
    }

    chartRef.current.setOption(option, true)
    chartRef.current.resize()
  }, [option])

  return <div ref={hostRef} className="echart-host" />
}
