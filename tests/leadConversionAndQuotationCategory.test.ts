import { describe, it, expect } from 'vitest';
import { migration038 } from '../backend/database/migrations/038_customer_business_category';

describe('Lead Conversion and Customer Business Category Integration', () => {
  it('adds business_category column to customers if missing and executes backfill', () => {
    let alterExecuted = false;
    let backfillExecuted = false;

    const mockDb: any = {
      prepare: (sql: string) => ({
        all: () => {
          if (sql.includes('PRAGMA table_info(customers)')) {
            return [{ name: 'id' }, { name: 'name' }, { name: 'phone' }];
          }
          return [];
        }
      }),
      exec: (sql: string) => {
        if (sql.includes('ALTER TABLE customers ADD COLUMN business_category TEXT')) {
          alterExecuted = true;
        }
        if (sql.includes('UPDATE customers') && sql.includes('SET business_category =')) {
          backfillExecuted = true;
        }
      }
    };

    migration038.up(mockDb);

    expect(alterExecuted).toBe(true);
    expect(backfillExecuted).toBe(true);
  });

  it('correctly maps customer business category to quotation selection logic', () => {
    const categories = [
      { id: 1, code: 'SOLAR_ROOFTOP', name: 'Solar Rooftop' },
      { id: 2, code: 'SOLAR_WATERPUMP', name: 'Solar Water Pump' },
      { id: 3, code: 'SOLAR_CCTV', name: 'Solar CCTV' },
    ];

    const customerWithStandardCat = {
      id: 10,
      name: 'Anand Kumar',
      business_category: 'SOLAR_WATERPUMP',
    };

    const customerWithCustomCat = {
      id: 11,
      name: 'Green Farms',
      business_category: 'SOLAR_DRYER_CUSTOM',
    };

    // Test selection resolution logic for standard category
    const resolveCategorySelection = (cust: { business_category?: string | null }) => {
      const cat = cust.business_category || undefined;
      const isStandard = cat ? categories.some(c => c.code === cat) : true;
      return {
        business_category: cat,
        isOtherCategory: !isStandard,
        customCategory: !isStandard && cat ? cat : '',
      };
    };

    const result1 = resolveCategorySelection(customerWithStandardCat);
    expect(result1.business_category).toBe('SOLAR_WATERPUMP');
    expect(result1.isOtherCategory).toBe(false);
    expect(result1.customCategory).toBe('');

    const result2 = resolveCategorySelection(customerWithCustomCat);
    expect(result2.business_category).toBe('SOLAR_DRYER_CUSTOM');
    expect(result2.isOtherCategory).toBe(true);
    expect(result2.customCategory).toBe('SOLAR_DRYER_CUSTOM');
  });

  it('detects isChanged when project stage or reject reason is updated', () => {
    const originalProject = {
      reference: 'PRJ-2026-0001',
      customer_id: 1,
      site_id: 2,
      quotation_ref: 'QT-001',
      target_date: '2026-10-20',
      stage: 'In Progress',
    };

    const computeIsChanged = (
      formData: typeof originalProject,
      rejectReason: string,
      initialRejectReason: string
    ) => {
      const hasStageChanged = (formData.stage || 'In Progress') !== (originalProject.stage || 'In Progress');
      const hasRejectReasonChanged =
        formData.stage === 'Reject' && rejectReason.trim() !== initialRejectReason.trim();

      return (
        (formData.reference || '') !== (originalProject.reference || '') ||
        Number(formData.customer_id ?? 0) !== Number(originalProject.customer_id ?? 0) ||
        Number(formData.site_id ?? 0) !== Number(originalProject.site_id ?? 0) ||
        (formData.quotation_ref || '') !== (originalProject.quotation_ref || '') ||
        (formData.target_date || '') !== (originalProject.target_date || '') ||
        hasStageChanged ||
        hasRejectReasonChanged
      );
    };

    // No changes
    expect(computeIsChanged({ ...originalProject }, '', '')).toBe(false);

    // Changing stage to Complete
    expect(computeIsChanged({ ...originalProject, stage: 'Complete' }, '', '')).toBe(true);

    // Changing stage to Pending
    expect(computeIsChanged({ ...originalProject, stage: 'Pending' }, '', '')).toBe(true);

    // Changing stage to Reject with reason
    expect(computeIsChanged({ ...originalProject, stage: 'Reject' }, 'Permit delayed', '')).toBe(true);
  });
});

