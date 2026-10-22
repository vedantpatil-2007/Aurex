import { ContractSpecification, ContractSymbol, ContractDeliveryRules } from '../types/market';

export const CONTRACT_SPECIFICATIONS: Record<ContractSymbol, ContractSpecification> = {
  GOLDM: {
    symbol: 'GOLDM',
    name: 'Gold Mini Futures',
    contractSizeGrams: 100,
    quoteUnitGrams: 10,
    purityPermille: 995,
    expiryScheduleDesc: '5th of delivery month',
    tickSize: 1.0,
    tradingLotDescription: '100 grams (1 mini bar)',
    deliveryUnit: '100 grams (Ahmedabad/Mumbai basis)',
    listingEffectiveDate: '2005-01-01',
    tenderPeriodDays: 5,
    deliveryMechanism: 'Compulsory Delivery',
    officialCircular: 'MCX Gold Mini Contract Specifications'
  },
  GOLDTEN: {
    symbol: 'GOLDTEN',
    name: 'Gold 10 Grams Futures',
    contractSizeGrams: 10,
    quoteUnitGrams: 10,
    purityPermille: 999,
    expiryScheduleDesc: '27th–31st of contract month',
    tickSize: 1.0,
    tradingLotDescription: '10 grams',
    deliveryUnit: '10 grams (compulsory delivery)',
    listingEffectiveDate: '2025-04-01',
    tenderPeriodDays: 5,
    deliveryMechanism: 'Compulsory Delivery',
    officialCircular: 'Circular No. MCX/TRD/134/2025 (March 18, 2025)'
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
    deliveryUnit: '8 grams coin',
    listingEffectiveDate: '2008-04-01',
    tenderPeriodDays: 5,
    deliveryMechanism: 'Compulsory Delivery',
    officialCircular: 'MCX Gold Guinea Contract Specifications'
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
    deliveryUnit: '1 gram',
    listingEffectiveDate: '2011-04-01',
    tenderPeriodDays: 5,
    deliveryMechanism: 'Compulsory Delivery',
    officialCircular: 'MCX Gold Petal Contract Specifications'
  }
};

export const CONTRACT_DELIVERY_RULES: Record<ContractSymbol, ContractDeliveryRules> = {
  GOLDM: {
    symbol: 'GOLDM',
    deliveryType: 'COMPULSORY_DELIVERY',
    tenderPeriodDays: 5,
    deliveryUnit: '100 grams bar (995 fineness)',
    deliveryCenter: 'Ahmedabad / Mumbai basis centers',
    listingEffectiveDate: '2005-01-01',
    officialCircularReference: 'MCX Gold Mini Specifications (Compulsory Delivery)'
  },
  GOLDTEN: {
    symbol: 'GOLDTEN',
    deliveryType: 'COMPULSORY_DELIVERY',
    tenderPeriodDays: 5,
    deliveryUnit: '10 grams bar (999 fineness)',
    deliveryCenter: 'Ahmedabad (basis) and Mumbai centers',
    listingEffectiveDate: '2025-04-01',
    officialCircularReference: 'MCX Circular No. MCX/TRD/134/2025 (Launch of Gold Ten Futures)'
  },
  GOLDGUINEA: {
    symbol: 'GOLDGUINEA',
    deliveryType: 'COMPULSORY_DELIVERY',
    tenderPeriodDays: 5,
    deliveryUnit: '8 grams coin (999 fineness in certicard)',
    deliveryCenter: 'Ahmedabad / Mumbai approved vaults',
    listingEffectiveDate: '2008-04-01',
    officialCircularReference: 'MCX Gold Guinea Specifications (Serially Numbered Coins)'
  },
  GOLDPETAL: {
    symbol: 'GOLDPETAL',
    deliveryType: 'COMPULSORY_DELIVERY',
    tenderPeriodDays: 5,
    deliveryUnit: '1 gram coin/bar (999 fineness in tamper-proof certicard)',
    deliveryCenter: 'Ahmedabad / Mumbai approved vaults',
    listingEffectiveDate: '2011-04-01',
    officialCircularReference: 'MCX Gold Petal Specifications'
  }
};

export const CONTRACT_LIST: ContractSpecification[] = Object.values(CONTRACT_SPECIFICATIONS);
