import { ContractSpecification, ContractSymbol } from '../types/market';

export const CONTRACT_SPECIFICATIONS: Record<ContractSymbol, ContractSpecification> = {
  GOLDM: {
    symbol: 'GOLDM',
    name: 'Gold Mini Futures',
    contractSizeGrams: 100,
    quoteUnitGrams: 10,
    purityPermille: 995,
    expiryScheduleDesc: '3rd–5th of delivery month',
    tickSize: 1.0,
    tradingLotDescription: '100 grams (1 mini bar)',
    deliveryUnit: '100 grams (Ahmedabad/Mumbai basis)'
  },
  GOLDTEN: {
    symbol: 'GOLDTEN',
    name: 'Gold 10 Grams Futures',
    contractSizeGrams: 10,
    quoteUnitGrams: 1,
    purityPermille: 995,
    expiryScheduleDesc: '27th–31st of contract month',
    tickSize: 0.5,
    tradingLotDescription: '10 grams',
    deliveryUnit: '10 grams (compulsory delivery)'
  },
  GOLDGUINEA: {
    symbol: 'GOLDGUINEA',
    name: 'Gold Guinea Futures',
    contractSizeGrams: 8,
    quoteUnitGrams: 8,
    purityPermille: 999,
    expiryScheduleDesc: '27th–31st of contract month',
    tickSize: 1.0,
    tradingLotDescription: '8 grams (1 coin)',
    deliveryUnit: '8 grams coin'
  },
  GOLDPETAL: {
    symbol: 'GOLDPETAL',
    name: 'Gold Petal Futures',
    contractSizeGrams: 1,
    quoteUnitGrams: 1,
    purityPermille: 999,
    expiryScheduleDesc: '27th–31st of contract month',
    tickSize: 1.0,
    tradingLotDescription: '1 gram',
    deliveryUnit: '1 gram tamper-proof coin/bar'
  }
};

export const CONTRACT_LIST: ContractSpecification[] = Object.values(CONTRACT_SPECIFICATIONS);

export const BENCHMARK_SPECIFICATION = {
  quoteUnitGrams: 10,
  purityPermille: 999,
  description: '₹ / 10 grams @ 999 Fineness (Standard Institutional Valuation Basis)'
};
