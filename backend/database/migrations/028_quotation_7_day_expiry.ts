import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration028: Migration = {
  version: 28,
  name: '028_quotation_7_day_expiry',

  up(db: Database.Database): void {
    // 1. Set validity_days to 7 where not set or non-positive
    db.prepare(`
      UPDATE quotations
      SET validity_days = 7
      WHERE validity_days IS NULL OR validity_days <= 0;
    `).run();

    // 2. Clear valid_until for draft quotations without issue_date
    db.prepare(`
      UPDATE quotations
      SET valid_until = NULL
      WHERE issue_date IS NULL AND status = 'Draft';
    `).run();

    // 3. Compute valid_until only for quotations that have an issue_date
    db.prepare(`
      UPDATE quotations
      SET valid_until = date(issue_date, '+' || COALESCE(validity_days, 7) || ' days')
      WHERE issue_date IS NOT NULL AND valid_until IS NULL;
    `).run();

    // 4. Mark issued quotations as Expired only if their valid_until has passed
    db.prepare(`
      UPDATE quotations
      SET status = 'Expired',
          updated_at = datetime('now')
      WHERE status = 'Issued'
        AND issue_date IS NOT NULL
        AND valid_until IS NOT NULL
        AND date(valid_until) < date('now', 'localtime');
    `).run();
  },
};
