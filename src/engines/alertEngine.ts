import {
  PlatformAlert,
  AlertCategory,
  AlertSeverity,
  DecisionResult,
  DatasetMetadata,
  DataProvenance,
  ContractSymbol,
  LifecycleEligibilityCheck
} from '../types/market';

/**
 * Platform Alert & Notification Engine
 *
 * Manages deterministic internal alerts on:
 * - Signal generation and state transitions (ACTIONABLE, WATCH, NO TRADE)
 * - Edge degradation (spread falling below transaction cost hurdle)
 * - Contract lifecycle warnings (5-day tender window approach)
 * - Data health, quarantine counts, and unverified provenance warnings
 *
 * Features strict deduplication, timestamping, and rule-traceable triggers.
 */
class AlertManager {
  private alerts: PlatformAlert[] = [];
  private seenAlertKeys: Set<string> = new Set();
  private previousDecisions: Map<string, string> = new Map();
  private maxAlerts = 50;

  /**
   * Adds an alert with deduplication
   */
  public addAlert(params: {
    category: AlertCategory;
    severity: AlertSeverity;
    title: string;
    message: string;
    pair?: [ContractSymbol, ContractSymbol];
    symbol?: ContractSymbol;
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
   * Evaluates decision output, dataset metadata, and optional lifecycle checks to generate platform alerts
   */
  public evaluateSystemAlerts(
    decision: DecisionResult,
    metadata: DatasetMetadata,
    lifecycleContext?: {
      legA?: LifecycleEligibilityCheck;
      legB?: LifecycleEligibilityCheck;
    }
  ): PlatformAlert[] {
    const generated: PlatformAlert[] = [];
    const pairKey = decision.pair.join('/');
    const prevDecision = this.previousDecisions.get(pairKey);

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

    // 2. Signal Downgrade / Invalidation Detection
    if (prevDecision === 'ACTIONABLE' && decision.decision !== 'ACTIONABLE') {
      const alt = this.addAlert({
        category: 'SIGNAL',
        severity: 'WARNING',
        title: `Signal Downgraded / Invalidated: ${decision.pair.join(' / ')}`,
        message: `Previous actionable signal downgraded to ${decision.decision}. Net edge is now ₹${decision.netEdge}/10g. Immediate position review advised.`,
        pair: decision.pair,
        triggerRule: 'State Transition: ACTIONABLE -> ' + decision.decision,
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    }
    this.previousDecisions.set(pairKey, decision.decision);

    // 3. Contract Lifecycle Restriction Alerts
    if (lifecycleContext?.legA) {
      this.checkLifecycleAlert(lifecycleContext.legA, decision.pair, metadata.provenance, generated);
    }
    if (lifecycleContext?.legB) {
      this.checkLifecycleAlert(lifecycleContext.legB, decision.pair, metadata.provenance, generated);
    }

    // 4. Data Provenance & Health Alert
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
        message: `Dataset "${metadata.filename || 'import.csv'}" is user-imported and has not been independently verified by MCX.`,
        sourceProvenance: metadata.provenance
      });
      if (alt) generated.push(alt);
    }

    // 5. Data Health Anomaly Alerts
    if (metadata.totalRows === 0) {
      const alt = this.addAlert({
        category: 'DATA_HEALTH',
        severity: 'CRITICAL',
        title: 'Empty Market Dataset',
        message: 'Active dataset contains 0 observations. Analytical calculations unavailable until data is ingested.',
        sourceProvenance: metadata.provenance,
        triggerRule: 'Health Check: Row Count === 0'
      });
      if (alt) generated.push(alt);
    }

    return generated;
  }

  private checkLifecycleAlert(
    leg: LifecycleEligibilityCheck,
    pair: [ContractSymbol, ContractSymbol],
    provenance: DataProvenance,
    generated: PlatformAlert[]
  ): void {
    if (leg.lifecycleStage === 'ROLL_WINDOW') {
      const alt = this.addAlert({
        category: 'LIFECYCLE',
        severity: 'CRITICAL',
        title: `Delivery Tender Window Restriction: ${leg.symbol}`,
        message: leg.rejectionReason || `Contract ${leg.symbol} is within MCX 5-trading-day compulsory delivery tender window. New positions barred.`,
        symbol: leg.symbol,
        pair,
        triggerRule: 'MCX Compulsory Delivery Window (<= 5 Trading Days)',
        sourceProvenance: provenance
      });
      if (alt) generated.push(alt);
    } else if (leg.lifecycleStage === 'NEAR_EXPIRY') {
      const alt = this.addAlert({
        category: 'LIFECYCLE',
        severity: 'WARNING',
        title: `Contract Approaching Tender Window: ${leg.symbol}`,
        message: `Contract ${leg.symbol} has ${leg.tradingDaysToExpiry} trading days remaining until expiry. Pre-tender liquidation window active.`,
        symbol: leg.symbol,
        pair,
        triggerRule: 'Lifecycle Warning (6 to 10 Trading Days to Expiry)',
        sourceProvenance: provenance
      });
      if (alt) generated.push(alt);
    }
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
    this.previousDecisions.clear();
  }
}

export const alertManager = new AlertManager();
