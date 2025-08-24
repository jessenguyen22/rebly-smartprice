import { useState, useCallback } from 'react';
import {
  Card,
  Text,
  Button,
  ButtonGroup,
  BlockStack,
  InlineStack,
  Select,
  TextField,
  Tag,
  Icon,
  InlineError,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Divider
} from '@shopify/polaris';
import { PlusIcon, DeleteIcon, ProductIcon } from '@shopify/polaris-icons';
import { useAppBridge } from '@shopify/app-bridge-react';
import type { TargetProductCriteria } from '../../types/campaign';

interface ProductTargetingProps {
  targetProducts: TargetProductCriteria[];
  onChange: (targetProducts: TargetProductCriteria[]) => void;
  error?: string;
}

const TARGET_TYPES = [
  { label: 'All products', value: 'all' },
  { label: 'Specific products', value: 'product' },
  { label: 'Product collections', value: 'collection' },
  { label: 'Product variants', value: 'variant' },
  { label: 'Products with tags', value: 'tag' },
];

const INVENTORY_OPERATORS = [
  { label: 'Greater than', value: 'gt' },
  { label: 'Less than', value: 'lt' },
  { label: 'Equal to', value: 'eq' },
  { label: 'Greater than or equal', value: 'gte' },
  { label: 'Less than or equal', value: 'lte' },
];

