import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  emptyState?: React.ReactNode;
  itemLabel?: string;
  filterSlot?: React.ReactNode;
}

export interface ColumnClassification {
  isDescriptive: boolean;
  isAction: boolean;
  minWidth: string;
  maxWidth?: string;
  whiteSpace: 'nowrap' | 'normal';
}

export function classifyColumn(header: string): ColumnClassification {
  const h = (header || '').toLowerCase().trim();

  // 1. Action Controls / Buttons: Always single line, never wrap, never stack
  if (h.includes('action') || h.includes('manage')) {
    return {
      isDescriptive: false,
      isAction: true,
      minWidth: '200px',
      whiteSpace: 'nowrap',
    };
  }

  // 2. Descriptive text: Descriptions, Remarks, Addresses, Notes, Specs, Scope
  // Must wrap naturally word-by-word at normal spaces (NEVER split middle of word)
  // Give descriptive columns a sensible width/max-width (approx 220px to 380px)
  if (
    h.includes('description') ||
    h === 'desc' ||
    h.includes('remark') ||
    h.includes('address') ||
    h === 'site' ||
    h.includes('site address') ||
    h.includes('specs') ||
    h.includes('specification') ||
    h.includes('notes') ||
    h.includes('comment') ||
    h.includes('reason') ||
    h.includes('summary') ||
    h.includes('scope') ||
    h.includes('details')
  ) {
    return {
      isDescriptive: true,
      isAction: false,
      minWidth: '220px',
      maxWidth: '380px',
      whiteSpace: 'normal',
    };
  }

  // 3. Structured Values that must NEVER wrap (Single-line only):
  // Customer/Person Name, Email, Phone, Mobile, IDs (Customer, Product, Project, Quotation, Invoice, Ref, Serial),
  // Dates, Time, Currency, Price, Quantity, Percentage, Numerical values, Status badges, Short codes
  let minW = '110px';
  if (h.includes('customer') || h.includes('name') || h.includes('holder') || h.includes('client')) {
    minW = '180px'; // Name column gets enough width to keep 'Ramesh Kumar' on one line
  } else if (h.includes('email')) {
    minW = '200px'; // Email stays on one line without wrapping
  } else if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) {
    minW = '140px'; // Phone numbers (+91 9876543210)
  } else if (h.includes('invoice') || h.includes('quotation') || h.includes('project') || h.includes('ref') || h.includes('transaction')) {
    minW = '150px'; // Quotation No., Project No., Invoice No. (QT-2026-00125, PRJ-2026-1045)
  } else if (h.includes('amount') || h.includes('paid') || h.includes('balance') || h.includes('total') || h.includes('price') || h.includes('rate') || h.includes('cost')) {
    minW = '130px'; // Currency values (₹1,25,000.00)
  } else if (h.includes('date') || h.includes('added') || h.includes('time') || h.includes('due') || h.includes('issue')) {
    minW = '125px'; // Dates
  } else if (h.includes('status') || h.includes('stage')) {
    minW = '120px'; // Status badges
  } else if (h.includes('method') || h.includes('category') || h.includes('type') || h.includes('source') || h.includes('brand')) {
    minW = '130px';
  } else if (h.includes('capacity') || h.includes('kw') || h.includes('tax') || h.includes('discount')) {
    minW = '110px';
  } else if (h === 'id' || h === 'unit' || h.includes('qty')) {
    minW = '80px';
  }

  return {
    isDescriptive: false,
    isAction: false,
    minWidth: minW,
    whiteSpace: 'nowrap',
  };
}

