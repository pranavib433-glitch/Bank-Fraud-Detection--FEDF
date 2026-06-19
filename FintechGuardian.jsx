import { useState, useEffect, useRef, useMemo } from "react";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Search, Filter, X, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

// ---------------------------------------------------------------------------
// Mock data generation — simulates a live transaction risk-scoring feed
// ---------------------------------------------------------------------------

const MERCHANTS = [
  "Helio Market", "Northwind Grocers", "Quantum Electronics", "Pier 9 Cafe",
  "Vellum Books", "Strata Travel", "Bramble & Co", "Atlas Fuel Stop",
  "Cinder Gym", "Foundry Hardware", "Lumen Pharmacy", "Drift Records",
];

const LOCATIONS = [
  "Austin, TX", "Lagos, NG", "Manila, PH", "Berlin, DE", "Singapore, SG",
  "Toronto, CA", "Sao Paulo, BR", "Mumbai, IN", "Prague, CZ", "Nairobi, KE",
];

const FLAG_REASONS = [
  "Velocity anomaly: 4 txns in 90s",
  "Geo mismatch vs. last known location",
  "New device fingerprint",
  "Amount exceeds 30-day average by 6.2x",
  "Card-not-present from high-risk BIN range",
  "Merchant category rarely used by cardholder",
];

function seedRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function scoreToTier(score) {
  if (score >= 75) return "critical";
  if (score >= 40) return "elevated";
  return "clear";
}

function generateTransaction(id, rng) {
  const amount = Math.round((rng() * 980 + 4) * 100) / 100;
  const baseScore = rng() * 100;
  // skew distribution so most transactions are low risk
  const score = Math.round(Math.pow(baseScore / 100, 1.8) * 100);
  const tier = scoreToTier(score);
  const reasonCount = tier === "critical" ? 2 + Math.floor(rng() * 2) : tier === "elevated" ? 1 : 0;
  const reasons = [];
  const usedIdx = new Set();
  for (let i = 0; i < reasonCount; i++) {
    let idx = Math.floor(rng() * FLAG_REASONS.length);
    let attempts = 0;
    while (usedIdx.has(idx) && attempts < 10) {
      idx = Math.floor(rng() * FLAG_REASONS.length);
      attempts++;
    }
    usedIdx.add(idx);
    reasons.push(FLAG_REASONS[idx]);
  }

  return {
    id,
    merchant: MERCHANTS[Math.floor(rng() * MERCHANTS.length)],
    location: LOCATIONS[Math.floor(rng() * LOCATIONS.length)],
    amount,
    score,
    tier,
    reasons,
    cardLast4: String(1000 + Math.floor(rng() * 9000)).slice(0, 4),
    timestamp: Date.now() - Math.floor(rng() * 1000 * 60),
    status: tier === "critical" ? "held" : "approved",
  };
}

function buildInitialFeed(count = 28) {
  const rng = seedRandom(42);
  const txns = [];
  for (let i = 0; i < count; i++) {
    txns.push(generateTransaction(`TX-${10042 + i}`, rng));
  }
  return txns.sort((a, b) => b.timestamp - a.timestamp);
}

// ---------------------------------------------------------------------------
// Visual primitives
// ---------------------------------------------------------------------------

const TIER_META = {
  critical: { label: "Critical", color: "#C75C4A", glow: "rgba(199,92,74,0.35)" },
  elevated: { label: "Elevated", color: "#D4A24C", glow: "rgba(212,162,76,0.3)" },
  clear: { label: "Clear", color: "#5B8C7B", glow: "rgba(91,140,123,0.3)" },
};

function RiskGauge({ score, tier, size = 56 }) {
  const meta = TIER_META[tier];
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="risk-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1E2329"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <span className="risk-gauge-value" style={{ color: meta.color }}>{score}</span>
    </div>
  );
}

