import { useState, useCallback } from 'react';
import {
  Card,
  Form,
  FormLayout,
  TextField,
  Button,
  ButtonGroup,
  Text,
  BlockStack,
  InlineError
} from '@shopify/polaris';
import type { CreateCampaignData, CreatePricingRuleData, TargetProductCriteria } from '../../types/campaign';
import { RuleBuilder } from './RuleBuilder';
import { ProductTargeting } from './ProductTargeting';
import { CampaignPreview } from './CampaignPreview';

interface CampaignFormProps {
  onSubmit: (data: CreateCampaignData, bypassOverlapCheck?: boolean) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreateCampaignData>;
  isSubmitting?: boolean;
  overlapData?: {
    overlaps: Array<{
      productId: string;
      campaignId: string;
      campaignName: string;
      productTitle?: string;
    }>;
    onBypassOverlap: (data: CreateCampaignData) => Promise<void>;
  };
}

interface FormErrors {
  name?: string;
  description?: string;
  rules?: string;
  targetProducts?: string;
  general?: string;
}

export function CampaignForm({ 
  onSubmit, 
  onCancel, 
  initialData,
  isSubmitting = false,
  overlapData
}: CampaignFormProps) {
  const [formData, setFormData] = useState<CreateCampaignData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    targetProducts: initialData?.targetProducts || [],
    rules: initialData?.rules || [],
    priority: initialData?.priority || 1,
    status: 'DRAFT'
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPreview, setShowPreview] = useState(false);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Validate campaign name
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Campaign name must be at least 3 characters';
    }

    // Validate rules
    if (!formData.rules.length) {
      newErrors.rules = 'At least one pricing rule is required';
    }

    // Validate target products
    if (!formData.targetProducts.length) {
      newErrors.targetProducts = 'Target products must be specified';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNameChange = useCallback((value: string) => {
    setFormData((prev: CreateCampaignData) => ({ ...prev, name: value }));
    // Clear name error on change
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
  }, [errors.name]);

  const handleDescriptionChange = useCallback((value: string) => {
    setFormData((prev: CreateCampaignData) => ({ ...prev, description: value }));
  }, []);

  const handleRulesChange = useCallback((rules: CreatePricingRuleData[]) => {
    setFormData((prev: CreateCampaignData) => ({ ...prev, rules }));
    // Clear rules error on change
    if (errors.rules) {
      setErrors(prev => ({ ...prev, rules: undefined }));
    }
  }, [errors.rules]);

  const handleTargetProductsChange = useCallback((targetProducts: TargetProductCriteria[]) => {
    setFormData((prev: CreateCampaignData) => ({ ...prev, targetProducts }));
    // Clear target products error on change
    if (errors.targetProducts) {
      setErrors(prev => ({ ...prev, targetProducts: undefined }));
    }
  }, [errors.targetProducts]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        general: error instanceof Error ? error.message : 'An error occurred while creating the campaign' 
      }));
      setShowPreview(false); // Go back to form to show the error
    }
  }, [formData, onSubmit, validateForm]);

  const handlePreviewToggle = useCallback(() => {
    if (!showPreview && !validateForm()) {
      return;
    }
    setShowPreview(!showPreview);
  }, [showPreview, validateForm]);

  if (showPreview) {
    return (
      <CampaignPreview
        data={formData}
        onEdit={() => setShowPreview(false)}
        onConfirm={handleSubmit}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormLayout>
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Campaign Details
            </Text>
            
            <TextField
              label="Campaign Name"
              value={formData.name}
              onChange={handleNameChange}
              error={errors.name}
              autoComplete="off"
              helpText="Choose a descriptive name for your campaign"
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={handleDescriptionChange}
              error={errors.description}
              multiline={3}
              autoComplete="off"
              helpText="Optional description to help you remember the purpose of this campaign"
            />
          </BlockStack>
        </Card>

        <RuleBuilder
          rules={formData.rules}
          onChange={handleRulesChange}
          error={errors.rules}
        />

        <ProductTargeting
          targetProducts={formData.targetProducts}
          onChange={handleTargetProductsChange}
          error={errors.targetProducts}
        />

        {overlapData && overlapData.overlaps.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3" tone="critical">
                Product Overlap Warning
              </Text>
              <Text as="p">
                The following products are already in other active campaigns:
              </Text>
              <BlockStack gap="200">
                {overlapData.overlaps.map((overlap, index) => (
                  <Text key={index} as="p" tone="subdued">
                    • Product ID {overlap.productId} is in campaign "{overlap.campaignName}"
                  </Text>
                ))}
              </BlockStack>
              <Text as="p">
                Do you want to move these products to this new campaign? This will remove them from their current campaigns.
              </Text>
              <ButtonGroup>
                <Button
                  variant="primary"
                  tone="critical"
                  onClick={() => overlapData.onBypassOverlap(formData)}
                  disabled={isSubmitting}
                >
                  Move Products to New Campaign
                </Button>
                <Button onClick={onCancel}>Cancel</Button>
              </ButtonGroup>
            </BlockStack>
          </Card>
        )}

        {errors.general && (
          <Card>
            <InlineError message={errors.general} fieldID="campaign-form-general" />
          </Card>
        )}

        {!overlapData && (
          <Card>
            <ButtonGroup>
              <Button
                variant="primary"
                onClick={handlePreviewToggle}
                disabled={isSubmitting}
                loading={false}
              >
                Preview Campaign
              </Button>
              <Button
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </ButtonGroup>
          </Card>
        )}
      </FormLayout>
    </Form>
  );
}
