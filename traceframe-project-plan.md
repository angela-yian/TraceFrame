# TraceFrame

> **Raw logs in. Incident timeline out.**
> 將多個混亂的 Log 檔案，一鍵轉成可搜尋、可縮放、可分享的互動式事故時間軸。

## 1. 專案目標

建立一個具有以下特性的開源開發者工具：

- 五秒內能理解用途
- 一條指令即可執行
- 執行結果具有明顯的視覺效果
- 適合截圖、GIF 與社群分享
- 不需要預先導入 OpenTelemetry 或修改應用程式
- 完全在本機處理，不上傳 Log
- 容易讓外部貢獻者新增 Parser

主要目標是快速推出可展示的 MVP，透過實際用途、漂亮 Demo 和社群發布提高 GitHub Star 成長機會。

---

## 2. 一句話介紹

```text
Turn raw logs into an interactive incident timeline.
```

中文版本：

```text
把多份原始 Log 轉成可互動的事故時間軸。
```

README 首屏副標：

```text
No instrumentation. No upload. No account.
```

---

## 3. 核心使用方式

```bash
npx traceframe api.log worker.log database.log
```

執行後自動啟動本機 Web UI：

```text
12:01:03.120  Web       POST /login
12:01:03.148  API       Query user
12:01:03.782  Database  Connection timeout
12:01:03.784  API       Retry 1/3
12:01:06.102  API       Request failed
12:01:06.108  Web       HTTP 500
```

時間軸顯示：

```text
Web       ●──────────────────────────────────────● 500
           request

API         ●──────────────● retry ─────────────●
             query                              failed

Database       ●──────── timeout
```

---

## 4. 解決的問題

除錯事故時，工程師通常需要同時查看多個來源的 Log：

- Web frontend
- Backend API
- Worker
- Database
- Docker container
- Kubernetes Pod
- CI pipeline
- Embedded device serial output

這些 Log 的格式、時間精度和來源名稱不同，工程師必須人工切換檔案、搜尋 request ID，並在腦中還原事件順序。

TraceFrame 將這些現有 Log 合併、排序和關聯，不要求使用者事先埋設 Trace，也不試圖取代完整的 Observability 平台。

---

## 5. 為什麼較適合快速取得 Star

### 5.1 五秒看懂

使用者只要看到以下流程即可理解價值：

```text
Raw logs → TraceFrame → Interactive timeline
```

### 5.2 結果適合展示

互動式時間軸比純文字 CLI 結果更容易製作：

- README GIF
- 社群貼文影片
- Before / After 圖片
- Hacker News Demo
- Reddit 展示

### 5.3 使用族群廣

可涵蓋：

- Web developers
- Backend developers
- DevOps / SRE
- Kubernetes users
- CI maintainers
- Firmware engineers
- Embedded developers

### 5.4 容易吸引外部貢獻

每一種 Log 格式都能成為獨立 Parser，外部貢獻者可新增自己熟悉的格式，而不需要理解整個專案。

---

## 6. MVP 功能範圍

第一版只完成最能展示核心價值的功能。

### 6.1 輸入

- 單一 Log 檔案
- 多個 Log 檔案
- 資料夾
- stdin
- Drag and drop 至本機 Web UI

範例：

```bash
npx traceframe app.log
npx traceframe logs/*.log
cat app.log | npx traceframe -
```

### 6.2 時間辨識

至少支援：

- ISO 8601
- RFC 3339
- syslog timestamp
- Unix timestamp
- Unix timestamp in milliseconds
- Android logcat timestamp
- JSON 欄位中的 timestamp
- 沒有日期、只有開機後相對時間的 Embedded Log

### 6.3 Lane 分組

依以下資訊建立時間軸 Lane：

- 檔名
- service
- container
- process
- thread
- logger
- user-defined field

### 6.4 事件關聯

自動辨識常見關聯欄位：

- request ID
- trace ID
- span ID
- job ID
- transaction ID
- session ID
- thread ID
- correlation ID

### 6.5 顯示

- 縮放與拖曳時間軸
- 依 Level 篩選
- 依來源篩選
- 全文搜尋
- 關聯 ID 高亮
- Stack trace 收合
- 點擊事件查看完整內容
- 顯示事件間隔
- 顯示原始 Log 行號與來源檔案

