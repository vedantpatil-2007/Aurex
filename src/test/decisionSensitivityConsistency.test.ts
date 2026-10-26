import { describe, it, expect } from 'vitest';
import { evaluateDecision } from '../engines/decisionEngine';
import { calculateTotalFriction } from '../engines/liquidityCostEngine';
import { 
  SENSITIVITY_ANALYSIS_NOTE, 
  getCostTestStatus 
} from '../components/decision/StressLabSensitivityGrid';
import { FrictionAssumptions, SensitivityScenario } from '../types/market';

describe('Decision Engine — Sensitivity Analysis Status Consistency & Provenance Safety', () => {
  const baseFriction: FrictionAssumptions = {
    slippagePer10g: 25,
    brokerageTaxesPer10g: 35,
    liquidityHaircutPer10g: 15,
    costBufferPer10g: 20,
    liquidityThresholdScore: 50
  };

  // --------------------------------------------------------------------------
  // 1. Status Labeling as Cost-Only Results
  // --------------------------------------------------------------------------
  describe('1. Cost-Only Result Labeling', () => {
    it('labels sensitivity result as "COST TEST PASSES" when modeled net edge is strictly positive', () => {
      expect(getCostTestStatus(55)).toBe('COST TEST PASSES');
      expect(getCostTestStatus(0.01)).toBe('COST TEST PASSES');
      expect(getCostTestStatus(120.50)).toBe('COST TEST PASSES');
    });

    it('labels sensitivity result as "COST TEST FAILS" when modeled net edge is zero or negative', () => {
      expect(getCostTestStatus(0)).toBe('COST TEST FAILS');
      expect(getCostTestStatus(-0.01)).toBe('COST TEST FAILS');
      expect(getCostTestStatus(-65.00)).toBe('COST TEST FAILS');
    });

    it('provides exact verbatim explanatory note on cost evaluation vs provenance verification', () => {
      expect(SENSITIVITY_ANALYSIS_NOTE).toBe(
        'Sensitivity analysis evaluates estimated transaction costs only. The final decision may remain WATCH because data provenance and live broker-feed verification are separate requirements.'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. Preservation of Main WATCH Verdict for Unverified Imported Data
  // --------------------------------------------------------------------------
  describe('2. Main Verdict Safety Gate Preservation', () => {
    it('strictly preserves main WATCH verdict for market-derived unverified imported observations', () => {
      const decisionResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 180,
        volA: 26000,
        oiA: 50700,
        volB: 11500,
        oiB: 27900,
        friction: baseFriction,
        isCalculable: true,
        hasSpreadData: true,
        isUnverifiedSource: true // Imported unverified Bhavcopy provenance
      });

      // Expected edge ₹180, Total friction ₹95 -> Net edge +₹85/10g
      expect(decisionResult.expectedEdge).toBe(180);
      expect(decisionResult.totalFriction).toBe(95);
      expect(decisionResult.netEdge).toBe(85);
      expect(decisionResult.liquidityGrade).toBe('PASS');

      // Crucial Gate: Verdict MUST NOT be ACTIONABLE; it must be WATCH due to unverified provenance
      expect(decisionResult.decision).toBe('WATCH');
      expect(decisionResult.rationale).toContain('USER-IMPORTED DATA — SOURCE UNVERIFIED');
      expect(decisionResult.rationale).toContain('Pre-trade caution enforced: live market execution requires authenticated broker order-book depth');
      expect(decisionResult.triggerRules.some(r => r.includes('Source Integrity Gate'))).toBe(true);
      expect(decisionResult.triggerRules.some(r => r.includes('Pre-Trade Caution Rule'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Sensitivity Regimes Alignment Without Misleading ACTIONABLE Badges
  // --------------------------------------------------------------------------
  describe('3. Sensitivity Analysis Regimes Alignment', () => {
    it('evaluates sensitivity scenarios as cost tests without contradicting the main WATCH verdict', () => {
      // Stressed / Lower / Base Friction scenarios
      const observedSpread = 180;
      const volA = 26000;
      const oiA = 50700;
      const volB = 11500;
      const oiB = 27900;

      // 1. Lower Friction
      const lowerFriction: FrictionAssumptions = {
        slippagePer10g: Math.max(5, Math.round(baseFriction.slippagePer10g * 0.6)), // 15
        brokerageTaxesPer10g: Math.max(15, Math.round(baseFriction.brokerageTaxesPer10g * 0.7)), // 25
        liquidityHaircutPer10g: Math.max(5, Math.round(baseFriction.liquidityHaircutPer10g * 0.5)), // 8
        costBufferPer10g: Math.max(5, Math.round(baseFriction.costBufferPer10g * 0.5)), // 10
        liquidityThresholdScore: Math.max(25, baseFriction.liquidityThresholdScore - 15) // 35
      };
      const lowerResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread,
        volA, oiA, volB, oiB,
        friction: lowerFriction
      });

      // 2. Base Case
      const baseResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread,
        volA, oiA, volB, oiB,
        friction: baseFriction
      });

      // 3. Higher Friction (Stressed)
      const higherFriction: FrictionAssumptions = {
        slippagePer10g: Math.round(baseFriction.slippagePer10g * 1.6), // 40
        brokerageTaxesPer10g: Math.round(baseFriction.brokerageTaxesPer10g * 1.3), // 46
        liquidityHaircutPer10g: Math.round(baseFriction.liquidityHaircutPer10g * 1.8), // 27
        costBufferPer10g: Math.round(baseFriction.costBufferPer10g * 1.6), // 32
        liquidityThresholdScore: Math.min(85, baseFriction.liquidityThresholdScore + 15) // 65
      };
      const higherResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread,
        volA, oiA, volB, oiB,
        friction: higherFriction
      });

      const scenarios: SensitivityScenario[] = [
        {
          id: 'lower',
          name: 'LOWER FRICTION',
          description: 'Optimistic execution: tight crossing spread, low impact.',
          assumptions: lowerFriction,
          decisionResult: lowerResult,
          survivesEdge: lowerResult.netEdge > 0,
          costTestStatus: getCostTestStatus(lowerResult.netEdge)
        },
        {
          id: 'base',
          name: 'BASE CASE',
          description: 'Standard retail/HNI execution with conservative buffer.',
          assumptions: baseFriction,
          decisionResult: baseResult,
          survivesEdge: baseResult.netEdge > 0,
          costTestStatus: getCostTestStatus(baseResult.netEdge)
        },
        {
          id: 'higher',
          name: 'HIGHER FRICTION',
          description: 'Stressed conditions: wider spreads, severe market impact.',
          assumptions: higherFriction,
          decisionResult: higherResult,
          survivesEdge: higherResult.netEdge > 0,
          costTestStatus: getCostTestStatus(higherResult.netEdge)
        }
      ];

      // Lower friction survives cost test with positive net edge
      expect(scenarios[0].decisionResult.netEdge).toBeGreaterThan(0);
      expect(scenarios[0].costTestStatus).toBe('COST TEST PASSES');

      // Base case survives cost test with positive net edge
      expect(scenarios[1].decisionResult.netEdge).toBeGreaterThan(0);
      expect(scenarios[1].costTestStatus).toBe('COST TEST PASSES');

      // Higher friction total hurdle is 40 + 46 + 27 + 32 = 145. 180 - 145 = +35
      expect(scenarios[2].decisionResult.netEdge).toBe(35);
      expect(scenarios[2].costTestStatus).toBe('COST TEST PASSES');

      // Under severe hurdle where costs exceed expected edge (e.g. edge = 100 <= 145):
      const severeFailsResult = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 100,
        volA, oiA, volB, oiB,
        friction: higherFriction
      });
      expect(severeFailsResult.netEdge).toBeLessThan(0);
      expect(getCostTestStatus(severeFailsResult.netEdge)).toBe('COST TEST FAILS');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Invariance of Existing Friction Math & Presets
  // --------------------------------------------------------------------------
  describe('4. Friction Calculations & Decision Rules Invariance', () => {
    it('preserves base friction total hurdle calculation exactly', () => {
      const totalCost = calculateTotalFriction(baseFriction);
      expect(totalCost).toBe(95); // 25 + 35 + 15 + 20
    });

    it('preserves Preset 1 (Actionable) in sandbox mode', () => {
      const p1 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 175,
        manualExpectedEdge: 175,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: {
          slippagePer10g: 20,
          brokerageTaxesPer10g: 30,
          liquidityHaircutPer10g: 10,
          costBufferPer10g: 15,
          liquidityThresholdScore: 45
        }
      });
      expect(p1.decision).toBe('ACTIONABLE');
      expect(p1.netEdge).toBe(100);
      expect(p1.liquidityGrade).toBe('PASS');
    });

    it('preserves Preset 2 (Watch) in sandbox mode', () => {
      const p2 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 135,
        manualExpectedEdge: 135,
        simulatedLiquidityScore: 35,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: {
          slippagePer10g: 22,
          brokerageTaxesPer10g: 30,
          liquidityHaircutPer10g: 15,
          costBufferPer10g: 15,
          liquidityThresholdScore: 40
        }
      });
      expect(p2.decision).toBe('WATCH');
      expect(p2.netEdge).toBe(53);
      expect(p2.liquidityGrade).toBe('BORDERLINE');
    });

    it('preserves Preset 3 (No Trade) in sandbox mode', () => {
      const p3 = evaluateDecision({
        pair: ['GOLDM', 'GOLDTEN'],
        observedSpread: 50,
        manualExpectedEdge: 50,
        volA: 26000, oiA: 50700, volB: 11500, oiB: 27900,
        friction: {
          slippagePer10g: 35,
          brokerageTaxesPer10g: 35,
          liquidityHaircutPer10g: 20,
          costBufferPer10g: 25,
          liquidityThresholdScore: 50
        }
      });
      expect(p3.decision).toBe('NO TRADE');
      expect(p3.netEdge).toBe(-65);
    });
  });
});
