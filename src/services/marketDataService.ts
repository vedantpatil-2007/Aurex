import { ContractSpecification, ContractSymbol, MarketObservation, NormalizedObservation, DataHealthSummary } from '../types/market';
import { CONTRACT_SPECIFICATIONS, CONTRACT_LIST } from '../data/contracts';
import { SEED_MARKET_DATA } from '../data/seedMarketData';
import { normalizeObservation } from '../engines/normalizationEngine';
import { validateMarketData } from '../utils/dataQuality';

/**
 * AUREX Market Data Service (Phase 2 Enhanced)
 * 
 * Abstraction layer for commodity derivatives market data.
 * In Prototype Mode, provides vetted local seed data calibrated to official MCX parameters.
 * Maintains discrete contracts by expiryDate (no synthetic continuous series).
 */
class MarketDataService {
  private localObservations: MarketObservation[] = SEED_MARKET_DATA;

  /**
   * Returns list of monitored contract specifications
   */
  public getContracts(): ContractSpecification[] {
    return CONTRACT_LIST;
  }

  /**
   * Returns contract specification by symbol
   */
  public getContractSpec(symbol: ContractSymbol): ContractSpecification {
    const spec = CONTRACT_SPECIFICATIONS[symbol];
    if (!spec) {
      throw new Error(`Unrecognized contract symbol: ${symbol}`);
    }
    return spec;
  }

  /**
   * Returns raw historical observations.
   * Filterable by symbol and date range.
   */
  public getHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
  }): MarketObservation[] {
    let result = [...this.localObservations];

    if (filter?.symbol) {
      result = result.filter(o => o.symbol === filter.symbol);
    }
    if (filter?.startDate) {
      result = result.filter(o => o.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      result = result.filter(o => o.date <= filter.endDate!);
    }

    // Sort ascending by date
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Returns historical observations normalized to ₹ / 10g @ 999 purity.
   */
  public getNormalizedHistoricalData(filter?: {
    symbol?: ContractSymbol;
    startDate?: string;
    endDate?: string;
  }): NormalizedObservation[] {
    const raw = this.getHistoricalData(filter);
    return raw.map(obs => normalizeObservation(obs));
  }

  /**
   * Returns latest available observation per contract symbol
   */
  public getLatestObservations(): Record<ContractSymbol, NormalizedObservation> {
    const latestDate = this.getAvailableDates().slice(-1)[0];
    const latestRaw = this.localObservations.filter(o => o.date === latestDate);

    const result: Partial<Record<ContractSymbol, NormalizedObservation>> = {};
    for (const obs of latestRaw) {
      result[obs.symbol] = normalizeObservation(obs);
    }

    return result as Record<ContractSymbol, NormalizedObservation>;
  }

  /**
   * Returns distinct trading dates sorted in ascending chronological order
   */
  public getAvailableDates(): string[] {
    const dates = Array.from(new Set(this.localObservations.map(o => o.date)));
    return dates.sort((a, b) => a.localeCompare(b));
  }

  /**
   * Returns Data Health metrics for the Phase 2A Data Health Panel
   */
  public getDataHealthSummary(): DataHealthSummary {
    const dates = this.getAvailableDates();
    const lastDate = dates.slice(-1)[0] || '2026-10-08';
    const report = validateMarketData(this.localObservations);

    return {
      source: 'Historical MCX / Prototype Simulation',
      totalRecords: this.localObservations.length,
      contractsCount: 4,
      lastAvailableDate: lastDate,
      qualityStatus: report.status,
      contractCoverage: '4 / 4 Monitored'
    };
  }

  /**
   * Placeholder hook for MCX live / asynchronous bhavcopy refresh
   */
  public async syncOfficialBhavcopy(_date: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Simulated Bhavcopy sync: Prototype Mode uses local calibrated seed data.'
    };
  }
}

export const marketDataService = new MarketDataService();