export function DataTable<T>({ 
  columns, 
  data, 
  keyExtractor, 
  onRowClick,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  emptyState,
  itemLabel,
  filterSlot
}: DataTableProps<T>) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '14px', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
      {(onSearchChange || searchPlaceholder || filterSlot) && (
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-color-subtle)', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '260px', maxWidth: '340px', flex: '1 1 auto' }}>
            <span style={{ position: 'absolute', left: '0.75rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input 
              type="text"
              placeholder={searchPlaceholder || 'Search...'} 
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 1rem 0.45rem 2.25rem',
                borderRadius: '8px',
                border: '1px solid #d4e5f5',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>
          {filterSlot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {filterSlot}
            </div>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f4f9fd', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              {columns.map((col, idx) => {
                const config = classifyColumn(col.header);
                const isFirstCol = idx === 0;
                const isLastCol = idx === columns.length - 1;
                const effectiveMinWidth = col.width 
                  ? (config.isAction ? `${Math.max(parseInt(col.width, 10) || 0, 220)}px` : col.width)
                  : config.minWidth;
                const assignedWidth = col.width 
                  ? (config.isAction ? `${Math.max(parseInt(col.width, 10) || 0, 220)}px` : col.width)
                  : (config.isDescriptive ? config.minWidth : undefined);
                const maxWidth = config.maxWidth;
                return (
                  <th key={idx} style={{ 
                    paddingTop: '0.85rem',
                    paddingBottom: '0.85rem',
                    paddingLeft: isFirstCol ? '1.25rem' : '1rem',
                    paddingRight: isLastCol ? '1.25rem' : '1rem', // Symmetric 20px gap on both left and right table edges
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#55728f', 
                    fontSize: '0.75rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    width: assignedWidth,
                    minWidth: effectiveMinWidth,
                    maxWidth: maxWidth,
                    whiteSpace: 'nowrap',
                    wordBreak: 'normal',
                    overflowWrap: 'normal',
                    verticalAlign: 'middle',
                    boxSizing: 'border-box'
                  }}>
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && emptyState ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  {emptyState}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr 
                  key={keyExtractor(row)} 
                  onClick={() => onRowClick?.(row)}
                  style={{ 
                    borderBottom: '1px solid var(--border-color-subtle)', 
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((col, idx) => {
                    const config = classifyColumn(col.header);
                    const isFirstCol = idx === 0;
                    const isLastCol = idx === columns.length - 1;
                    const content = typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as React.ReactNode);

                    // Content-level safeguard for structured values:
                    // Numbers, Currency (₹, $), Phone, Email should never wrap even if rendered dynamically
                    const isContentStructured = (
                      typeof content === 'number' ||
                      (typeof content === 'string' && (
                        content.includes('₹') || 
                        content.includes('$') || 
                        content.includes('@') || 
                        /^\+?[0-9,\.\s\-\/]+$/.test(content.trim())
                      ))
                    );

                    const cellWhiteSpace = (config.isDescriptive && !isContentStructured) ? 'normal' : 'nowrap';
                    const cellMinWidth = col.width 
                      ? (config.isAction ? `${Math.max(parseInt(col.width, 10) || 0, 220)}px` : col.width)
                      : config.minWidth;
                    const cellMaxWidth = config.maxWidth;

                    return (
                      <td key={idx} style={{ 
                        paddingTop: '0.9rem',
                        paddingBottom: '0.9rem',
                        paddingLeft: isFirstCol ? '1.25rem' : '1rem',
                        paddingRight: isLastCol ? '1.75rem' : '1rem', // Extra 12px gap on the right table edge
                        fontSize: '0.875rem',
                        width: col.width || (config.isDescriptive ? config.minWidth : undefined),
                        minWidth: cellMinWidth,
                        maxWidth: cellMaxWidth,
                        whiteSpace: cellWhiteSpace,
                        wordBreak: 'normal',
                        overflowWrap: 'normal',
                        verticalAlign: 'middle',
                        lineHeight: cellWhiteSpace === 'normal' ? 1.45 : undefined,
                        textAlign: 'left',
                        boxSizing: 'border-box'
                      }}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination matching reference image footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.85rem 1.25rem', 
        borderTop: '1px solid var(--border-color-subtle)',
        backgroundColor: '#ffffff',
        fontSize: '0.825rem',
        color: '#55728f'
      }}>
        <div>
          Showing {data.length} of {data.length} {itemLabel || 'records'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '6px', 
            border: '1px solid #d4e5f5', 
            background: '#ffffff', 
            color: '#55728f', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            ‹
          </button>
          <button style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '6px', 
            border: 'none', 
            background: '#1b5e20', 
            color: '#ffffff', 
            fontWeight: 700,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            1
          </button>
          <button style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '6px', 
            border: '1px solid #d4e5f5', 
            background: '#ffffff', 
            color: '#55728f', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
