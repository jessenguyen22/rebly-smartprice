import React from 'react';
import { Badge, Tooltip } from '@shopify/polaris';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

interface StatusIndicatorProps {
  status: CampaignStatus;
  showTooltip?: boolean;
}

const statusConfig: Record<CampaignStatus, {
  tone: 'info' | 'success' | 'attention' | 'warning';
  label: string;
  description: string;
}> = {
  DRAFT: {
    tone: 'info',
    label: 'Draft',
    description: 'Campaign is in draft mode and not yet active'
  },
  ACTIVE: {
    tone: 'success',
    label: 'Active',
    description: 'Campaign is running and processing webhooks'
  },
  PAUSED: {
    tone: 'warning',
    label: 'Paused',
    description: 'Campaign is temporarily paused'
  },
  COMPLETED: {
    tone: 'success',
    label: 'Completed',
    description: 'Campaign has finished execution'
  },
  ARCHIVED: {
    tone: 'attention',
    label: 'Archived',
    description: 'Campaign has been deleted/archived'
  }
};

export function StatusIndicator({ 
  status, 
  showTooltip = true 
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  
  const badgeElement = (
    <Badge tone={config.tone}>
      {config.label}
    </Badge>
  );

  if (showTooltip) {
    return (
      <Tooltip content={config.description}>
        {badgeElement}
      </Tooltip>
    );
  }

  return badgeElement;
}

// Export status configuration for use in other components
export { statusConfig };
