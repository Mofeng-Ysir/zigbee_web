# 当前前端未对接/部分对接的接口

本文档记录 `zigbee_web-main` 在本次改造后，仍未使用或仅部分使用的后端能力，便于后续补齐。

## 已接入接口

- `GET /api/v2/status`
- `GET /api/v2/devices`
- `GET /api/v2/admissions?limit=10`
- `GET /api/v2/admissions/{admission_id}`
  - 当前只会请求最新一条准入记录的详情，用于“正在入网设备”卡片和最新指纹图预览。

## 暂未接入的现有接口

- `GET /healthz`
  - 后端健康检查接口，前端当前未显示服务存活状态。

- `GET /api/v2/events?limit=100`
  - 事件时间线接口当前未使用。
  - 现在实时页的“历史入网设备”直接基于 `/api/v2/admissions` 渲染，不展示更细粒度的事件流。

- `GET /api/v2/stream`
  - 按要求明确不使用 SSE。

- `GET /api/v2/ws`
  - 当前实现改为纯 HTTP 轮询，没有接 WebSocket 推送。

## 部分对接的接口能力

- `GET /api/v2/admissions/{admission_id}`
  - 目前只读取最新 admission 的 IQ/GAF 详情。
  - 如果后续需要让“历史入网设备”列表中的每一条都能点开看到完整指纹图，建议改成“点击行时按需加载详情并做本地缓存”。

## 前端已有入口但后端暂缺控制接口

- “重连设备”按钮
  - 当前后端没有对应的控制类 HTTP API，前端按钮仍是展示态。

- “开关入网”按钮
  - 当前后端没有提供 permit-join 开/关的 HTTP API，前端按钮仍是展示态。

## 本次按要求未处理的部分

- 离线设备库页面
  - 继续使用本地 mock 数据。
  - 如果后续需要接真实后端，至少还需要“离线指纹库列表 / 设备详情 / 对比任务”相关接口定义。
