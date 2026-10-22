import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, NavigationPage } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PrototypeBanner } from './components/layout/PrototypeBanner';
import { JudgeTourStepper, JUDGE_STEPS } from './components/guide/JudgeTourStepper';
import { marketDataService } from './services/marketDataService';
import { validateMarketData } from './utils/dataQuality';
import { buildPairSpreadSeries, calculateZScore } from './engines/relativeValueEngine';
import { evaluateDecision } from './engines/decisionEngine';
import {
  ContractSymbol,
  FrictionAssumptions,
  NormalizedObservation,
  MarketObservation,
  DataMode
} from './types/market';

// Pages
import { Overview } from './pages/Overview';
import { DataLab } from './pages/DataLab';
import { Contracts } from './pages/Contracts';
import { Normalization } from './pages/Normalization';
import { RelativeValue } from './pages/RelativeValue';
import { Ledger } from './pages/Ledger';
import { Validation } from './pages/Validation';
import { Decision } from './pages/Decision';

export function App() {
  // Navigation State with hash sync
  const [activePage, setActivePage] = useState<NavigationPage>(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const validPages: NavigationPage[] = [
      'overview',
      'data-lab',
      'contracts',
      'normalization',
      'relative-value',
      'ledger',
      'validation',
      'decision'
    ];
    if (validPages.includes(hash as NavigationPage)) {
      return hash as NavigationPage;
    }
    return 'overview';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const validPages: NavigationPage[] = [
        'overview',
        'data-lab',
        'contracts',
        'normalization',
        'relative-value',
        'ledger',
        'validation',
        'decision'
      ];
      if (validPages.includes(hash as NavigationPage)) {
        setActivePage(hash as NavigationPage);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: NavigationPage) => {
    setActivePage(page);
    window.location.hash = `/${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  // Market Data Reactive State & Subscription
  const [dataVersion, setDataVersion] = useState(0);
  const [dataMode, setDataMode] = useState<DataMode>(() => marketDataService.getActiveDataMode());

  const handleSelectDataMode = (mode: DataMode) => {
    marketDataService.setActiveDataMode(mode);
    setDataMode(mode);
  };

  useEffect(() => {
    const unsubscribe = marketDataService.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  const rawObservations = useMemo<MarketObservation[]>(() => {
    return marketDataService.getHistoricalData({ dataMode });
  }, [dataVersion, dataMode]);

  const normalizedObservations = useMemo<NormalizedObservation[]>(() => {
    return marketDataService.getNormalizedHistoricalData({ dataMode });
  }, [dataVersion, dataMode]);

  const availableDates = useMemo(() => {
    return marketDataService.getAvailableDates(dataMode);
  }, [dataVersion, dataMode, rawObservations]);

  const latestAvailableDate = availableDates[availableDates.length - 1] || '2026-10-08';

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return availableDates.slice(-1)[0] || '2026-10-08';
  });

  // Ensure selectedDate updates if active dataset changes and does not contain it
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // As-Of observations strictly quarantined through selectedDate to prevent look-ahead bias
  const asOfNormalizedObservations = useMemo(() => {
    return normalizedObservations.filter(o => o.date <= selectedDate);
  }, [normalizedObservations, selectedDate]);

  const asOfLatestObservations = useMemo(() => {
    return marketDataService.getLatestObservations(selectedDate, dataMode);
  }, [dataVersion, selectedDate, dataMode]);

  const provenance = marketDataService.getProvenance();
  const datasetMetadata = marketDataService.getMetadata();

  // Judge Demo Mode state (11-step walkthrough)
  const [isJudgeDemoActive, setIsJudgeDemoActive] = useState(false);
  const [judgeStepIndex, setJudgeStepIndex] = useState(0);

  const applyJudgeStep = (index: number) => {
    const step = JUDGE_STEPS[index];
    if (!step) return;
    setActivePage(step.targetPage as NavigationPage);
    window.location.hash = `/${step.targetPage}`;
    if (step.focusContract) {
      setSelectedContract(step.focusContract);
    }
    if (step.focusPair) {
      setSelectedPair(step.focusPair);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleJudgeDemo = () => {
    if (isJudgeDemoActive) {
      setIsJudgeDemoActive(false);
    } else {
      setIsJudgeDemoActive(true);
      setJudgeStepIndex(0);
      applyJudgeStep(0);
    }
  };

  const handleNextJudgeStep = () => {
    if (judgeStepIndex < JUDGE_STEPS.length - 1) {
      const next = judgeStepIndex + 1;
      setJudgeStepIndex(next);
      applyJudgeStep(next);
    } else {
      setIsJudgeDemoActive(false);
    }
  };

  const handlePrevJudgeStep = () => {
    if (judgeStepIndex > 0) {
      const prev = judgeStepIndex - 1;
      setJudgeStepIndex(prev);
      applyJudgeStep(prev);
    }
  };

  const handleJumpToJudgeStep = (index: number) => {
    setJudgeStepIndex(index);
    applyJudgeStep(index);
  };

  // Pair & Contract Selection (Default: GOLDM & GOLDTEN)
  const [selectedPair, setSelectedPair] = useState<[ContractSymbol, ContractSymbol]>(['GOLDM', 'GOLDTEN']);
  const [selectedContract, setSelectedContract] = useState<ContractSymbol>('GOLDM');

  // Configurable Friction Parameters
  const [friction, setFriction] = useState<FrictionAssumptions>({
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  });

  // Manual Expected Edge override (optional demonstration input)
  const [manualEdge, setManualEdge] = useState<number | undefined>(undefined);

  // Data Quality & Health Audit
  const dataQualityReport = useMemo(() => {
    return validateMarketData(rawObservations);
  }, [rawObservations]);

  const dataHealthSummary = useMemo(() => {
    return marketDataService.getDataHealthSummary(dataMode);
  }, [dataVersion, rawObservations, dataMode]);

  // Centralized Data-Sufficiency Assessment across engines
  const dataSufficiency = useMemo(() => {
    return marketDataService.getDataSufficiency({
      pair: selectedPair,
      asOfDate: selectedDate,
      dataMode
    });
  }, [selectedPair, selectedDate, dataMode, dataVersion]);

  // Active Pair Aligned Series evaluated As-Of selectedDate (zero look-ahead leakage)
  const seriesA = useMemo(() => {
    return asOfNormalizedObservations.filter(o => o.symbol === selectedPair[0]);
  }, [asOfNormalizedObservations, selectedPair]);

  const seriesB = useMemo(() => {
    return asOfNormalizedObservations.filter(o => o.symbol === selectedPair[1]);
  }, [asOfNormalizedObservations, selectedPair]);

  const pairSpreadSeries = useMemo(() => {
    return buildPairSpreadSeries(seriesA, seriesB, selectedPair[0], selectedPair[1]);
  }, [seriesA, seriesB, selectedPair]);

  // Current Spread observed As-Of selectedDate
  const latestPairSpread = useMemo(() => {
    if (pairSpreadSeries.length === 0) return 0;
    return pairSpreadSeries[pairSpreadSeries.length - 1].spread;
  }, [pairSpreadSeries]);

  // Statistical dispersion with strict provenance isolation
  const zScoreAnalysis = useMemo(() => {
    return calculateZScore(pairSpreadSeries, 20);
  }, [pairSpreadSeries]);

  // Evaluate Decision Engine dynamically with strictly As-Of inputs & data sufficiency gates
  const decisionResult = useMemo(() => {
    const latestA = asOfLatestObservations[selectedPair[0]];
    const latestB = asOfLatestObservations[selectedPair[1]];

    return evaluateDecision({
      pair: selectedPair,
      observedSpread: latestPairSpread,
      manualExpectedEdge: manualEdge,
      volA: latestA?.volume || 0,
      oiA: latestA?.openInterest || 0,
      volB: latestB?.volume || 0,
      oiB: latestB?.openInterest || 0,
      friction,
      dataSufficiency,
      isCalculable: zScoreAnalysis.isCalculable,
      incalculableReason: zScoreAnalysis.incalculableReason
    });
  }, [
    selectedPair,
    latestPairSpread,
    manualEdge,
    asOfLatestObservations,
    friction,
    dataSufficiency,
    zScoreAnalysis.isCalculable,
    zScoreAnalysis.incalculableReason
  ]);

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-800 overflow-x-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Header with Mobile Hamburger, Data Mode Selector & As-Of Date Selector */}
        <Header
          currentDate={selectedDate}
          selectedPair={selectedPair}
          decision={decisionResult}
          metadata={datasetMetadata}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          availableDates={availableDates}
          onSelectDate={setSelectedDate}
          latestAvailableDate={latestAvailableDate}
          dataMode={dataMode}
          onSelectDataMode={handleSelectDataMode}
        />

        {/* Interactive Judge Demo Stepper Bar */}
        {isJudgeDemoActive && (
          <JudgeTourStepper
            currentStepIndex={judgeStepIndex}
            totalSteps={JUDGE_STEPS.length}
            onNext={handleNextJudgeStep}
            onPrev={handlePrevJudgeStep}
            onClose={() => setIsJudgeDemoActive(false)}
            onJumpToStep={handleJumpToJudgeStep}
            currentStep={JUDGE_STEPS[judgeStepIndex]}
          />
        )}

        {/* Persistent Provenance & Quality Banner */}
        <PrototypeBanner
          provenance={provenance}
          filename={datasetMetadata.filename}
          dataQualityStatus={dataQualityReport.status}
          onNavigateToDataLab={() => handleNavigate('data-lab')}
        />

        {/* Dynamic Route Screen */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {activePage === 'overview' && (
            <Overview
              latestData={asOfLatestObservations}
              selectedPair={selectedPair}
              onPairChange={setSelectedPair}
              selectedContract={selectedContract}
              onSelectContract={setSelectedContract}
              decisionResult={decisionResult}
              dataHealth={dataHealthSummary}
              onNavigate={handleNavigate}
              onStartJudgeDemo={handleToggleJudgeDemo}
            />
          )}

          {activePage === 'data-lab' && (
            <DataLab
              metadata={datasetMetadata}
              provenance={provenance}
              dataMode={dataMode}
              onSelectDataMode={handleSelectDataMode}
              onDatasetChanged={() => setDataVersion(v => v + 1)}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'contracts' && (
            <Contracts
              observations={asOfNormalizedObservations}
              selectedSymbol={selectedContract}
              onSelectContract={setSelectedContract}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'normalization' && (
            <Normalization
              observations={asOfNormalizedObservations}
              selectedContract={selectedContract}
              onSelectContract={setSelectedContract}
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'relative-value' && (
            <RelativeValue
              observations={asOfNormalizedObservations}
              selectedPair={selectedPair}
              onPairChange={setSelectedPair}
              selectedDate={selectedDate}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'ledger' && (
            <Ledger
              latestData={asOfLatestObservations}
              allObservations={asOfNormalizedObservations}
              selectedPair={selectedPair}
              onPairChange={setSelectedPair}
              friction={friction}
              manualEdge={manualEdge}
              provenance={provenance}
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              spreadSeries={pairSpreadSeries}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'validation' && (
            <Validation
              observations={asOfNormalizedObservations}
              selectedPair={selectedPair}
              friction={friction}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'decision' && (
            <Decision
              decisionResult={decisionResult}
              selectedPair={selectedPair}
              onPairChange={setSelectedPair}
              friction={friction}
              onFrictionChange={setFriction}
              manualEdge={manualEdge}
              onManualEdgeChange={setManualEdge}
              calculatedSpread={latestPairSpread}
              latestData={asOfLatestObservations}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
