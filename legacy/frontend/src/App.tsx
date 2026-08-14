import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import CameraTracker from './components/CameraTracker';
import { scanBrailleImage } from './services/brailleApi';
import type { BrailleScanResult } from './services/brailleApi';

// Configurable per environment (Vite). Falls back to localhost for local dev.
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:8080';

interface LiveMetrics {
  reading_speed: number;
  mistakes: number;
  rereads: number;
  word_count: number;
  mistake_ratio: number;
  duration: string; // already checked for valid input immediately after got the request in RestAPI/server.js (it would send 400, bad data format)
  created_at: string | null;
}

interface MetricsPoint extends LiveMetrics {
  sampleId: string;
}

interface DailyQuestion {
  id: string;
  question: string;
  body: string;
  answerHint?: string;
  updated_at?: string | null;
}

const views = [
  { id: 'overview', label: 'Overview' },
  { id: 'camera', label: 'Camera' },
  { id: 'pipeline', label: 'AI pipeline' },
  { id: 'dashboard', label: 'Dashboard' }
] as const;

type ViewId = (typeof views)[number]['id'];
type SessionState = 'idle' | 'capturing' | 'processing' | 'ready';

type ViewContent = {
  eyebrow: string;
  title: string;
  lede: string;
  primaryAction: string;
  secondaryAction: string;
};

const pipelineSteps = [
  {
    title: 'Camera capture',
    text: 'The device frames the Braille page and streams live video to the edge service.'
  },
  {
    title: 'AI inference',
    text: 'Vision models detect finger motion, reading path, and pauses in real time.'
  },
  {
    title: 'API handoff',
    text: 'Structured session events are sent to the web app for dashboards and teacher review.'
  }
];

const apiEvents = [
  {
    time: '00:04',
    title: 'Frame locked',
    detail: 'Page boundary detected, finger path tracking stable.'
  },
  {
    time: '00:11',
    title: 'Pause detected',
    detail: 'Long dwell near a new Braille pattern; model confidence 0.94.'
  },
  {
    time: '00:18',
    title: 'Reading summary ready',
    detail: 'Speed, rereads, skipped cells, and intervention notes pushed to the API.'
  }
];

const teacherSignals = [
  'Session speed compared with a teacher-reviewed reference',
  'Repeated backtracking and line loss',
  'Long pauses near unfamiliar Braille patterns',
  'A review queue for targeted instruction'
];

const pipelineStages = [
  {
    title: 'Perception',
    caption: 'The model isolates the Braille page, finger path, and reading region from the live frame.'
  },
  {
    title: 'Attention',
    caption: 'It focuses on pauses, regressions, and line transitions where reading behavior changes.'
  },
  {
    title: 'Interpretation',
    caption: 'The session is converted into speed, reread count, and skipped region signals.'
  },
  {
    title: 'Synthesis',
    caption: 'The API packages a teacher-facing summary that can drive the dashboard and review flow.'
  }
];

const fallbackDailyQuestions: DailyQuestion[] = [
  {
    id: 'question-1',
    question: 'Which part of the page did the student revisit most often?',
    body: 'Look for clusters of backtracking and relate them to the row or line where reading slowed down.',
    answerHint: 'Repeated pauses usually point to a harder line or an unfamiliar symbol.'
  },
  {
    id: 'question-2',
    question: 'Where did the reading pace change the most?',
    body: 'Compare the current sample to the previous sample to find the biggest shift in speed or dwell time.',
    answerHint: 'A sudden slowdown often appears near a difficult pattern.'
  },
  {
    id: 'question-3',
    question: 'Which lines show the most confident reading?',
    body: 'Identify rows with smoother movement and fewer rereads so teachers can spot strong sections quickly.',
    answerHint: 'Stable speed and fewer mistakes usually mean strong confidence.'
  },
  {
    id: 'question-4',
    question: 'What should the teacher review first?',
    body: 'Use the most recent skip and reread signal to prioritize the next intervention step.',
    answerHint: 'Start with the section that produced the highest reread count.'
  }
];

