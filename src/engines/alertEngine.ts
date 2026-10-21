import {
  PlatformAlert,
  AlertCategory,
  AlertSeverity,
  DecisionResult,
  DatasetMetadata,
  DataProvenance
} from '../types/market';

/**
 * Platform Alert & Notification Engine
 *
 * Manages deterministic internal alerts on:
 * - Signal generation and state transitions (ACTIONABLE, WATCH, NO TRADE)
 * - Edge degradation (spread falling below transaction cost hurdle)
 * - Contract lifecycle warnings (5-day tender window approach)
 * - Data health and unverified provenance warnings
 *
 * Features strict deduplication, timestamping, and rule-traceable triggers.
 */
class AlertManager {
  private alerts: PlatformAlert[] = [];
  private seenAlertKeys: Set<string> = new Set();
  private maxAlerts = 50;

  /**
   * Adds an alert with deduplication
   */
  public addAlert(params: {
    category: AlertCategory;
    severity: AlertSeverity;
    title: string;
    message: string;
    pair?: [any, any];
    symbol?: any;
    triggerRule?: string;
    sourceProvenance?: DataProvenance;
  }): PlatformAlert | null {
    // Deduplication key
    const dedupeKey = `${params.category}_${params.title}_${params.pair?.join('/') || params.symbol || 'GLOBAL'}`;
    if (this.seenAlertKeys.has(dedupeKey)) {
      return null;
    }
    this.seenAlertKeys.add(dedupeKey);

    const alert: PlatformAlert = {
      id: `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      category: params.category,
      severity: params.severity,
      title: params.title,
      message: params.message,
      pair: params.pair,
      symbol: params.symbol,
      triggerRule: params.triggerRule,
      sourceProvenance: params.sourceProvenance,
      isRead: false
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    return alert;
  }

  /**
   * Evaluates decision output and dataset metadata to generate platform alerts
   */
  public evaluateSystemAlerts(
    decision: DecisionResult,
    metadata: DatasetMetadata
  ): PlatformAlert[] {
    const generated: PlatformAlert[] = [];

    // 1. Signal & Decision State Alert
    if (decision.decision === 'ACTIONABLE') {
      const alt = this.addAlert({
        category: 'SIGNAL',
        severity: 'ACTION_REQUIRED',
        title: `Actionable Relative-Value Signal: ${decision.pair.join(' / ')}`,
        message: `Statistical spread (₹${decision.observedSpread}/10g) exceeds all friction hurdles with positive net defensible edge of ₹${decision.netEdge}/10g.`,
        pair: decision.pair,
        triggerRule: 'Rule 1: Net Edge > 0 and Liquidity Grade PASS',
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    } else if (decision.decision === 'NO TRADE' && decision.expectedEdge > 0) {
      const alt = this.addAlert({
        category: 'COST_HURDLE',
        severity: 'WARNING',
        title: `Opportunity Rejected: High Execution Friction`,
        message: `Theoretical edge of ₹${decision.expectedEdge}/10g was eliminated by transaction costs (₹${decision.totalFriction}/10g), resulting in a deficit of ₹${Math.abs(decision.netEdge)}/10g. Capital preserved.`,
        pair: decision.pair,
        triggerRule: 'Rule 2: Expected Edge <= Total Friction',
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    }

    // 2. Data Provenance & Health Alert
    if (metadata.provenance === 'PROTOTYPE SAMPLE — UNVERIFIED SOURCING') {
      const alt = this.addAlert({
        category: 'DATA_HEALTH',
        severity: 'INFO',
        title: 'Demonstration Sample Active',
        message: 'Currently evaluating bundled illustrative prototype dataset. Not verified official exchange settlement data.',
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    } else if (metadata.provenance === 'USER-IMPORTED DATA — SOURCE UNVERIFIED') {
      const alt = this.addAlert({
        category: 'DATA_HEALTH',
        severity: 'WARNING',
        title: 'User-Imported File (Unverified)',
        message: `Dataset "${metadata.filename || 'import.csv'}" is user-imported and has not been verified by an official exchange authority.`,
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    }

    return generated;
  }

  public getAlerts(): PlatformAlert[] {
    return [...this.alerts];
  }

  public getUnreadCount(): number {
    return this.alerts.filter(a => !a.isRead).length;
  }

  public markAsRead(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) alert.isRead = true;
  }

  public markAllAsRead(): void {
    this.alerts.forEach(a => { a.isRead = true; });
  }

  public clearAlerts(): void {
    this.alerts = [];
    this.seenAlertKeys.clear();
  }
}

export const alertManager = new AlertManager();