function TargetCriteriaEditor({
  criteria,
  onChange,
  onDelete,
  index
}: {
  criteria: TargetProductCriteria;
  onChange: (criteria: TargetProductCriteria) => void;
  onDelete: () => void;
  index: number;
}) {
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const shopify = useAppBridge();

  const handleFieldChange = useCallback((field: keyof TargetProductCriteria, value: any) => {
    onChange({ ...criteria, [field]: value });
  }, [criteria, onChange]);

  const handleConditionChange = useCallback((field: string, value: any) => {
    const newConditions = { ...criteria.conditions, [field]: value };
    onChange({ ...criteria, conditions: newConditions });
  }, [criteria, onChange]);

  const handleResourceSelection = useCallback(async () => {
    try {
      if (criteria.type === 'product') {
        const selection = await shopify.resourcePicker({
          type: 'product',
          multiple: true,
        });

        if (selection && selection.length > 0) {
          const productIds = selection.map((product: any) => product.id);
          const productTitles = selection.map((product: any) => product.title);
          const productImages = selection.map((product: any) => product.images?.[0]?.originalSrc || '');
          
          // Merge with existing selection instead of replacing
          const existingIds = Array.isArray(criteria.value) ? criteria.value : [];
          const existingTitles = criteria._metadata?.titles || [];
          const existingImages = criteria._metadata?.images || [];
          
          const allIds = [...existingIds];
          const allTitles = [...existingTitles];
          const allImages = [...existingImages];
          
          // Add only new items
          productIds.forEach((id, idx) => {
            if (!allIds.includes(id)) {
              allIds.push(id);
              allTitles.push(productTitles[idx]);
              allImages.push(productImages[idx]);
            }
          });
          
          onChange({
            ...criteria,
            value: allIds,
            _metadata: { titles: allTitles, images: allImages }
          });
        }
      } else if (criteria.type === 'collection') {
        const selection = await shopify.resourcePicker({
          type: 'collection',
          multiple: true,
        });

        if (selection && selection.length > 0) {
          const collectionIds = selection.map((collection: any) => collection.id);
          const collectionTitles = selection.map((collection: any) => collection.title);
          const collectionImages = selection.map((collection: any) => collection.image?.originalSrc || '');
          
          // Merge with existing selection
          const existingIds = Array.isArray(criteria.value) ? criteria.value : [];
          const existingTitles = criteria._metadata?.titles || [];
          const existingImages = criteria._metadata?.images || [];
          
          const allIds = [...existingIds];
          const allTitles = [...existingTitles];
          const allImages = [...existingImages];
          
          // Add only new items
          collectionIds.forEach((id, idx) => {
            if (!allIds.includes(id)) {
              allIds.push(id);
              allTitles.push(collectionTitles[idx]);
              allImages.push(collectionImages[idx]);
            }
          });
          
          onChange({
            ...criteria,
            value: allIds,
            _metadata: { titles: allTitles, images: allImages }
          });
        }
      } else if (criteria.type === 'variant') {
        const selection = await shopify.resourcePicker({
          type: 'variant',
          multiple: true,
        });

        if (selection && selection.length > 0) {
          const variantIds = selection.map((variant: any) => variant.id);
          const variantTitles = selection.map((variant: any) => `${variant.product.title} - ${variant.title}`);
          const variantImages = selection.map((variant: any) => variant.image?.originalSrc || variant.product.images?.[0]?.originalSrc || '');
          
          // Merge with existing selection
          const existingIds = Array.isArray(criteria.value) ? criteria.value : [];
          const existingTitles = criteria._metadata?.titles || [];
          const existingImages = criteria._metadata?.images || [];
          
          const allIds = [...existingIds];
          const allTitles = [...existingTitles];
          const allImages = [...existingImages];
          
          // Add only new items
          variantIds.forEach((id, idx) => {
            if (!allIds.includes(id)) {
              allIds.push(id);
              allTitles.push(variantTitles[idx]);
              allImages.push(variantImages[idx]);
            }
          });
          
          onChange({
            ...criteria,
            value: allIds,
            _metadata: { titles: allTitles, images: allImages }
          });
        }
      }
    } catch (error) {
      console.error('Resource picker error:', error);
    }
  }, [criteria, onChange, shopify]);

  const handleRemoveItem = useCallback((indexToRemove: number) => {
    if (!Array.isArray(criteria.value)) return;
    
    const newValue = criteria.value.filter((_, index) => index !== indexToRemove);
    const newTitles = criteria._metadata?.titles?.filter((_, index) => index !== indexToRemove) || [];
    const newImages = criteria._metadata?.images?.filter((_, index) => index !== indexToRemove) || [];
    
    onChange({
      ...criteria,
      value: newValue,
      _metadata: { 
        ...criteria._metadata,
        titles: newTitles, 
        images: newImages 
      }
    });
  }, [criteria, onChange]);

  const renderTargetValue = () => {
    if (criteria.type === 'all') {
      return (
        <Text tone="subdued" as="p">
          All products in your store will be targeted by this campaign.
        </Text>
      );
    }

    if (criteria.type === 'tag') {
      return (
        <TextField
          label="Product Tags"
          value={Array.isArray(criteria.value) ? criteria.value.join(', ') : (criteria.value || '')}
          onChange={(value) => handleFieldChange('value', value.split(',').map(tag => tag.trim()))}
          placeholder="e.g., sale, clearance, seasonal"
          helpText="Enter tags separated by commas"
          autoComplete="off"
        />
      );
    }

    return (
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text variant="bodySm" as="p">
            Selected {criteria.type === 'product' ? 'Products' : 
                     criteria.type === 'collection' ? 'Collections' : 
                     'Variants'} ({Array.isArray(criteria.value) ? criteria.value.length : 0})
          </Text>
          <ButtonGroup>
            <Button
              size="micro"
              onClick={handleResourceSelection}
              loading={showResourcePicker}
            >
              {Array.isArray(criteria.value) && criteria.value.length > 0 ? 'Add More' : 'Select'}
            </Button>
            {Array.isArray(criteria.value) && criteria.value.length > 0 && (
              <Button
                size="micro"
                variant="tertiary"
                tone="critical"
                onClick={() => onChange({ ...criteria, value: [], _metadata: { titles: [], images: [] } })}
              >
                Clear All
              </Button>
            )}
          </ButtonGroup>
        </InlineStack>
        
        {Array.isArray(criteria.value) && criteria.value.length > 0 && (
          <Text variant="bodySm" tone="subdued" as="p">
            Tip: Use "Add More" to select additional items, or use "Remove" action on individual items to fine-tune your selection.
          </Text>
        )}

        {Array.isArray(criteria.value) && criteria.value.length > 0 ? (
          <ResourceList
            resourceName={{ singular: 'item', plural: 'items' }}
            items={criteria.value.map((id, idx) => ({
              id: id.toString(),
              name: criteria._metadata?.titles?.[idx] || `Item ${idx + 1}`,
              gid: id,
              image: criteria._metadata?.images?.[idx] || '',
              index: idx // Add index for tracking
            }))}
            renderItem={(item) => (
              <ResourceItem
                id={item.id}
                media={<Thumbnail source={item.image || ''} alt={item.name} size="small" />}
                accessibilityLabel={`View details for ${item.name}`}
                onClick={() => {}}
                shortcutActions={[
                  {
                    content: 'Remove',
                    onAction: () => handleRemoveItem(item.index),
                  },
                ]}
              >
                <Text variant="bodyMd" fontWeight="bold" as="h6">
                  {item.name}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  {item.gid}
                </Text>
              </ResourceItem>
            )}
          />
        ) : (
          <Text tone="subdued" as="p">
            No {criteria.type === 'product' ? 'products' : 
                  criteria.type === 'collection' ? 'collections' : 
                  'variants'} selected
          </Text>
        )}
      </BlockStack>
    );
  };

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingSm" as="h4">
            Target Criteria {index + 1}
          </Text>
          <Button
            variant="tertiary"
            tone="critical"
            icon={DeleteIcon}
            onClick={onDelete}
            accessibilityLabel={`Delete target criteria ${index + 1}`}
          />
        </InlineStack>

        <Select
          label="Target Type"
          options={TARGET_TYPES}
          value={criteria.type}
          onChange={(value) => handleFieldChange('type', value as TargetProductCriteria['type'])}
        />

        {renderTargetValue()}

        {criteria.type !== 'all' && (
          <>
            <Divider />
            <Text variant="headingSm" as="h5">
              Additional Filters (Optional)
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Apply additional conditions to further narrow down which products are affected by this campaign.
            </Text>

            <InlineStack gap="300">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Min Price ($)"
                  type="number"
                  step={0.01}
                  value={criteria.conditions?.priceRange?.min?.toString() || ''}
                  onChange={(value) => 
                    handleConditionChange('priceRange', {
                      ...criteria.conditions?.priceRange,
                      min: parseFloat(value) || undefined
                    })
                  }
                  placeholder="0.00"
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="Max Price ($)"
                  type="number"
                  step={0.01}
                  value={criteria.conditions?.priceRange?.max?.toString() || ''}
                  onChange={(value) => 
                    handleConditionChange('priceRange', {
                      ...criteria.conditions?.priceRange,
                      max: parseFloat(value) || undefined
                    })
                  }
                  placeholder="999.99"
                  autoComplete="off"
                />
              </div>
            </InlineStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}

export function ProductTargeting({ targetProducts, onChange, error }: ProductTargetingProps) {
  const handleAddCriteria = useCallback(() => {
    const newCriteria: TargetProductCriteria = {
      type: 'product',
      value: [],
      conditions: {}
    };
    onChange([...targetProducts, newCriteria]);
  }, [targetProducts, onChange]);

  const handleCriteriaChange = useCallback((index: number, updatedCriteria: TargetProductCriteria) => {
    const updatedTargets = [...targetProducts];
    updatedTargets[index] = updatedCriteria;
    onChange(updatedTargets);
  }, [targetProducts, onChange]);

  const handleDeleteCriteria = useCallback((index: number) => {
    const updatedTargets = targetProducts.filter((_, i) => i !== index);
    onChange(updatedTargets);
  }, [targetProducts, onChange]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">
            Target Products
          </Text>
          <Button
            icon={PlusIcon}
            onClick={handleAddCriteria}
            variant="primary"
          >
            Add Target
          </Button>
        </InlineStack>

        {error && (
          <InlineError message={error} fieldID="target-products-error" />
        )}

        {targetProducts.length === 0 ? (
          <Text tone="subdued" as="p">
            No product targeting defined. Click "Add Target" to specify which products this campaign should affect.
          </Text>
        ) : (
          <BlockStack gap="400">
            {targetProducts.map((criteria, index) => (
              <TargetCriteriaEditor
                key={index}
                criteria={criteria}
                index={index}
                onChange={(updatedCriteria) => handleCriteriaChange(index, updatedCriteria)}
                onDelete={() => handleDeleteCriteria(index)}
              />
            ))}
          </BlockStack>
        )}

        <Text variant="bodySm" tone="subdued" as="p">
          Multiple targeting criteria will be combined with OR logic - products matching any criteria will be included.
        </Text>
      </BlockStack>
    </Card>
  );
}