### 6.6 輸出

- 單一 HTML 檔案
- JSON
- SVG
- PNG

第一版至少必須完成：

```text
Interactive local Web UI + standalone HTML export
```

---

## 7. 第一版支援格式

優先順序如下：

1. Plain timestamped logs
2. JSON Lines / JSONL
3. syslog
4. Docker logs
5. Kubernetes logs
6. Android logcat
7. Custom regular expression

後續再增加：

- Nginx
- Apache
- Spring Boot
- PostgreSQL
- GitHub Actions
- GitLab CI
- systemd journal
- Zephyr
- FreeRTOS
- UART serial logs

---

## 8. 刻意不做的功能

第一版不要加入：

- AI 事故摘要
- 雲端帳號
- SaaS 儲存
- Telemetry 上傳
- 即時 Log Server
- OpenTelemetry Collector
- Kubernetes Cluster 直接連線
- 完整 APM
- 告警系統
- 團隊權限管理
- 大型資料庫索引

核心定位必須維持：

> 已經有 Log，不需要預先埋 Trace，也能快速看出事件順序。

---

## 9. 核心差異化

TraceFrame 不是另一套完整的 Log 平台。

| 類型 | 主要用途 | TraceFrame 的差異 |
|---|---|---|
| Log viewer | 搜尋或閱讀 Log | TraceFrame 強調跨來源事件順序 |
| Observability platform | 長期收集、儲存與告警 | TraceFrame 不需要部署基礎設施 |
| Distributed tracing | 依賴預先埋設 Trace | TraceFrame 可處理既有普通 Log |
| Kubernetes log tool | 即時查看 Pod Log | TraceFrame 可混合任何 Log 來源 |
| Profiler | 分析程式執行 | TraceFrame 分析事故事件與關聯 |

---

## 10. 建議技術架構

### 10.1 技術選擇

```text
Language: TypeScript
Runtime: Node.js
CLI: Commander.js or Clipanion
Frontend: React + Vite
Timeline: Canvas or SVG-based custom renderer
Testing: Vitest + Playwright
Package manager: pnpm
Build: tsup
Release: Changesets + GitHub Actions
Distribution: npm / npx
```

MVP 優先選擇 npm，是因為使用者可以直接執行：

```bash
npx traceframe
```

不需要額外安裝。

### 10.2 Monorepo 結構

```text
traceframe/
├── apps/
│   ├── cli/
│   └── web/
├── packages/
│   ├── core/
│   ├── parser-sdk/
│   ├── timeline-ui/
│   ├── exporters/
│   └── parsers/
│       ├── plain/
│       ├── jsonl/
│       ├── syslog/
│       ├── docker/
│       ├── kubernetes/
│       └── logcat/
├── examples/
│   ├── kubernetes-crashloop/
│   ├── api-database-timeout/
│   ├── github-actions-failure/
│   └── embedded-watchdog-reset/
├── docs/
├── tests/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 11. 資料處理流程

```text
Input files
    ↓
Format detection
    ↓
Parser selection
    ↓
Timestamp normalization
    ↓
Field extraction
    ↓
Correlation detection
    ↓
Event sorting
    ↓
Lane grouping
    ↓
Interactive timeline
    ↓
HTML / JSON / SVG / PNG export
```

### 11.1 正規化事件格式

```ts
export interface TraceEvent {
    id: string;
    timestamp: number;
    timestampRaw: string;
    source: string;
    lane: string;
    level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    message: string;
    fields: Record<string, unknown>;
    correlationIds: string[];
    filePath?: string;
    lineNumber?: number;
    raw: string;
}
```

### 11.2 Parser 介面

```ts
export interface LogParser {
    id: string;
    name: string;

