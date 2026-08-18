import { useEffect, useMemo, useState } from "react";
import type { LogLevel, TimelineData, TraceEvent } from "@traceframe/parser-sdk";
import { demoData } from "./demo.js";

const LEVELS: Array<LogLevel | "all"> = ["all", "trace", "debug", "info", "warn", "error", "fatal"];
const TICK_COUNT = 6;

declare global {
  interface Window {
    __TRACEFRAME_DATA__?: TimelineData;
  }
}

function formatClock(timestamp: number): string {
  if (timestamp < Date.UTC(2000, 0, 1)) {
    const hours = Math.floor(timestamp / 3_600_000).toString().padStart(2, "0");
    const minutes = Math.floor(timestamp % 3_600_000 / 60_000).toString().padStart(2, "0");
    const seconds = (timestamp % 60_000 / 1_000).toFixed(3).padStart(6, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
    timeZone: "UTC"
  }).format(timestamp) + "Z";
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(2)}s`;
  return `${Math.floor(milliseconds / 60_000)}m ${Math.round(milliseconds % 60_000 / 1_000)}s`;
}

async function loadData(): Promise<TimelineData> {
  if (window.__TRACEFRAME_DATA__) return window.__TRACEFRAME_DATA__;
  try {
    const response = await fetch("/api/events", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Timeline API is unavailable");
    return await response.json() as TimelineData;
  } catch {
    return demoData;
  }
}

function LevelPill({ level }: { level: LogLevel | undefined }) {
  return <span className={`level-pill level-${level ?? "none"}`}>{level ?? "event"}</span>;
}

function DetailPanel({ event, close }: { event: TraceEvent; close(): void }) {
  return (
    <aside className="detail-panel" aria-label="Event details">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">Event details</span>
          <h2>{formatClock(event.timestamp)}</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="Close event details">×</button>
      </div>
      <LevelPill level={event.level} />
      <p className="detail-message">{event.message}</p>

      <dl className="metadata-list">
        <div><dt>Lane</dt><dd>{event.lane}</dd></div>
        <div><dt>Source</dt><dd>{event.source}</dd></div>
        {event.lineNumber && <div><dt>Line</dt><dd>{event.lineNumber}</dd></div>}
        {event.correlationIds.length > 0 && (
          <div><dt>Correlation</dt><dd>{event.correlationIds.join(", ")}</dd></div>
        )}
      </dl>

      <div className="detail-block">
        <h3>Raw log</h3>
        <pre>{event.raw}</pre>
      </div>
      {Object.keys(event.fields).length > 0 && (
        <div className="detail-block">
          <h3>Parsed fields</h3>
          <pre>{JSON.stringify(event.fields, null, 2)}</pre>
        </div>
      )}
    </aside>
  );
}

export function App() {
  const [data, setData] = useState<TimelineData>(() => window.__TRACEFRAME_DATA__ ?? demoData);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [lane, setLane] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    void loadData().then(setData);
  }, []);

  const lanes = useMemo(() => [...new Set(data.events.map((event) => event.lane))], [data.events]);
  const lowerQuery = query.trim().toLowerCase();
  const filteredEvents = useMemo(() => data.events.filter((event) => {
    const matchesQuery = !lowerQuery || [
      event.message,
      event.raw,
      event.source,
      event.lane,
      ...event.correlationIds,
      JSON.stringify(event.fields)
    ].some((value) => value.toLowerCase().includes(lowerQuery));
    return matchesQuery && (level === "all" || event.level === level) && (lane === "all" || event.lane === lane);
  }), [data.events, lane, level, lowerQuery]);

  const visibleLanes = lane === "all" ? lanes : lanes.filter((name) => name === lane);
  const selected = data.events.find((event) => event.id === selectedId);
  const correlatedIds = new Set(selected?.correlationIds ?? []);
  const minTime = data.events[0]?.timestamp ?? 0;
  const maxTime = data.events.at(-1)?.timestamp ?? minTime + 1;
  const timeSpan = Math.max(1, maxTime - minTime);
  const timelineWidth = Math.max(920, 920 * zoom);

  const position = (event: TraceEvent): number => {
    const rawPosition = ((event.timestamp - minTime) / timeSpan) * 100;
    return Math.min(99.4, Math.max(0.6, rawPosition));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="TraceFrame home">
          <span className="brand-mark">TF</span>
          <span>TraceFrame</span>
        </a>
        <div className="privacy-note"><span className="status-dot" /> Local only · No upload</div>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">Incident timeline</span>
          <h1>See the failure unfold.</h1>
          <p>{data.stats.files} sources merged into one precise sequence.</p>
        </div>
        <div className="hero-stats" aria-label="Timeline statistics">
          <div><strong>{data.stats.parsedEvents.toLocaleString()}</strong><span>events</span></div>
          <div><strong>{lanes.length}</strong><span>lanes</span></div>
          <div><strong>{formatDuration(timeSpan)}</strong><span>time range</span></div>
        </div>
      </section>

      <section className="workspace">
        <div className="filters" aria-label="Timeline filters">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages, fields, request IDs…"
              aria-label="Search events"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </label>
          <label className="select-field">
            <span>Level</span>
            <select value={level} onChange={(event) => setLevel(event.target.value as LogLevel | "all")}>
              {LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="select-field">
            <span>Lane</span>
            <select value={lane} onChange={(event) => setLane(event.target.value)}>
              <option value="all">all</option>
              {lanes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="zoom-controls" aria-label="Timeline zoom">
            <button onClick={() => setZoom((value) => Math.max(1, value - 0.5))} aria-label="Zoom out">−</button>
            <span>{zoom.toFixed(1)}×</span>
            <button onClick={() => setZoom((value) => Math.min(8, value + 0.5))} aria-label="Zoom in">+</button>
          </div>
        </div>

        <div className="result-summary">
          <span>{filteredEvents.length} of {data.events.length} events</span>
          <span>{data.stats.detectedParsers.map((parser) => parser.parserName).filter((name, index, all) => all.indexOf(name) === index).join(" + ")}</span>
        </div>

        <div className={`timeline-layout ${selected ? "with-details" : ""}`}>
          <div className="timeline-scroll">
            <div className="timeline-content" style={{ width: timelineWidth + 168 }}>
              <div className="axis-row">
                <div className="lane-label axis-label">SOURCE</div>
                <div className="axis" style={{ width: timelineWidth }}>
                  {Array.from({ length: TICK_COUNT }, (_, index) => {
                    const ratio = index / (TICK_COUNT - 1);
                    const timestamp = minTime + timeSpan * ratio;
                    return <span key={index} style={{ left: `${ratio * 100}%` }}>{formatClock(timestamp)}</span>;
                  })}
                </div>
              </div>

              {visibleLanes.map((laneName) => {
                const laneEvents = filteredEvents.filter((event) => event.lane === laneName);
                return (
                  <div className="lane-row" key={laneName}>
                    <div className="lane-label">
                      <strong>{laneName}</strong>
                      <span>{laneEvents.length} {laneEvents.length === 1 ? "event" : "events"}</span>
                    </div>
                    <div className="lane-track" style={{ width: timelineWidth }}>
                      {laneEvents.map((event) => {
                        const sharesCorrelation = event.correlationIds.some((id) => correlatedIds.has(id));
                        const eventPosition = position(event);
                        return (
                          <button
                            key={event.id}
                            className={`timeline-event event-${event.level ?? "none"} ${eventPosition > 82 ? "edge-right" : ""} ${selectedId === event.id ? "selected" : ""} ${sharesCorrelation ? "correlated" : ""}`}
                            style={{ left: `${eventPosition}%` }}
                            onClick={() => setSelectedId(event.id)}
                            title={`${formatClock(event.timestamp)} — ${event.message}`}
                          >
                            <span className="event-dot" />
                            <span className="event-label">{event.message}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {visibleLanes.length === 0 || filteredEvents.length === 0 ? (
                <div className="empty-state">No events match these filters.</div>
              ) : null}
            </div>
          </div>
          {selected && <DetailPanel event={selected} close={() => setSelectedId(undefined)} />}
        </div>
      </section>
    </main>
  );
}
