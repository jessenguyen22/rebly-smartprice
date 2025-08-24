import { InlineStack, Text, Icon } from '@shopify/polaris';
import { ChevronRightIcon } from '@shopify/polaris-icons';
import { Link } from '@remix-run/react';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <InlineStack gap="200" align="start">
      {items.map((item, index) => (
        <InlineStack key={index} gap="200" align="center">
          {index > 0 && (
            <Icon source={ChevronRightIcon} tone="subdued" />
          )}
          {item.url ? (
            <Link to={item.url}>
              <Text as="span" variant="bodyMd" tone="subdued">
                {item.label}
              </Text>
            </Link>
          ) : (
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {item.label}
            </Text>
          )}
        </InlineStack>
      ))}
    </InlineStack>
  );
}
