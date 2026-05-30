declare module 'colormap' {
  export interface ColormapStop {
    index: number
    rgb: [number, number, number] | [number, number, number, number]
  }

  export interface ColormapOptions {
    alpha?: number | number[]
    colormap?: string | ColormapStop[]
    format?: 'hex' | 'rgbaString' | 'rba' | 'float'
    nshades?: number
  }

  export default function colormap(options?: ColormapOptions): string[] | number[][]
}
