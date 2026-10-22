/**
 * PROJECT EKO — OBSERVABILITY, STRUCTURED LOGGING & METRICS AGGREGATOR
 * Telemetry monitoring for FPS, zone concurrency, transaction throughput, latency, and fraud/ledger alerts.
 */

export interface SystemMetrics {
  serverUptimeSeconds: number;
  activePlayersOnline: number;
  activeVehiclesInZone: number;
  ledgerTransactionsProcessed: number;
  unresolvedLedgerDiscrepancies: number;
  clientAverageFps: number;
  fraudAlertsCount: number;
  payoutFailureRatePercent: number;
  httpRequestsTotal: number;
  httpErrors5xxTotal: number;
  httpErrors4xxTotal: number;
  authRateLimitRejectionsTotal: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface AlertEvent {
  alertId: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  category: 'LEDGER_MISMATCH' | 'PAYOUT_ANOMALY' | 'ANTI_CHEAT_FRAUD' | 'HIGH_ERROR_RATE' | 'SECURITY_VIOLATION';
  message: string;
  timestampMs: number;
}

export class ObservabilityCollector {
  private static startTime = Date.now();
  private static latencySamplesMs: number[] = [];
  private static alerts: AlertEvent[] = [];
  private static metrics: SystemMetrics = {
    serverUptimeSeconds: 0,
    activePlayersOnline: 0,
    activeVehiclesInZone: 0,
    ledgerTransactionsProcessed: 0,
    unresolvedLedgerDiscrepancies: 0,
    clientAverageFps: 60.0,
    fraudAlertsCount: 0,
    payoutFailureRatePercent: 0.0,
    httpRequestsTotal: 0,
    httpErrors5xxTotal: 0,
    httpErrors4xxTotal: 0,
    authRateLimitRejectionsTotal: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
  };

  public static getSnapshot(): SystemMetrics {
    this.metrics.serverUptimeSeconds = Math.round((Date.now() - this.startTime) / 1000);
    if (this.latencySamplesMs.length > 0) {
      const sum = this.latencySamplesMs.reduce((a, b) => a + b, 0);
      this.metrics.averageLatencyMs = Number((sum / this.latencySamplesMs.length).toFixed(2));
      const sorted = [...this.latencySamplesMs].sort((a, b) => a - b);
      const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      this.metrics.p95LatencyMs = Number(sorted[p95Idx].toFixed(2));
    }
    return { ...this.metrics };
  }

  public static recordHttpRequest(statusCode: number, durationMs: number): void {
    this.metrics.httpRequestsTotal += 1;
    if (statusCode >= 500) {
      this.metrics.httpErrors5xxTotal += 1;
    } else if (statusCode >= 400) {
      this.metrics.httpErrors4xxTotal += 1;
      if (statusCode === 429) {
        this.metrics.authRateLimitRejectionsTotal += 1;
      }
    }
    if (Number.isFinite(durationMs) && durationMs >= 0) {
      this.latencySamplesMs.push(durationMs);
      if (this.latencySamplesMs.length > 500) {
        this.latencySamplesMs.shift();
      }
    }
  }

  public static recordLedgerTx(): void {
    this.metrics.ledgerTransactionsProcessed += 1;
  }

  public static recordLedgerDiscrepancy(message: string): void {
    this.metrics.unresolvedLedgerDiscrepancies += 1;
    this.triggerAlert('CRITICAL', 'LEDGER_MISMATCH', message);
  }

  public static setPlayerCount(count: number): void {
    this.metrics.activePlayersOnline = count;
  }

  public static setVehicleCount(count: number): void {
    this.metrics.activeVehiclesInZone = count;
  }

  public static recordFraudAlert(message = 'Anti-cheat movement or evidence anomaly detected'): void {
    this.metrics.fraudAlertsCount += 1;
    this.triggerAlert('WARN', 'ANTI_CHEAT_FRAUD', message);
  }

  public static triggerAlert(
    severity: AlertEvent['severity'],
    category: AlertEvent['category'],
    message: string
  ): AlertEvent {
    const alert: AlertEvent = {
      alertId: `alert_${Date.now()}_${this.alerts.length + 1}`,
      severity,
      category,
      message,
      timestampMs: Date.now(),
    };
    this.alerts.push(alert);
    if (this.alerts.length > 200) {
      this.alerts.shift();
    }
    return alert;
  }

  public static getAlerts(): AlertEvent[] {
    return [...this.alerts];
  }
}
