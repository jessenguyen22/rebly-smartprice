import { prisma } from "../db.server";
import type { PricingJobTemplate as PrismaPricingJobTemplate } from "@prisma/client";

export interface PricingRule {
  whenCondition: 'less_than' | 'greater_than' | 'equal_to' | 'less_equal' | 'greater_equal';
  whenValue: string;
  thenAction: 'increase' | 'decrease' | 'set_to';
  thenMode: 'fixed' | 'percentage';
  thenValue: string;
  changeCompareAt: boolean;
}

export interface PricingJobTemplate {
  id: string;
  name: string;
  description?: string | null;
  rules?: PricingRule[] | null;
  bulkAmount?: string | null;
  bulkType?: 'increase' | 'decrease' | null;
  createdAt: Date;
  updatedAt: Date;
  userId?: string | null;
  shopifyShopId: string;
}

function transformTemplate(template: PrismaPricingJobTemplate): PricingJobTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    rules: template.rules ? JSON.parse(template.rules as string) : null,
    bulkAmount: template.bulkAmount,
    bulkType: template.bulkType as 'increase' | 'decrease' | null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    userId: template.userId,
    shopifyShopId: template.shopifyShopId,
  };
}

export async function createPricingJobTemplate({
  name,
  description,
  rules,
  bulkAmount,
  bulkType,
  userId,
  shopDomain,
}: Omit<PricingJobTemplate, 'id' | 'createdAt' | 'updatedAt' | 'shopifyShopId'> & { shopDomain: string }): Promise<PricingJobTemplate> {
  // First find or create the shop record
  let shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain }
  });

  if (!shop) {
    console.log(`🏪 Creating new shop record for: ${shopDomain}`);
    shop = await prisma.shopifyShop.create({
      data: {
        shopDomain,
        accessToken: '', // Will be populated later by session system
        scopes: '',
        country: '',
        currency: '',
        timezone: ''
      }
    });
  }

  const template = await prisma.pricingJobTemplate.create({
    data: {
      name,
      description,
      rules: rules ? JSON.stringify(rules) : undefined,
      bulkAmount,
      bulkType,
      userId,
      shopifyShopId: shop.id,
    },
  });

  return transformTemplate(template);
}

export async function getPricingJobTemplates(
  shopDomain: string,
  userId?: string
): Promise<PricingJobTemplate[]> {
  // Find the shop record first
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain }
  });

  if (!shop) {
    // If shop doesn't exist, return empty array
    return [];
  }

  const templates = await prisma.pricingJobTemplate.findMany({
    where: {
      shopifyShopId: shop.id,
      ...(userId && { userId }),
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return templates.map(transformTemplate);
}

export async function getPricingJobTemplate(
  id: string,
  shopDomain: string,
  userId?: string
): Promise<PricingJobTemplate | null> {
  // Find the shop record first
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain }
  });

  if (!shop) {
    return null;
  }

  const template = await prisma.pricingJobTemplate.findFirst({
    where: {
      id,
      shopifyShopId: shop.id,
      ...(userId && { userId }),
    },
  });

  if (!template) {
    return null;
  }

  return transformTemplate(template);
}

export async function updatePricingJobTemplate(
  id: string,
  updates: Partial<Omit<PricingJobTemplate, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'shopifyShopId'>>,
  shopDomain: string,
  userId: string
): Promise<PricingJobTemplate | null> {
  // Find the shop record first
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain }
  });

  if (!shop) {
    return null;
  }

  try {
    const template = await prisma.pricingJobTemplate.update({
      where: {
        id,
        shopifyShopId: shop.id,
        userId,
      },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.rules !== undefined && { rules: updates.rules ? JSON.stringify(updates.rules) : undefined }),
        ...(updates.bulkAmount !== undefined && { bulkAmount: updates.bulkAmount }),
        ...(updates.bulkType !== undefined && { bulkType: updates.bulkType }),
      },
    });

    return transformTemplate(template);
  } catch (error) {
    // Handle case where template doesn't exist or user doesn't have permission
    return null;
  }
}

export async function deletePricingJobTemplate(
  id: string,
  shopDomain: string,
  userId: string
): Promise<boolean> {
  // Find the shop record first
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain }
  });

  if (!shop) {
    return false;
  }

  try {
    await prisma.pricingJobTemplate.delete({
      where: {
        id,
        shopifyShopId: shop.id,
        userId,
      },
    });
    return true;
  } catch (error) {
    // Handle case where template doesn't exist or user doesn't have permission
    return false;
  }
}