    detect(input: ParserSample): number;
    parse(context: ParserContext): AsyncIterable<TraceEvent>;
}
```

`detect()` 回傳 0 到 1 的信心分數，讓 TraceFrame 自動選擇最適合的 Parser。

---

## 12. CLI 規格

### 12.1 開啟 UI

```bash
traceframe api.log worker.log
```

### 12.2 指定 Parser

```bash
traceframe app.log --parser jsonl
```

### 12.3 指定 Lane 欄位

```bash
traceframe logs/*.jsonl --lane service
```

### 12.4 匯出單一 HTML

```bash
traceframe logs/*.log --export incident.html
```

### 12.5 自訂 Regex

```bash
traceframe device.log \
  --timestamp-regex '^(?<time>\\d{2}:\\d{2}:\\d{2}\\.\\d{3})' \
  --lane-regex '\\[(?<lane>[^\\]]+)\\]'
```

### 12.6 不自動開啟瀏覽器

```bash
traceframe app.log --no-open
```

### 12.7 顯示解析統計

```bash
traceframe app.log --stats
```

輸出範例：

```text
Files:             3
Lines:             42,190
Parsed events:     41,882
Unparsed lines:       308
Detected parsers:  JSONL, syslog
Time range:        18m 42s
Correlation IDs:   196
```

---

## 13. UI 要求

### 13.1 首頁

- 顯示已載入檔案
- 顯示 Parser 偵測結果
- 顯示事件總數與時間範圍
- 可重新選擇 Parser

### 13.2 Timeline

每個 Lane 代表一個來源：

```text
Web
API
Worker
Database
```

事件顯示內容：

- 時間點
- Level
- 簡短訊息
- 關聯 ID
- 持續時間或相鄰間隔

### 13.3 Details panel

點擊事件後顯示：

- 完整原始內容
- 解析後欄位
- 來源檔案
- 行號
- 關聯事件
- 前後事件

### 13.4 Filter bar

- Search
- Level
- Lane
- Time range
- Correlation ID
- Parser

---

## 14. 隱私與安全原則

TraceFrame 的主要信任承諾：

```text
Local only. No upload. No telemetry.
```

必要要求：

- 預設不傳送任何 Log
- 預設不啟用 Analytics
- 本機 Server 僅綁定 `127.0.0.1`
- 匯出的 HTML 不依賴外部 CDN
- README 明確說明資料流
- 不自動讀取未指定的目錄
- 對超大型檔案設置合理限制
- 防止惡意 Log 內容造成 HTML injection
- 對 Regex parser 設定 timeout 或安全限制

---

## 15. Demo 範例

發布前至少準備四個高品質範例。

### 15.1 Kubernetes CrashLoopBackOff

```text
kubelet → container start → application crash → restart backoff
```

### 15.2 API 與資料庫 Timeout

```text
Web request → API query → DB timeout → retry → HTTP 500
```

### 15.3 GitHub Actions Build Failure

```text
checkout → cache restore → dependency install → compile → test failure
```

### 15.4 Embedded Watchdog Reset

```text
00:00:00.102 BOOT  MCU initialized
00:00:00.118 IRQ   UART interrupt enabled
00:00:00.451 DMA   transfer started
00:00:00.782 WDT   timeout warning
00:00:01.003 RESET watchdog reset
```

Embedded Demo 是重要差異化，能讓 TraceFrame 不只是一個 Web 開發工具。

---

## 16. 開發里程碑

### Milestone 0：可展示原型

- [x] 建立 pnpm monorepo
- [x] 完成 CLI 檔案輸入
- [x] 完成 Plain Log Parser
- [x] 完成 JSONL Parser
- [x] 完成事件正規化
- [x] 完成基本 Timeline UI
- [x] 可依 Lane 顯示事件
- [x] 可點擊查看完整 Log
- [x] 建立第一個 Demo GIF

### Milestone 1：可公開發布的 MVP

- [x] 自動辨識 Parser
- [x] 支援多檔案合併
- [x] 支援搜尋與 Level 篩選
- [x] 支援 correlation ID
- [x] 支援 syslog
- [x] 支援 Docker / Kubernetes Log
- [x] 匯出 standalone HTML
- [ ] Windows、macOS、Linux 測試
- [ ] npm 發布
- [ ] 完成英文 README

### Milestone 2：增加傳播能力

- [ ] SVG / PNG 匯出
- [ ] Android logcat Parser
- [ ] Custom Regex Parser
- [ ] Parser SDK 文件
- [ ] Contributor guide
- [ ] Good First Issue
- [ ] 四個公開 Demo
- [ ] 專案官網

---

## 17. README 首屏草稿

```markdown
# TraceFrame

Turn raw logs into an interactive incident timeline.

No instrumentation. No upload. No account.

![TraceFrame demo](./docs/demo.gif)

## Try it

```bash
npx traceframe api.log worker.log database.log
```

TraceFrame detects timestamps, groups log sources into lanes, connects
related events, and opens a searchable local timeline.

- Multiple log files
- Automatic format detection
- Request and trace ID correlation
- Search and filters
- Standalone HTML export
- Local-only processing
```

---

## 18. GitHub Repository 設定

### Repository description

```text
Turn raw logs into an interactive incident timeline. No instrumentation, upload, or account required.
```

### Topics

```text
logs
log-viewer
incident-response
debugging
devtools
observability
timeline
kubernetes
docker
firmware
```

### 建議檔案

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/parser-request.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`

建議使用 MIT License 或 Apache-2.0。

---

## 19. 快速取得 Star 的發布策略

### 19.1 發布前條件

不要在只有空 README 或半成品時宣傳。首次公開時必須已經具備：

- 可直接執行的 `npx` 指令
- 8 至 15 秒 Demo GIF
- 至少三種 Log Parser
- 一個真實事故範例
- Standalone HTML 匯出
- 清楚的隱私說明
- Windows、macOS、Linux CI

### 19.2 首波發布管道

- Hacker News：Show HN
- Reddit：相關 programming、devops、self-hosted、kubernetes 社群
- Dev.to
- Hashnode
- X / LinkedIn
- GitHub Discussions
- Awesome lists

### 19.3 發布貼文重點

不要只說「我做了一個 Log Viewer」。應展示具體轉換：

```text
I had three logs and no distributed tracing.
TraceFrame reconstructed the incident timeline locally.
```

貼文必須包含：

- 一張 GIF
- 一行安裝指令
- 隱私承諾
- 真實使用案例
- GitHub Repository

### 19.4 持續成長機制

- 每週新增一個 Parser
- 每個 Parser 發一篇短展示
- 建立 `good first issue`
- 邀請其他專案提供匿名範例 Log
- 接受外部 Parser PR
- 定期發布 Before / After Demo
- 在 README 顯示採用專案

---

## 20. 成功指標

第一階段可設定以下目標，但不是保證：

```text
First 7 days:
- 100 Stars
- 10 Issues
- 3 external contributors
- 1,000 npm downloads

First 30 days:
- 300–500 Stars
- 5 external parsers
- 5 real-world examples
- 5,000 npm downloads
```

比 Star 更重要的申請佐證包括：

- 真實 npm downloads
- 外部 Contributor
- 外部專案採用
- 有效 Issue 與 PR
- 持續 Release
- 實際使用案例

---

## 21. 主要風險

### 21.1 Log 格式太多

解法：第一版只做少數常見格式，並提供 Parser SDK。

### 21.2 時區與時間精度不一致

解法：允許使用者手動設定 timezone、offset 與 time unit。

### 21.3 大型 Log 效能

解法：使用 streaming parser、Web Worker、虛擬化清單與分段載入。

### 21.4 看起來像一般 Log Viewer

解法：所有文案和 Demo 都強調「跨來源事故時間軸」，而不是一般搜尋介面。

### 21.5 UI 不夠漂亮，無法傳播

解法：先完成視覺原型與 README GIF，再擴充 Parser 數量。

---

## 22. Codex 實作順序

建議依以下順序交給 Codex：

1. 建立 Monorepo 與工程設定
2. 定義 `TraceEvent` 與 Parser SDK
3. 實作 Plain Log Parser
4. 實作 JSONL Parser
5. 實作檔案串流與事件排序
6. 實作 CLI
7. 實作基本 Timeline UI
8. 串接 CLI 與本機 Web Server
9. 完成搜尋與篩選
10. 完成 standalone HTML export
11. 新增測試與範例資料
12. 建立 GitHub Actions 與 npm Release

每一步都應要求：

- 執行測試
- 不破壞既有功能
- 更新 README
- 提交小型、可審查的變更
- 不提前加入 MVP 以外的功能

---

## 23. 最終定位

```text
TraceFrame is a local-first tool that turns existing logs from multiple
sources into a searchable incident timeline—without instrumentation,
cloud upload, or an account.
```

最重要的產品原則：

> 先讓使用者在十秒內看到一張有價值、值得分享的時間軸，再考慮其他進階功能。