function TierIcon({ tier, size = 16 }) {
  const meta = TIER_META[tier];
  const Icon = tier === "critical" ? ShieldAlert : tier === "elevated" ? ShieldQuestion : ShieldCheck;
  return <Icon size={size} color={meta.color} strokeWidth={2} />;
}

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({ transactions }) {
  const stats = useMemo(() => {
    const total = transactions.length;
    const critical = transactions.filter((t) => t.tier === "critical").length;
    const elevated = transactions.filter((t) => t.tier === "elevated").length;
    const held = transactions.filter((t) => t.status === "held").length;
    const avgScore = total ? Math.round(transactions.reduce((s, t) => s + t.score, 0) / total) : 0;
    const exposureHeld = transactions.filter((t) => t.status === "held").reduce((s, t) => s + t.amount, 0);
    return { total, critical, elevated, held, avgScore, exposureHeld };
  }, [transactions]);

  return (
    <div className="summary-strip">
      <div className="summary-item">
        <span className="summary-label">Monitored</span>
        <span className="summary-value">{stats.total}</span>
        <span className="summary-sub">transactions / session</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-label">Held for review</span>
        <span className="summary-value" style={{ color: TIER_META.critical.color }}>{stats.held}</span>
        <span className="summary-sub">${stats.exposureHeld.toLocaleString(undefined, { minimumFractionDigits: 2 })} exposure</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-label">Elevated watch</span>
        <span className="summary-value" style={{ color: TIER_META.elevated.color }}>{stats.elevated}</span>
        <span className="summary-sub">flagged, not held</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-label">Mean risk score</span>
        <span className="summary-value">{stats.avgScore}</span>
        <div className="mean-bar">
          <div className="mean-bar-fill" style={{ width: `${stats.avgScore}%` }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction row + detail panel
// ---------------------------------------------------------------------------

function TransactionRow({ txn, isNew, onSelect, isSelected }) {
  const meta = TIER_META[txn.tier];
  return (
    <button
      className={`txn-row ${isNew ? "txn-row-enter" : ""} ${isSelected ? "txn-row-selected" : ""}`}
      onClick={() => onSelect(txn)}
      style={{ "--accent": meta.color }}
    >
      <div className="txn-row-gauge">
        <RiskGauge score={txn.score} tier={txn.tier} size={40} />
      </div>
      <div className="txn-row-main">
        <div className="txn-row-top">
          <span className="txn-merchant">{txn.merchant}</span>
          <span className="txn-amount">${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="txn-row-bottom">
          <span className="txn-meta">•••• {txn.cardLast4}</span>
          <span className="txn-meta-dot">·</span>
          <span className="txn-meta">{txn.location}</span>
          <span className="txn-meta-dot">·</span>
          <span className="txn-meta">{timeAgo(txn.timestamp)}</span>
        </div>
      </div>
      <div className="txn-row-status">
        <TierIcon tier={txn.tier} size={15} />
        <span style={{ color: meta.color }}>{meta.label}</span>
      </div>
    </button>
  );
}

function DetailPanel({ txn, onClose, onResolve }) {
  if (!txn) {
    return (
      <div className="detail-panel detail-panel-empty">
        <Activity size={28} color="#3A4148" strokeWidth={1.5} />
        <p>Select a transaction to inspect its risk breakdown.</p>
      </div>
    );
  }

  const meta = TIER_META[txn.tier];

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <span className="detail-id">{txn.id}</span>
          <h3>{txn.merchant}</h3>
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close detail panel">
          <X size={18} />
        </button>
      </div>

      <div className="detail-gauge-row">
        <RiskGauge score={txn.score} tier={txn.tier} size={88} />
        <div className="detail-gauge-label">
          <span style={{ color: meta.color }}>{meta.label} risk</span>
          <span className="detail-gauge-sub">Score computed from {txn.reasons.length || "0"} signal{txn.reasons.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <dl className="detail-fields">
        <div className="detail-field">
          <dt>Amount</dt>
          <dd>${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd>
        </div>
        <div className="detail-field">
          <dt>Card</dt>
          <dd>•••• {txn.cardLast4}</dd>
        </div>
        <div className="detail-field">
          <dt>Location</dt>
          <dd>{txn.location}</dd>
        </div>
        <div className="detail-field">
          <dt>Status</dt>
          <dd className={txn.status === "held" ? "status-held" : "status-approved"}>
            {txn.status === "held" ? "Held for review" : "Approved"}
          </dd>
        </div>
      </dl>

      {txn.reasons.length > 0 && (
        <div className="detail-signals">
          <span className="detail-signals-label">Signals raised</span>
          <ul>
            {txn.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {txn.status === "held" && (
        <div className="detail-actions">
          <button className="action-btn action-clear" onClick={() => onResolve(txn.id, "approved")}>
            Clear transaction
          </button>
          <button className="action-btn action-block" onClick={() => onResolve(txn.id, "blocked")}>
            Block & escalate
          </button>
        </div>
      )}
      {txn.status === "blocked" && (
        <div className="detail-resolved-note">Blocked and escalated to fraud team.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function FintechGuardian() {
  const [transactions, setTransactions] = useState(buildInitialFeed());
  const [selected, setSelected] = useState(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [newIds, setNewIds] = useState(new Set());
  const [isLive, setIsLive] = useState(true);
  const nextId = useRef(10042 + 28);
  const rngRef = useRef(seedRandom(Date.now() % 100000));

  // simulate a live feed
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const id = `TX-${nextId.current++}`;
      const txn = generateTransaction(id, rngRef.current);
      txn.timestamp = Date.now();
      setTransactions((prev) => [txn, ...prev].slice(0, 60));
      setNewIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 900);
    }, 3200);
    return () => clearInterval(interval);
  }, [isLive]);

  const handleResolve = (id, status) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (tierFilter !== "all" && t.tier !== tierFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = `${t.merchant} ${t.location} ${t.id} ${t.cardLast4}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, tierFilter, query]);

  return (
    <div className="fg-root">
      <style>{STYLES}</style>

      <header className="fg-header">
        <div className="fg-brand">
          <div className="fg-brand-mark">
            <ShieldCheck size={20} color="#5B8C7B" strokeWidth={2.25} />
          </div>
          <div>
            <h1>Fintech Guardian</h1>
            <span className="fg-brand-sub">Real-time transaction risk monitoring</span>
          </div>
        </div>
        <button
          className={`live-toggle ${isLive ? "live-on" : "live-off"}`}
          onClick={() => setIsLive((v) => !v)}
        >
          <span className="live-dot" />
          {isLive ? "Live feed" : "Feed paused"}
        </button>
      </header>

      <SummaryStrip transactions={transactions} />

      <div className="fg-body">
        <section className="fg-feed">
          <div className="fg-feed-controls">
            <div className="search-box">
              <Search size={15} color="#6B7280" />
              <input
                type="text"
                placeholder="Search merchant, location, card, or ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filter-pills">
              {["all", "critical", "elevated", "clear"].map((tier) => (
                <button
                  key={tier}
                  className={`filter-pill ${tierFilter === tier ? "filter-pill-active" : ""}`}
                  style={tier !== "all" ? { "--accent": TIER_META[tier].color } : undefined}
                  onClick={() => setTierFilter(tier)}
                >
                  {tier === "all" ? "All" : TIER_META[tier].label}
                </button>
              ))}
            </div>
          </div>

          <div className="fg-feed-list" role="list">
            {filtered.length === 0 && (
              <div className="feed-empty">
                <Filter size={20} color="#3A4148" />
                <p>No transactions match these filters.</p>
              </div>
            )}
            {filtered.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                isNew={newIds.has(txn.id)}
                onSelect={setSelected}
                isSelected={selected && selected.id === txn.id}
              />
            ))}
          </div>
        </section>

        <aside className="fg-aside">
          <DetailPanel
            txn={selected}
            onClose={() => setSelected(null)}
            onResolve={handleResolve}
          />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = `
.fg-root {
  --bg: #0B0D10;
  --panel: #13171C;
  --panel-raised: #181D23;
  --border: #1E2329;
  --text: #E8EAED;
  --text-dim: #8B939C;
  --text-faint: #5A6169;
  --green: #5B8C7B;
  --red: #C75C4A;
  --amber: #D4A24C;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100%;
  border-radius: 12px;
  padding: 28px;
  max-width: 1180px;
  margin: 0 auto;
  box-sizing: border-box;
}
.fg-root * { box-sizing: border-box; }
.fg-root *:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .fg-root * { transition: none !important; animation: none !important; }
}

/* Header */
.fg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.fg-brand { display: flex; align-items: center; gap: 12px; }
.fg-brand-mark {
  width: 38px; height: 38px;
  border-radius: 9px;
  background: var(--panel);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.fg-brand h1 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 2px 0;
  color: var(--text);
}
.fg-brand-sub { font-size: 12px; color: var(--text-dim); }

.live-toggle {
  display: flex; align-items: center; gap: 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 7px 13px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-dim);
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.live-toggle:hover { border-color: #2A3138; }
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}
.live-toggle.live-on .live-dot {
  background: var(--green);
  box-shadow: 0 0 0 0 rgba(91,140,123,0.6);
  animation: pulse-dot 2s ease-in-out infinite;
}
.live-toggle.live-on { color: var(--green); }
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(91,140,123,0.5); }
  50% { box-shadow: 0 0 0 4px rgba(91,140,123,0); }
}

/* Summary strip */
.summary-strip {
  display: flex;
  align-items: stretch;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 18px;
  gap: 24px;
}
.summary-item { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}
.summary-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.1;
}
.summary-sub { font-size: 11.5px; color: var(--text-dim); }
.summary-divider { width: 1px; background: var(--border); align-self: stretch; }
.mean-bar {
  height: 4px; border-radius: 2px;
  background: var(--border);
  overflow: hidden;
  margin-top: 4px;
}
.mean-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green), var(--amber), var(--red));
  transition: width 0.5s ease;
}

/* Body layout */
.fg-body { display: grid; grid-template-columns: 1fr 320px; gap: 18px; align-items: start; }
@media (max-width: 760px) {
  .fg-body { grid-template-columns: 1fr; }
}

/* Feed controls */
.fg-feed {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.fg-feed-controls {
  display: flex; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.search-box {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 11px;
  flex: 1;
  min-width: 180px;
}
.search-box input {
  background: none; border: none; outline: none;
  color: var(--text);
  font-size: 13px;
  width: 100%;
  font-family: 'Inter', sans-serif;
}
.search-box input::placeholder { color: var(--text-faint); }
.filter-pills { display: flex; gap: 6px; }
.filter-pill {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 7px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.filter-pill:hover { border-color: #2A3138; }
.filter-pill-active {
  color: var(--text);
  border-color: var(--accent, var(--green));
  background: color-mix(in srgb, var(--accent, var(--green)) 14%, var(--bg));
}

/* Feed list */
.fg-feed-list {
  max-height: 560px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.feed-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px 20px;
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
}

.txn-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text);
  transition: background 0.15s ease;
}
.txn-row:hover { background: var(--panel-raised); }
.txn-row-selected { background: var(--panel-raised); box-shadow: inset 3px 0 0 var(--accent); }
.txn-row-enter { animation: row-enter 0.6s ease; }
@keyframes row-enter {
  0% { background: color-mix(in srgb, var(--accent) 20%, var(--panel)); }
  100% { background: transparent; }
}

.risk-gauge { position: relative; flex-shrink: 0; }
.risk-gauge svg { display: block; }
.risk-gauge-value {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
}

.txn-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.txn-row-top { display: flex; justify-content: space-between; gap: 10px; }
.txn-merchant { font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.txn-amount { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-dim); flex-shrink: 0; }
.txn-row-bottom { display: flex; gap: 6px; align-items: center; }
.txn-meta { font-size: 11.5px; color: var(--text-faint); }
.txn-meta-dot { color: var(--text-faint); font-size: 11px; }

.txn-row-status {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 500;
  flex-shrink: 0;
  width: 76px;
}

/* Detail panel */
.detail-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  position: sticky;
  top: 0;
}
.detail-panel-empty {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 56px 20px;
  text-align: center;
  color: var(--text-faint);
  font-size: 13px;
}
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.detail-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-faint); }
.detail-header h3 { font-size: 16px; margin: 4px 0 0 0; font-weight: 600; }
.detail-close {
  background: none; border: none; color: var(--text-faint);
  cursor: pointer; padding: 4px; border-radius: 6px;
  display: flex;
}
.detail-close:hover { color: var(--text); background: var(--panel-raised); }

.detail-gauge-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.detail-gauge-label { display: flex; flex-direction: column; gap: 3px; font-size: 13px; font-weight: 600; }
.detail-gauge-sub { font-size: 11.5px; color: var(--text-faint); font-weight: 400; }

.detail-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 0 0 18px 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.detail-field dt { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); margin-bottom: 3px; }
.detail-field dd { font-size: 13px; margin: 0; font-family: 'JetBrains Mono', monospace; }
.status-held { color: var(--red); }
.status-approved { color: var(--green); }

.detail-signals { margin-bottom: 18px; }
.detail-signals-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); display: block; margin-bottom: 8px; }
.detail-signals ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
.detail-signals li {
  font-size: 12.5px;
  color: var(--text-dim);
  padding-left: 14px;
  position: relative;
  line-height: 1.4;
}
.detail-signals li::before {
  content: '';
  position: absolute;
  left: 0; top: 6px;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--amber);
}

.detail-actions { display: flex; gap: 8px; }
.action-btn {
  flex: 1;
  padding: 10px 12px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: 'Inter', sans-serif;
  transition: opacity 0.15s ease;
}
.action-btn:hover { opacity: 0.85; }
.action-clear { background: color-mix(in srgb, var(--green) 18%, var(--panel)); color: var(--green); border-color: color-mix(in srgb, var(--green) 35%, var(--panel)); }
.action-block { background: color-mix(in srgb, var(--red) 18%, var(--panel)); color: var(--red); border-color: color-mix(in srgb, var(--red) 35%, var(--panel)); }
.detail-resolved-note { font-size: 12.5px; color: var(--text-faint); font-style: italic; }
`;
