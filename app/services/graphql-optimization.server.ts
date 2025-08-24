/**
 * GraphQL Query Optimization Service
 * 
 * Maintains existing Shopify GraphQL patterns while optimizing for performance.
 * Includes caching, batching, and error handling for product/variant queries.
 */

interface ProductVariantData {
  id: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  product: {
    id: string;
    title: string;
  };
  inventoryQuantity?: number;
  inventoryItem?: {
    tracked: boolean;
  };
}

interface BatchQueryResult {
  success: boolean;
  data?: ProductVariantData[];
  errors?: string[];
  rateLimitInfo?: {
    currentlyAvailable: number;
    maximumAvailable: number;
    restoreRate: number;
  };
}

export class GraphQLOptimizationService {
  private cache: Map<string, { data: ProductVariantData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BATCH_SIZE = 50; // Shopify recommended batch size
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(private admin: any) {}

  /**
   * Optimized batch query for product variants with caching
   */
  async getProductVariantsBatch(variantIds: string[]): Promise<BatchQueryResult> {
    try {
      // Check cache first
      const now = Date.now();
      const cached: ProductVariantData[] = [];
      const uncachedIds: string[] = [];

      variantIds.forEach(id => {
        const cachedItem = this.cache.get(id);
        if (cachedItem && (now - cachedItem.timestamp) < this.CACHE_TTL) {
          cached.push(cachedItem.data);
        } else {
          uncachedIds.push(id);
        }
      });

      console.log(`📊 Cache stats: ${cached.length} cached, ${uncachedIds.length} to fetch`);

      // If all are cached, return immediately
      if (uncachedIds.length === 0) {
        return {
          success: true,
          data: cached
        };
      }

      // Fetch uncached variants in batches
      const allData: ProductVariantData[] = [...cached];
      const batches = this.chunkArray(uncachedIds, this.BATCH_SIZE);
      
      for (const batch of batches) {
        const batchResult = await this.fetchVariantBatch(batch);
        if (batchResult.success && batchResult.data) {
          // Cache the results
          batchResult.data.forEach(variant => {
            this.cache.set(variant.id, {
              data: variant,
              timestamp: now
            });
          });
          allData.push(...batchResult.data);
        } else if (!batchResult.success) {
          console.warn(`Batch query failed for batch of ${batch.length} variants:`, batchResult.errors);
        }
      }

      return {
        success: true,
        data: allData,
        rateLimitInfo: await this.getRateLimitInfo()
      };

    } catch (error) {
      console.error('GraphQL optimization service error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Fetch a single batch with retry logic
   */
  private async fetchVariantBatch(variantIds: string[], retryCount = 0): Promise<BatchQueryResult> {
    try {
      const query = this.buildBatchVariantQuery(variantIds);
      
      const response = await this.admin.graphql(query, {
        variables: { variantIds: variantIds.map(id => `gid://shopify/ProductVariant/${id}`) }
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const variants = data.data?.nodes?.filter((node: any) => node?.__typename === 'ProductVariant') || [];
      
      return {
        success: true,
        data: variants.map(this.transformVariantData)
      };

    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.warn(`Retrying batch query (attempt ${retryCount + 1}/${this.MAX_RETRIES}):`, error);
        await this.sleep(this.RETRY_DELAY * Math.pow(2, retryCount)); // Exponential backoff
        return this.fetchVariantBatch(variantIds, retryCount + 1);
      }

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Build optimized GraphQL query for batch variant fetching
   */
  private buildBatchVariantQuery(variantIds: string[]): string {
    return `
      query getProductVariantsBatch($variantIds: [ID!]!) {
        nodes(ids: $variantIds) {
          __typename
          ... on ProductVariant {
            id
            title
            price
            compareAtPrice
            inventoryQuantity
            inventoryItem {
              tracked
            }
            product {
              id
              title
            }
          }
        }
        extensions {
          cost {
            requestedQueryCost
            actualQueryCost
            throttleStatus {
              maximumAvailable
              currentlyAvailable
              restoreRate
            }
          }
        }
      }
    `;
  }

  /**
   * Transform GraphQL response to internal format
   */
  private transformVariantData(variant: any): ProductVariantData {
    return {
      id: variant.id.replace('gid://shopify/ProductVariant/', ''),
      title: variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      product: {
        id: variant.product.id.replace('gid://shopify/Product/', ''),
        title: variant.product.title
      },
      inventoryQuantity: variant.inventoryQuantity,
      inventoryItem: variant.inventoryItem
    };
  }

  /**
   * Get current rate limit information
   */
  private async getRateLimitInfo() {
    try {
      const response = await this.admin.graphql(`
        query {
          extensions {
            cost {
              throttleStatus {
                maximumAvailable
                currentlyAvailable
                restoreRate
              }
            }
          }
        }
      `);

      const data = await response.json();
      return data.data?.extensions?.cost?.throttleStatus;
    } catch {
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    console.log(`🧹 Cleared ${cleared} expired cache entries`);
    return cleared;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    const now = Date.now();
    const valid = Array.from(this.cache.values()).filter(
      item => now - item.timestamp < this.CACHE_TTL
    ).length;

    return {
      total: this.cache.size,
      valid,
      expired: this.cache.size - valid,
      hitRate: this.cache.size > 0 ? (valid / this.cache.size) * 100 : 0
    };
  }

  /**
   * Utility methods
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