const viewContent: Record<ViewId, ViewContent> = {
  overview: {
    eyebrow: 'Reading intelligence platform',
    title: 'Make every Braille session measurable.',
    lede:
      'Prometheus Champions turns camera capture and session telemetry into a clean product flow for teachers, students, and reviewers.',
    primaryAction: 'Start session',
    secondaryAction: 'Open dashboard'
  },
  camera: {
    eyebrow: 'Live capture workspace',
    title: 'Run the reading session from one control surface.',
    lede:
      'Use the camera panel to frame the page, track the reading motion, and keep the session state visible while the API receives updates.',
    primaryAction: 'Start reading session',
    secondaryAction: 'Review analytics'
  },
  dashboard: {
    eyebrow: 'Session analytics',
    title: 'See reading speed, rereads, and skipped regions in real time.',
    lede:
      'The dashboard organizes the latest API output into charts and summary cards so judges see the product value immediately.',
    primaryAction: 'Back to camera',
    secondaryAction: 'Open pipeline'
  },
  pipeline: {
    eyebrow: 'AI thinking process',
    title: 'Watch the system think in stages.',
    lede:
      'Instead of a generic pipeline card, this view shows the model moving through perception, attention, interpretation, and synthesis.',
    primaryAction: 'View dashboard',
    secondaryAction: 'Open camera'
  }
};

const chartSeed = [44, 47, 51, 53, 58, 61];

