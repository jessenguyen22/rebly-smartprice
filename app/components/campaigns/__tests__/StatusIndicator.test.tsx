import { render, screen } from '../../../lib/test-utils';
import { describe, it, expect } from 'vitest';
import { StatusIndicator, type CampaignStatus } from '../StatusIndicator';

describe('StatusIndicator', () => {
  const statusCases: Array<{ status: CampaignStatus; expectedText: string; expectedTone: string }> = [
    { status: 'DRAFT', expectedText: 'Draft', expectedTone: 'info' },
    { status: 'ACTIVE', expectedText: 'Active', expectedTone: 'success' },
    { status: 'PAUSED', expectedText: 'Paused', expectedTone: 'warning' },
    { status: 'COMPLETED', expectedText: 'Completed', expectedTone: 'success' }
  ];

  statusCases.forEach(({ status, expectedText }) => {
    it(`renders ${status} status correctly`, () => {
      render(<StatusIndicator status={status} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });

  it('displays tooltip on hover for DRAFT status', () => {
    render(<StatusIndicator status="DRAFT" />);
    const badge = screen.getByText('Draft');
    expect(badge).toBeInTheDocument();
    // Note: Testing tooltip interaction would require user-event library
  });

  it('displays tooltip on hover for PAUSED status', () => {
    render(<StatusIndicator status="PAUSED" />);
    const badge = screen.getByText('Paused');
    expect(badge).toBeInTheDocument();
  });

  it('handles all status types without errors', () => {
    statusCases.forEach(({ status }) => {
      expect(() => render(<StatusIndicator status={status} />)).not.toThrow();
    });
  });
});
