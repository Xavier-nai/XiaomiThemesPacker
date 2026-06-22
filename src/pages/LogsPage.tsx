import { useEffect, useMemo, useRef, useState } from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { CheckIcon, DownloadIcon, SearchIcon, TrashIcon } from "../icons";
import { useResizeObserver } from "../hooks";
import type { LogEntry } from "../types";

export interface LogsPageLabels {
  logsPageTitle: string;
  monitoring: string;
  exportLogs: string;
  clearLogs: string;
  autoScroll: string;
  timestamp: string;
  filterLogs: string;
  lines: string;
  memory: string;
  connected: string;
}

interface LogsPageProps {
  logs: LogEntry[];
  labels: LogsPageLabels;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

export default function LogsPage({ logs, labels, setLogs }: LogsPageProps) {
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [timestamp, setTimestamp] = useState(true);
  const { ref, rect } = useResizeObserver<HTMLDivElement>();
  const listRef = useRef<VariableSizeList>(null);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((entry) => `${entry.time} ${entry.level} ${entry.message}`.toLowerCase().includes(needle));
  }, [logs, query]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [autoScroll, filteredLogs.length, rect.width, timestamp]);

  useEffect(() => {
    if (autoScroll && filteredLogs.length > 0) {
      listRef.current?.scrollToItem(filteredLogs.length - 1, "end");
    }
  }, [autoScroll, filteredLogs.length, logs.length]);

  const exportLogs = async () => {
    await window.xiaomiThemePacker.operations.exportLogs(logs);
  };

  const getItemSize = (index: number) => {
    const entry = filteredLogs[index];
    if (!entry) return 28;
    const listWidth = Math.max(220, rect.width || 720);
    const fixedWidth = (timestamp ? 98 : 0) + 58 + 40;
    const messageWidth = Math.max(96, listWidth - fixedWidth);
    const charsPerLine = Math.max(12, Math.floor(messageWidth / 7.2));
    const lines = Math.max(1, Math.ceil(entry.message.length / charsPerLine));
    return Math.ceil(lines * 19.5 + 10);
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    const entry = filteredLogs[index];
    return (
      <div className="log-row" style={style}>
        <div className={`log-line level-${entry.level.toLowerCase()}`} data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
          {timestamp && <span className="log-time">{entry.time}</span>}
          <span className="log-level">[{entry.level}]</span>
          <span className="log-message">{entry.message}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="page logs-page">
      <div className="log-shell" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
        <header className="log-header drag-bar">
          <div className="log-title-group">
            <h1>{labels.logsPageTitle}</h1>
            <div className="monitor-pill" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill"><span data-smooth-corner="circle" />{labels.monitoring}</div>
          </div>
          <div className="log-buttons">
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={exportLogs}><DownloadIcon />{labels.exportLogs}</button>
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={() => setLogs([])}><TrashIcon />{labels.clearLogs}</button>
          </div>
        </header>
        <div className="log-toolbar">
          <div className="check-row">
            <button type="button" className="check-option" aria-pressed={autoScroll} onClick={() => setAutoScroll((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">{autoScroll && <CheckIcon />}</span>
              <span>{labels.autoScroll}</span>
            </button>
            <button type="button" className="check-option" aria-pressed={timestamp} onClick={() => setTimestamp((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">{timestamp && <CheckIcon />}</span>
              <span>{labels.timestamp}</span>
            </button>
          </div>
          <div className="search-box" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.filterLogs} />
          </div>
        </div>
        <div ref={ref} className="log-content">
          <VariableSizeList
            ref={listRef}
            className="log-virtual-list"
            height={Math.max(120, rect.height)}
            width="100%"
            itemCount={filteredLogs.length}
            itemSize={getItemSize}
            overscanCount={8}
          >
            {Row}
          </VariableSizeList>
        </div>
        <footer className="log-footer">
          <div><span>{labels.lines}: {logs.length}</span><span>{labels.memory}: {getMemoryLabel()}</span></div>
          <div className="connected-dot"><span data-smooth-corner="circle" />{labels.connected}</div>
        </footer>
      </div>
    </section>
  );
}

function getMemoryLabel() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  if (!memory?.usedJSHeapSize) return "142MB";
  return `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`;
}