function buildTrendSeries(current: number, offset = 0) {
  const base = current > 0 ? current : chartSeed[offset % chartSeed.length];

  return Array.from({ length: 6 }, (_, index) => {
    const previous = chartSeed[(offset + index) % chartSeed.length];
    const delta = Math.round((base - previous) * 0.35 + index * 1.5);
    return Math.max(0, previous + delta);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatSeriesLabel(value: number) {
  return `${Math.round(value)}`;
}

function toSampleId(metrics: LiveMetrics) {
  return metrics.created_at ?? `${metrics.reading_speed}-${metrics.mistakes}-${metrics.rereads}-${metrics.duration}`;
}

function appendMetricsPoint(history: MetricsPoint[], metrics: LiveMetrics) {
  const nextPoint: MetricsPoint = { ...metrics, sampleId: toSampleId(metrics) };
  const nextHistory = history.filter((point) => point.sampleId !== nextPoint.sampleId);
  nextHistory.push(nextPoint);
  return nextHistory.slice(-8);
}

function getFallbackDailyQuestion() {
  return fallbackDailyQuestions[new Date().getDate() % fallbackDailyQuestions.length];
}

function normalizeDailyQuestion(payload: unknown): DailyQuestion {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const question = typeof record.question === 'string' ? record.question : 'Daily reading prompt';
    const body =
      typeof record.body === 'string'
        ? record.body
        : typeof record.text === 'string'
          ? record.text
          : 'A new teacher prompt will appear here when the database updates.';

    return {
      id: typeof record.id === 'string' ? record.id : `${question}-${body}`,
      question,
      body,
      answerHint: typeof record.answerHint === 'string' ? record.answerHint : undefined,
      updated_at: typeof record.updated_at === 'string' ? record.updated_at : null
    };
  }

  return fallbackDailyQuestions[0];
}

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [image, setImage] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<BrailleScanResult | null>(null);
  const [dailyQuestion, setDailyQuestion] = useState<DailyQuestion>(getFallbackDailyQuestion());
  const [dailyQuestionOpen, setDailyQuestionOpen] = useState(true);
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    reading_speed: 0,
    mistakes: 0,
    rereads: 0,
    word_count: 0,
    mistake_ratio: 0,
    duration: '00:00',
    created_at: null
  });
  const [metricHistory, setMetricHistory] = useState<MetricsPoint[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const activeContent = viewContent[activeView];

  useEffect(() => {
    document.documentElement.dataset.theme = activeView;

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [activeView]);

  useEffect(() => {
    let isMounted = true;

    const fetchLatest = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/data`);
        if (!response.ok) throw new Error('Failed to load data');
        const result: LiveMetrics = await response.json();
        if (isMounted) {
          setLiveMetrics(result);
          setMetricHistory((history) => appendMetricsPoint(history, result));
        }
      } catch (err) {
        console.error('Failed to fetch initial metrics:', err);
      }
    };

    fetchLatest();

    const eventSource = new EventSource(`${API_BASE_URL}/events`);

    eventSource.onopen = () => {
      if (isMounted) setApiConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const updated: LiveMetrics = JSON.parse(event.data);
        if (isMounted) {
          setLiveMetrics(updated);
          setMetricHistory((history) => appendMetricsPoint(history, updated));
          setApiConnected(true);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      if (isMounted) setApiConnected(false);
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDailyQuestion = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/daily-question`);

        if (!response.ok) {
          throw new Error('Failed to load daily question');
        }

        const payload = await response.json();
        if (isMounted) {
          setDailyQuestion(normalizeDailyQuestion(payload));
          setDailyQuestionOpen(true);
        }
      } catch (err) {
        console.error('Failed to fetch daily question:', err);

        if (isMounted) {
          setDailyQuestion(getFallbackDailyQuestion());
        }
      }
    };

    fetchDailyQuestion();

    const refreshTimer = window.setInterval(fetchDailyQuestion, 24 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const metrics = [
    {
      label: 'Reading speed',
      value: `${liveMetrics.reading_speed} wpm equivalent`,
      detail: 'Live value from the latest session event.'
    },
    {
      label: 'Mistakes',
      value: `${liveMetrics.mistakes} flagged`,
      detail: 'Used to flag where the finger advanced without dwell time.'
    },
    {
      label: 'Rereads',
      value: `${liveMetrics.rereads} revisits`,
      detail: 'Highlights sections that were revisited for correction or comprehension.'
    },
    {
      label: 'Duration',
      value: `${liveMetrics.duration}`,
      detail: 'Used to widen the data analysis, so you know mistakes percentage.'
    },
    {
      label: 'Word count',
      value: `${liveMetrics.word_count} words`,
      detail: 'Total words in the passage, drives the expected reading duration.'
    },
    {
      label: 'Mistake ratio',
      value: `${(liveMetrics.mistake_ratio ?? 0).toFixed(2)}`,
      detail: 'Correctly read words per mistake — higher is better.'
    }
  ];

  const chartHistory = metricHistory.length > 0 ? metricHistory : [liveMetrics];
  const speedSeries = chartHistory.map((point) => point.reading_speed);
  const rereadSeries = chartHistory.map((point) => point.rereads);
  const skippedSeries = chartHistory.map((point) => point.mistakes);

  const chartWidth = 560;
  const chartHeight = 180;

  const chartPath = (series: number[]) => {
    const maxValue = Math.max(...series, 1);
    if (series.length === 1) {
      const y = chartHeight - (series[0] / maxValue) * (chartHeight - 18) - 10;
      return `0,${y} ${chartWidth},${y}`;
    }

    return series
      .map((value, index) => {
        const x = (index / (series.length - 1)) * chartWidth;
        const y = chartHeight - (value / maxValue) * (chartHeight - 18) - 10;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const barHeight = (value: number, maxValue: number) =>
    Math.max(10, (value / Math.max(maxValue, 1)) * (chartHeight - 28) + 8);

  const dashboardSummary = [
    { label: 'Latest speed', value: `${liveMetrics.reading_speed} wpm equivalent` },
    { label: 'Rereads', value: `${liveMetrics.rereads} revisits` },
    { label: 'Skipped regions', value: `${Math.max(0, liveMetrics.mistakes - 1)} flagged` },
    { label: 'Duration', value: `${liveMetrics.duration}`},
    { label: 'Word count', value: `${liveMetrics.word_count} words` },
    { label: 'Mistake ratio', value: `${liveMetrics.mistake_ratio.toFixed(2)}` }
  ];

  const dashboardSpanClass = analyticsCollapsed
    ? 'dashboard-stage analytics-collapsed'
    : chartHistory.length > 4
      ? 'dashboard-stage wide-history'
      : 'dashboard-stage';

  const cameraMode = activeView === 'camera';

  const activeViewLabel = views.find((view) => view.id === activeView)?.label ?? '';
  const fileLabel = image ? image.name : 'No file chosen yet';

  const handleScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!image) {
      setScanError('Please select an image first.');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const result = await scanBrailleImage(image);
      setScan(result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan image.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main className={cameraMode ? 'page-shell camera-mode' : 'page-shell'}>
      <header className="topbar">
        <div className="topbar-branding">
          <p className="brand-mark">Prometheus Champions</p>
          <h1>Give Braille reading a visible trail.</h1>
          <p className="brand-subtitle">
            A polished Braille reading workspace for capture, analysis, and teacher review.
          </p>
        </div>
        <div className="topbar-status">
          <span className={`status-pill state-${sessionState}`}>Session {sessionState}</span>
          <span className="status-caption">Current view: {activeViewLabel}</span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Application views">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={view.id === activeView ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setActiveView(view.id);
              if (view.id === 'camera') {
                setSessionState((currentState) => (currentState === 'idle' ? 'capturing' : currentState));
              }
            }}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <section className={`hero ${cameraMode ? 'camera-hero' : ''}`}>
        <div className={`hero-copy ${cameraMode ? 'camera-copy' : ''}`}>
          <span className="eyebrow">{activeContent.eyebrow}</span>
          <h1>{activeContent.title}</h1>
          {!cameraMode && <p className="lede">{activeContent.lede}</p>}
          <div className="hero-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                if (activeView === 'dashboard') {
                  setActiveView('camera');
                  return;
                }

                setSessionState('capturing');
                setActiveView('camera');
              }}
            >
              {cameraMode ? 'Camera live' : activeContent.primaryAction}
            </button>
            {!cameraMode && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  if (activeView === 'dashboard') {
                    setActiveView('pipeline');
                    return;
                  }

                  setActiveView('dashboard');
                }}
              >
                {activeContent.secondaryAction}
              </button>
            )}
          </div>
          {!cameraMode && (
            <form className="scan-form" onSubmit={handleScan} aria-label="Scan Braille image">
              <div className="upload-field">
                <div className="upload-copy">
                  <span className="upload-label">Braille image upload</span>
                  <strong>{fileLabel}</strong>
                  <p>PNG, JPG, or WEBP. Pick a clear page capture before starting the scan.</p>
                </div>
                <div className="upload-actions">
                  <label className="file-chooser" htmlFor="braille-image-input">
                    Choose file
                  </label>
                  <input
                    id="braille-image-input"
                    className="file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  />
                  <span className="file-state" aria-live="polite">
                    {fileLabel}
                  </span>
                </div>
              </div>
              <button type="submit" className="scan-button secondary-action" disabled={isScanning}>
                {isScanning ? 'Scanning…' : 'Scan Braille image'}
              </button>
            </form>
          )}
          {!cameraMode && scanError && <p role="alert">{scanError}</p>}
          {!cameraMode && scan && (
            <div aria-live="polite">
              <p>{scan.text || 'No Braille text was recognized.'}</p>
              <p>Confidence: {Math.round(scan.confidence * 100)}%</p>
              {scan.warnings.length > 0 && (
                <ul>
                  {scan.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="hero-panel" aria-label="Live reading preview">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">{activeView === 'dashboard' ? 'Session analytics' : 'Live session'}</p>
              <h2>
                {activeView === 'dashboard'
                  ? 'Analytics snapshot'
                  : activeView === 'pipeline'
                    ? 'Pipeline status'
                    : 'Camera preview'}
              </h2>
            </div>
            <span className="status-pill">
              {sessionState === 'ready'
                ? 'Summary synced'
                : activeView === 'dashboard'
                  ? 'Live charts'
                  : 'Tracking stable'}
            </span>
            <span className={`api-status-pill ${apiConnected ? 'state-ready' : 'state-idle'}`}>
              {apiConnected ? 'API Live' : 'API Reconnecting…'}
            </span>
          </div>

          {activeView === 'dashboard' ? (
            <div className={dashboardSpanClass}>
              <div className="dashboard-toolbar">
                <div>
                  <p className="panel-kicker">Daily prompt</p>
                  <h3>{dailyQuestion.question}</h3>
                </div>
                <button
                  type="button"
                  className="secondary-action dashboard-collapse-button"
                  onClick={() => setAnalyticsCollapsed((current) => !current)}
                >
                  {analyticsCollapsed ? 'Expand analytics' : 'Collapse analytics'}
                </button>
              </div>

              <section className="daily-question-card">
                <div className="daily-question-head">
                  <div>
                    <p className="section-tag">Question of the day</p>
                    <h3>{dailyQuestion.question}</h3>
                  </div>
                  <button
                    type="button"
                    className="text-toggle-button"
                    onClick={() => setDailyQuestionOpen((current) => !current)}
                  >
                    {dailyQuestionOpen ? 'Hide text' : 'Open text'}
                  </button>
                </div>

                {dailyQuestionOpen && (
                  <>
                    <p className="daily-question-body">{dailyQuestion.body}</p>
                    {dailyQuestion.answerHint && (
                      <p className="daily-question-hint">Hint: {dailyQuestion.answerHint}</p>
                    )}
                  </>
                )}

                <p className="daily-question-meta">
                  {dailyQuestion.updated_at ? `Updated ${dailyQuestion.updated_at}` : 'Auto-refreshes every 24 hours'}
                </p>
              </section>

              <div className="summary-grid">
                {dashboardSummary.map((item) => (
                  <article className="summary-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              {!analyticsCollapsed && (
                <div className="dashboard-grid">
                  <article className="chart-card chart-card-large">
                    <div className="chart-head">
                      <div>
                        <p>Reading speed</p>
                        <strong>{liveMetrics.reading_speed || 0} wpm equivalent</strong>
                      </div>
                      <span>Last 8 points</span>
                    </div>
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="line-chart"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <polyline points={chartPath(speedSeries)} />
                    </svg>
                    <div
                      className="chart-caption"
                      style={{ ['--chart-points' as string]: speedSeries.length }}
                    >
                      {speedSeries.map((value, index) => (
                        <span key={`speed-${index}`}>{formatSeriesLabel(value)}</span>
                      ))}
                    </div>
                  </article>

                  <article className="chart-card chart-card-half">
                    <div className="chart-head">
                      <div>
                        <p>Rereads</p>
                        <strong>{liveMetrics.rereads} revisits</strong>
                      </div>
                      <span>Session bursts</span>
                    </div>
                    <div
                      className="bar-chart bar-chart-wide"
                      style={{ ['--chart-points' as string]: rereadSeries.length }}
                      aria-hidden="true"
                    >
                      {rereadSeries.map((value, index) => (
                        <span
                          key={`reread-${index}`}
                          style={{ height: `${barHeight(value, Math.max(...rereadSeries, 1))}px` }}
                        />
                      ))}
                    </div>
                    <div
                      className="chart-caption muted"
                      style={{ ['--chart-points' as string]: rereadSeries.length }}
                    >
                      {rereadSeries.map((value, index) => (
                        <span key={`reread-label-${index}`}>{value}</span>
                      ))}
                    </div>
                  </article>

                  <article className="chart-card chart-card-half">
                    <div className="chart-head">
                      <div>
                        <p>Skipped regions</p>
                        <strong>{Math.max(0, liveMetrics.mistakes - 1)} flagged areas</strong>
                      </div>
                      <span>Reading path markers</span>
                    </div>
                    <div
                      className="skip-map skip-map-wide"
                      style={{ ['--chart-points' as string]: skippedSeries.length }}
                      aria-hidden="true"
                    >
                      {skippedSeries.map((value, index) => (
                        <span key={`skip-${index}`} className={value > 0 ? 'skip-dot active' : 'skip-dot'} />
                      ))}
                    </div>
                    <p className="chart-note">
                      Judges get a compact view of where the finger movement changed pace or skipped a
                      cell, without exposing raw debug text.
                    </p>
                  </article>

                  <article className="signal-panel">
                    <div className="section-heading">
                      <p className="section-tag">Teacher signals</p>
                      <h2>What to review next.</h2>
                    </div>
                    <div className="signal-list signal-list-wide">
                      {teacherSignals.map((signal) => (
                        <div key={signal} className="signal-item">{signal}</div>
                      ))}
                    </div>
                  </article>
                </div>
              )}
            </div>
          ) : activeView === 'pipeline' ? (
            <div className="pipeline-stage-grid">
              {pipelineStages.map((stage, index) => (
                <article className="pipeline-stage-card" key={stage.title}>
                  <div className="pipeline-stage-header">
                    <span>0{index + 1}</span>
                    <strong>{stage.title}</strong>
                  </div>
                  <p>{stage.caption}</p>
                </article>
              ))}
              <article className="pipeline-stage-card pipeline-stage-focus">
                <div className="pipeline-stage-header">
                  <span>LIVE</span>
                  <strong>Thinking trace</strong>
                </div>
                <div className="thinking-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p>
                  The model watches the frame, ranks likely reading motions, and promotes the most
                  stable path into the session summary.
                </p>
              </article>
            </div>
          ) : activeView === 'camera' ? (
            <CameraTracker
              passageText={scan?.text ?? ''}
              onSessionStateChange={setSessionState}
            />
          ) : (
            <div className="tracking-stage" aria-hidden="true">
              <div className="camera-viewport">
                <div className="camera-overlay camera-overlay-top">
                  <span>Live camera</span>
                  <strong>
                    {sessionState === 'idle'
                      ? 'Waiting for feed'
                      : sessionState === 'ready'
                        ? 'Session framed and recorded'
                        : 'Braille page framed'}
                  </strong>
                </div>
                <div className="braille-line" />
                <div className={sessionState === 'idle' ? 'finger-path quiet' : 'finger-path'}>
                  <span className="path-dot dot-one" />
                  <span className="path-dot dot-two" />
                  <span className="path-dot dot-three" />
                </div>
                <div className="camera-overlay camera-overlay-bottom">
                  <div>
                    <span>API status</span>
                    <strong>
                      {sessionState === 'ready'
                        ? 'Session payload delivered'
                        : 'Streaming events to the model'}
                    </strong>
                  </div>
                  <div>
                    <span>Inference</span>
                    <strong>{sessionState === 'processing' ? 'Processing' : 'Vision online'}</strong>
                  </div>
                </div>
              </div>
              <div className="readout-card">
                <span>Reading speed</span>
                <strong>
                  {sessionState === 'idle'
                    ? 'Ready to measure'
                    : `${liveMetrics.reading_speed} wpm equivalent`}
                </strong>
                <small>
                  {sessionState === 'ready'
                    ? 'Summary available for teacher review'
                    : 'Set a teacher-reviewed reference before classifying speed'}
                </small>
              </div>
            </div>
          )}
        </aside>
      </section>

      {!cameraMode && (
      <section className="content-grid">
        <section className="card flow-card">
          <div className="section-heading">
            <p className="section-tag">Operating flow</p>
            <h2>Capture, inference, and delivery.</h2>
          </div>
          <div className="step-list">
            {pipelineSteps.map((step, index) => (
              <article className="step-item" key={step.title}>
                <div className="step-index">0{index + 1}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mini-console">
            <p>POST /api/session/events</p>
            <code>{`{ "sessionId": "BRL-024", "status": "${sessionState}", "events": 18 }`}</code>
          </div>
        </section>

        <section className="card insights-card">
          <div className="section-heading">
            <p className="section-tag">AI output</p>
            <h2>What the model surfaces.</h2>
          </div>
          <div className="insight-grid">
            {metrics.map((item) => (
              <article className="insight" key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
          <div className="signal-list">
            {teacherSignals.map((signal) => (
              <div key={signal} className="signal-item">{signal}</div>
            ))}
          </div>
        </section>
      </section>
      )}

    </main>
  );
}
