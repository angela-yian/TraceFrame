# TraceFrame CLI

Turn raw logs into an interactive incident timeline without uploading them.

```bash
npx traceframe logs/ --stats
```

TraceFrame accepts files, directories, and standard input. It automatically detects plain timestamped logs, JSON Lines, syslog, Docker JSON logs, and Kubernetes CRI logs.

```bash
traceframe api.log worker.log
cat app.log | traceframe -
traceframe logs/ --export incident.html
```

The interactive viewer runs only on `127.0.0.1`. Standalone exports embed their assets and omit local file paths.
