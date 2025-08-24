import React, { useState, useCallback } from 'react';
import {
  Card,
  TextField,
  Select,
  Button,
  InlineStack,
  BlockStack,
  ButtonGroup,
  Popover,
  ActionList,
  Badge,
  Text,
  Divider
} from '@shopify/polaris';
import { SearchIcon, FilterIcon, SortIcon } from '@shopify/polaris-icons';
import type { CampaignStatus } from './StatusIndicator';

export interface CampaignFilters {
  searchQuery: string;
  status: CampaignStatus[];
  dateRange: {
    from: string;
    to: string;
  } | null;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'triggerCount';
  sortOrder: 'asc' | 'desc';
}

interface SearchAndFilterProps {
  filters: CampaignFilters;
  onFiltersChange: (filters: CampaignFilters) => void;
  totalCount?: number;
  filteredCount?: number;
}

const statusOptions = [
  { label: 'Draft', value: 'DRAFT' as CampaignStatus },
  { label: 'Active', value: 'ACTIVE' as CampaignStatus },
  { label: 'Paused', value: 'PAUSED' as CampaignStatus },
  { label: 'Completed', value: 'COMPLETED' as CampaignStatus }
];

const sortOptions = [
  { label: 'Name (A-Z)', value: 'name-asc', sortBy: 'name' as const, order: 'asc' as const },
  { label: 'Name (Z-A)', value: 'name-desc', sortBy: 'name' as const, order: 'desc' as const },
  { label: 'Newest First', value: 'created-desc', sortBy: 'createdAt' as const, order: 'desc' as const },
  { label: 'Oldest First', value: 'created-asc', sortBy: 'createdAt' as const, order: 'asc' as const },
  { label: 'Recently Updated', value: 'updated-desc', sortBy: 'updatedAt' as const, order: 'desc' as const },
  { label: 'Most Triggered', value: 'triggers-desc', sortBy: 'triggerCount' as const, order: 'desc' as const },
  { label: 'Least Triggered', value: 'triggers-asc', sortBy: 'triggerCount' as const, order: 'asc' as const }
];

export function SearchAndFilter({
  filters,
  onFiltersChange,
  totalCount = 0,
  filteredCount = 0
}: SearchAndFilterProps) {
  const [filterPopoverActive, setFilterPopoverActive] = useState(false);
  const [sortPopoverActive, setSortPopoverActive] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    onFiltersChange({
      ...filters,
      searchQuery: value
    });
  }, [filters, onFiltersChange]);

  const handleStatusToggle = useCallback((status: CampaignStatus) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    
    onFiltersChange({
      ...filters,
      status: newStatus
    });
  }, [filters, onFiltersChange]);

  const handleSortChange = useCallback((sortBy: string, order: 'asc' | 'desc') => {
    onFiltersChange({
      ...filters,
      sortBy: sortBy as any,
      sortOrder: order
    });
    setSortPopoverActive(false);
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      searchQuery: '',
      status: [],
      dateRange: null,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
  }, [onFiltersChange]);

  const activeFiltersCount = filters.status.length + (filters.searchQuery ? 1 : 0);

  const currentSortOption = sortOptions.find(
    option => option.sortBy === filters.sortBy && option.order === filters.sortOrder
  );

  const filterActivator = (
    <Button
      onClick={() => setFilterPopoverActive(!filterPopoverActive)}
      icon={FilterIcon}
      disclosure={filterPopoverActive ? 'up' : 'down'}
    >
      {`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}`}
    </Button>
  );

  const sortActivator = (
    <Button
      onClick={() => setSortPopoverActive(!sortPopoverActive)}
      icon={SortIcon}
      disclosure={sortPopoverActive ? 'up' : 'down'}
    >
      {currentSortOption?.label || 'Sort'}
    </Button>
  );

  return (
    <Card>
      <BlockStack gap="400">
        {/* Search and action bar */}
        <InlineStack gap="300" align="space-between">
          <div style={{ flexGrow: 1, maxWidth: '400px' }}>
            <TextField
              label=""
              labelHidden
              value={filters.searchQuery}
              onChange={handleSearchChange}
              placeholder="Search campaigns..."
              prefix={<SearchIcon />}
              autoComplete="off"
            />
          </div>
          
          <InlineStack gap="200">
            <Popover
              active={filterPopoverActive}
              activator={filterActivator}
              onClose={() => setFilterPopoverActive(false)}
              preferredAlignment="right"
            >
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h4">
                    Filter by Status
                  </Text>
                  
                  <BlockStack gap="200">
                    {statusOptions.map(option => (
                      <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={filters.status.includes(option.value)}
                          onChange={() => handleStatusToggle(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </BlockStack>

                  <Divider />
                  
                  <InlineStack gap="200">
                    <Button onClick={handleClearFilters}>
                      Clear All
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={() => setFilterPopoverActive(false)}
                    >
                      Apply
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Popover>

            <Popover
              active={sortPopoverActive}
              activator={sortActivator}
              onClose={() => setSortPopoverActive(false)}
              preferredAlignment="right"
            >
              <ActionList
                items={sortOptions.map(option => ({
                  content: option.label,
                  onAction: () => handleSortChange(option.sortBy, option.order)
                }))}
              />
            </Popover>
          </InlineStack>
        </InlineStack>

        {/* Results summary and active filters */}
        <InlineStack gap="300" align="space-between">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" as="span" tone="subdued">
              Showing {filteredCount} of {totalCount} campaigns
            </Text>
            
            {filters.status.length > 0 && (
              <InlineStack gap="100">
                {filters.status.map(status => (
                  <Badge key={status} tone="info">
                    {statusOptions.find(opt => opt.value === status)?.label}
                  </Badge>
                ))}
              </InlineStack>
            )}
          </InlineStack>

          {activeFiltersCount > 0 && (
            <Button variant="tertiary" onClick={handleClearFilters}>
              Clear all filters
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
