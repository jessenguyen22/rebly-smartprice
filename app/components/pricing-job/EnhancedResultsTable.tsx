import {
  Card,
  BlockStack,
  Text,
  IndexTable,
  Badge,
  Button,
  InlineStack,
  Spinner,
  Modal,
  TextContainer,
} from '@shopify/polaris';
import { useState } from 'react';

export interface ExportResult {
  variantId: string;
  success: boolean;
  productTitle?: string;
  variantTitle?: string;
  inventory?: number;
  oldPrice?: string;
  newPrice?: string;
  reason?: string;
  error?: string;
}

interface EnhancedResultsTableProps {
  jobName: string;
  actionType: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: ExportResult[];
  shopDomain: string;
  onExport?: (format: 'csv' | 'pdf') => Promise<{ downloadUrl: string; filename: string }>;
  onMessage?: (message: string, isError?: boolean) => void;
}

export function EnhancedResultsTable({
  jobName,
  actionType,
  totalProcessed,
  successCount,
  failureCount,
  skippedCount,
  results,
  shopDomain,
  onExport,
  onMessage
}: EnhancedResultsTableProps) {
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [exportModal, setExportModal] = useState(false);

  const successRate = totalProcessed > 0 ? Math.round((successCount / totalProcessed) * 100) : 0;

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!onExport) return;

    setExportingFormat(format);
    try {
      const result = await onExport(format);
      
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onMessage) {
        onMessage(`${format.toUpperCase()} export completed successfully`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      if (onMessage) {
        onMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    } finally {
      setExportingFormat(null);
    }
  };

  const formatPriceChange = (result: ExportResult) => {
    if (result.success && result.oldPrice && result.newPrice) {
      const oldPrice = parseFloat(result.oldPrice);
      const newPrice = parseFloat(result.newPrice);
      const change = newPrice - oldPrice;
      const changePercent = oldPrice > 0 ? ((change / oldPrice) * 100).toFixed(1) : '0.0';
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Text variant="bodyMd" as="span">
            ${result.oldPrice} → ${result.newPrice}
          </Text>
          <Text 
            variant="bodySm" 
            as="span" 
            tone={change >= 0 ? "success" : "critical"}
          >
            {change >= 0 ? '+' : ''}${change.toFixed(2)} ({changePercent}%)
          </Text>
        </div>
      );
    }
    
    if (result.reason) {
      return (
        <Text variant="bodyMd" as="span" tone="subdued">
          {result.reason}
        </Text>
      );
    }
    
    return (
      <Text variant="bodyMd" as="span" tone="subdued">
        {result.error || "N/A"}
      </Text>
    );
  };

  return (
    <>
      <Card>
        <BlockStack gap="400">
          {/* Summary Section */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '16px',
            padding: '16px',
            backgroundColor: '#f6f6f7',
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <Text variant="headingMd" as="h4">
                {totalProcessed}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Total Processed
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text variant="headingMd" as="h4" tone="success">
                {successCount}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Updated
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text variant="headingMd" as="h4">
                {skippedCount}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Skipped
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text variant="headingMd" as="h4" tone="critical">
                {failureCount}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Failed
              </Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text variant="headingMd" as="h4">
                {successRate}%
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Success Rate
              </Text>
            </div>
          </div>

          {/* Export Actions */}
          <InlineStack align="space-between">
            <Text as="h3" variant="headingMd">
              Detailed Results ({results.length} items)
            </Text>
            <InlineStack gap="200">
              <Button
                variant="secondary"
                loading={exportingFormat === 'csv'}
                disabled={exportingFormat !== null}
                onClick={() => handleExport('csv')}
              >
                📥 Export CSV
              </Button>
              <Button
                variant="secondary"
                loading={exportingFormat === 'pdf'}
                disabled={exportingFormat !== null}
                onClick={() => handleExport('pdf')}
              >
                📄 Export Report
              </Button>
            </InlineStack>
          </InlineStack>

          {/* Results Table */}
          <IndexTable
            resourceName={{ singular: "result", plural: "results" }}
            itemCount={results.length}
            headings={
              actionType === "inventory_rules" 
                ? [
                    { title: "Product" },
                    { title: "Variant" },
                    { title: "Status" },
                    { title: "Inventory" },
                    { title: "Price Change / Reason" },
                  ]
                : [
                    { title: "Product" },
                    { title: "Variant" },
                    { title: "Status" },
                    { title: "Price Change / Reason" },
                  ]
            }
            selectable={false}
          >
            {results.map((result: ExportResult, index: number) => (
              <IndexTable.Row id={result.variantId} key={result.variantId} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    {result.productTitle || "Unknown"}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">
                    {result.variantTitle || "Unknown"}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={
                    result.success 
                      ? "success" 
                      : result.reason 
                        ? "attention" 
                        : "critical"
                  }>
                    {result.success ? "Updated" : result.reason ? "Skipped" : "Failed"}
                  </Badge>
                </IndexTable.Cell>
                {actionType === "inventory_rules" && (
                  <IndexTable.Cell>
                    <Text variant="bodyMd" as="span">
                      {result.inventory !== undefined ? result.inventory.toString() : "N/A"}
                    </Text>
                  </IndexTable.Cell>
                )}
                <IndexTable.Cell>
                  {formatPriceChange(result)}
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
          
          {/* Processing Time Info */}
          <div style={{ 
            padding: '12px 16px',
            backgroundColor: '#f6f6f7',
            borderRadius: '8px',
            borderLeft: '4px solid #008060'
          }}>
            <Text variant="bodyMd" as="p">
              <strong>Processing Summary:</strong> Job "{jobName}" processed {totalProcessed} variants with {successRate}% success rate.
              {successCount > 0 && (
                <span> Successfully updated {successCount} price{successCount !== 1 ? 's' : ''}.</span>
              )}
            </Text>
          </div>
        </BlockStack>
      </Card>

      {/* Export Loading Modal */}
      <Modal
        open={exportingFormat !== null}
        onClose={() => {}}
        title={`Generating ${exportingFormat?.toUpperCase()} Export`}
        primaryAction={{
          content: 'Close',
          onAction: () => setExportingFormat(null),
          disabled: exportingFormat !== null
        }}
      >
        <Modal.Section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Spinner size="small" />
            <TextContainer>
              <Text as="p">
                Please wait while we generate your {exportingFormat} export file. 
                This may take a moment for large datasets.
              </Text>
            </TextContainer>
          </div>
        </Modal.Section>
      </Modal>
    </>
  );
}
