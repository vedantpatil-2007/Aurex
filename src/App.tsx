import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, NavigationPage } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PrototypeBanner } from './components/layout/PrototypeBanner';
import { JudgeTourStepper, JUDGE_STEPS } from './components/guide/JudgeTourStepper';
import { marketDataService } from './services/marketDataService';
import { validateMarketData } from './utils/dataQuality';
import { buildPairSpreadSeries } from './engines/relativeValueEngine';
import { evaluateDecision } from './engines/decisionEngine';
import { 
  ContractSymbol, 
  FrictionAssumptions, 
  NormalizedObservation,
  MarketObservation 
} from './types/market';

// Pages
import { Overview } from './pages/Overview';
import { Contracts } from './pages/Contracts';
import { Normalization } from './pages/Normalization';
import { RelativeValue } from './pages/RelativeValue';
import { Validation } from './pages/Validation';
import { Decision } from './pages/Decision';

export function App() {
  // Navigation State with hash sync
  const [activePage, setActivePage] = useState<NavigationPage>(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (['overview', 'contracts', 'normalization', 'relative-value', 'validation', 'decision'].includes(hash)) {
      return hash as NavigationPage;
    }
    return 'overview';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (['overview', 'contracts', 'normalization', 'relative-value', 'validation', 'decision'].includes(hash)) {
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
  };

  // Phase 2H: Judge Demo Mode state
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

  // Market Data Ingestion
  const [rawObservations] = useState<MarketObservation[]>(() => {
    return marketDataService.getHistoricalData();
  });

  const normalizedObservations = useMemo<NormalizedObservation[]>(() => {
    return marketDataService.getNormalizedHistoricalData();
  }, []);

  const latestObservations = useMemo(() => {
    return marketDataService.getLatestObservations();
  }, []);

  const availableDates = useMemo(() => {
    return marketDataService.getAvailableDates();
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return availableDates.slice(-1)[0] || '2026-10-08';
  });

  // Pair & Contract Selection (Default: GOLDM & GOLDTEN)
  const [selectedPair, setSelectedPair] = useState<[ContractSymbol, ContractSymbol]>(['GOLDM', 'GOLDTEN']);
  const [selectedContract, setSelectedContract] = useState<ContractSymbol>('GOLDM');

  // Configurable Friction Parameters (Phase 2 includes liquidityHaircutPer10g)
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
    return marketDataService.getDataHealthSummary();
  }, []);

  // Active Pair Aligned Series
  const seriesA = useMemo(() => {
    return normalizedObservations.filter(o => o.symbol === selectedPair[0]);
  }, [normalizedObservations, selectedPair]);

  const seriesB = useMemo(() => {
    return normalizedObservations.filter(o => o.symbol === selectedPair[1]);
  }, [normalizedObservations, selectedPair]);

  const pairSpreadSeries = useMemo(() => {
    return buildPairSpreadSeries(seriesA, seriesB, selectedPair[0], selectedPair[1]);
  }, [seriesA, seriesB, selectedPair]);

  // Current Spread observed
  const latestPairSpread = useMemo(() => {
    if (pairSpreadSeries.length === 0) return 0;
    return pairSpreadSeries[pairSpreadSeries.length - 1].spread;
  }, [pairSpreadSeries]);

  // Evaluate Decision Engine dynamically
  const decisionResult = useMemo(() => {
    const latestA = latestObservations[selectedPair[0]];
    const latestB = latestObservations[selectedPair[1]];

    return evaluateDecision({
      pair: selectedPair,
      observedSpread: latestPairSpread,
      manualExpectedEdge: manualEdge,
      volA: latestA?.volume || 0,
      oiA: latestA?.openInterest || 0,
      volB: latestB?.volume || 0,
      oiB: latestB?.openInterest || 0,
      friction
    });
  }, [selectedPair, latestPairSpread, manualEdge, latestObservations, friction]);

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with JUDGE DEMO button */}
        <Header 
          currentDate={selectedDate} 
          selectedPair={selectedPair} 
          isJudgeDemoActive={isJudgeDemoActive}
          onToggleJudgeDemo={handleToggleJudgeDemo}
        />

        {/* Phase 2H: Interactive Judge Demo Stepper Bar */}
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

        {/* Persistent Simulation & Quality Banner */}
        <PrototypeBanner dataQualityStatus={dataQualityReport.status} />

        {/* Dynamic Route Screen */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'overview' && (
            <Overview
              latestData={latestObservations}
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

          {activePage === 'contracts' && (
            <Contracts
              observations={normalizedObservations}
              selectedSymbol={selectedContract}
              onSelectContract={setSelectedContract}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'normalization' && (
            <Normalization
              observations={normalizedObservations}
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
              observations={normalizedObservations}
              selectedPair={selectedPair}
              onPairChange={setSelectedPair}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'validation' && (
            <Validation
              observations={normalizedObservations}
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
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
