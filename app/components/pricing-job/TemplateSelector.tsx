import { useState } from "react";
import {
  Select,
  Button,
  TextField,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Modal,
  Banner,
} from "@shopify/polaris";
import type { PricingJobTemplate, PricingRule } from "../../models/pricing-job-template.server";

interface TemplateSelectorProps {
  templates: PricingJobTemplate[];
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string | undefined) => void;
  onTemplateSave: (template: { name: string; description?: string }) => void;
  currentRules?: PricingRule[];
  currentBulkAmount?: string;
  currentBulkType?: 'increase' | 'decrease';
  jobName?: string;
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onTemplateSave,
  currentRules,
  currentBulkAmount,
  currentBulkType,
  jobName,
}: TemplateSelectorProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState(jobName || "");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const templateOptions = [
    { label: "Select a template...", value: "" },
    ...templates.map(template => ({
      label: template.name,
      value: template.id,
    })),
  ];

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;

    setIsSaving(true);
    try {
      await onTemplateSave({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
      });
      setShowSaveModal(false);
      setTemplateName(jobName || "");
      setTemplateDescription("");
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const canSaveTemplate = (currentRules && currentRules.length > 0) || currentBulkAmount;

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              Job Templates
            </Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Load a saved template or create a new one from your current configuration.
            </Text>
          </BlockStack>

          <InlineStack gap="400" align="start">
            <div style={{ minWidth: '300px', flexGrow: 1 }}>
              <Select
                label="Load template"
                options={templateOptions}
                value={selectedTemplateId || ""}
                onChange={(value) => onTemplateSelect(value || undefined)}
              />
            </div>
            
            <Button
              variant="secondary"
              onClick={() => setShowSaveModal(true)}
              disabled={!canSaveTemplate}
            >
              Save as Template
            </Button>
          </InlineStack>

          {selectedTemplate && (
            <Card background="bg-surface-secondary">
              <BlockStack gap="300">
                <InlineStack gap="300" align="space-between">
                  <Text as="h4" variant="headingSm">
                    {selectedTemplate.name}
                  </Text>
                  <Badge tone="info" size="small">
                    Template
                  </Badge>
                </InlineStack>

                {selectedTemplate.description && (
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {selectedTemplate.description}
                  </Text>
                )}

                <InlineStack gap="300">
                  {selectedTemplate.rules && selectedTemplate.rules.length > 0 && (
                    <Text variant="bodySm" as="span">
                      <strong>Rules:</strong> {selectedTemplate.rules.length} configured
                    </Text>
                  )}
                  {selectedTemplate.bulkAmount && (
                    <Text variant="bodySm" as="span">
                      <strong>Bulk Action:</strong> {selectedTemplate.bulkType} ${selectedTemplate.bulkAmount}
                    </Text>
                  )}
                </InlineStack>

                <Text variant="bodySm" as="p" tone="subdued">
                  Last updated: {new Date(selectedTemplate.updatedAt).toLocaleDateString()}
                </Text>
              </BlockStack>
            </Card>
          )}

          {!canSaveTemplate && (
            <Banner tone="info">
              <Text variant="bodyMd" as="p">
                Configure pricing rules or bulk adjustments to save as a template.
              </Text>
            </Banner>
          )}
        </BlockStack>
      </Card>

      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save as Template"
        primaryAction={{
          content: "Save Template",
          onAction: handleSaveTemplate,
          loading: isSaving,
          disabled: !templateName.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowSaveModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Template name"
              value={templateName}
              onChange={setTemplateName}
              placeholder="e.g., Black Friday Pricing Rules"
              autoComplete="off"
              helpText="A descriptive name for your template"
            />

            <TextField
              label="Description (optional)"
              value={templateDescription}
              onChange={setTemplateDescription}
              placeholder="Brief description of when to use this template"
              multiline={2}
              autoComplete="off"
            />

            <BlockStack gap="200">
              <Text as="h4" variant="headingSm">
                Template will include:
              </Text>
              <BlockStack gap="100">
                {currentRules && currentRules.length > 0 && (
                  <Text variant="bodySm" as="p">
                    • {currentRules.length} pricing rule{currentRules.length === 1 ? '' : 's'}
                  </Text>
                )}
                {currentBulkAmount && (
                  <Text variant="bodySm" as="p">
                    • Bulk {currentBulkType}: ${currentBulkAmount}
                  </Text>
                )}
              </BlockStack>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
