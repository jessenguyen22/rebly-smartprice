/**
 * Comprehensive Error Handling Service for Pricing Job Operations
 * 
 * Provides standardized error handling, logging, and recovery mechanisms
 * for template operations, database queries, and GraphQL requests.
 */

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  SHOPIFY_API = 'SHOPIFY_API',
  TEMPLATE = 'TEMPLATE',
  PROCESSING = 'PROCESSING',
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  suggestedAction?: string;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorLog: ErrorDetails[] = [];
  private readonly MAX_LOG_SIZE = 1000;

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle template operation errors
   */
  handleTemplateError(error: any, operation: string, context: Record<string, any> = {}): ErrorDetails {
    let errorDetails: ErrorDetails;

    if (error?.code === 'P2002') { // Prisma unique constraint
      errorDetails = {
        type: ErrorType.TEMPLATE,
        severity: ErrorSeverity.MEDIUM,
        message: 'Template name already exists for this shop',
        code: 'TEMPLATE_NAME_EXISTS',
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Please choose a different template name'
      };
    } else if (error?.code === 'P2025') { // Prisma record not found
      errorDetails = {
        type: ErrorType.TEMPLATE,
        severity: ErrorSeverity.MEDIUM,
        message: 'Template not found or access denied',
        code: 'TEMPLATE_NOT_FOUND',
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: false,
        suggestedAction: 'Verify template ID and permissions'
      };
    } else {
      errorDetails = {
        type: ErrorType.TEMPLATE,
        severity: ErrorSeverity.HIGH,
        message: `Template ${operation} failed: ${error.message || 'Unknown error'}`,
        code: 'TEMPLATE_OPERATION_FAILED',
        context: { operation, ...context, originalError: error.toString() },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Please try again or contact support'
      };
    }

    this.logError(errorDetails);
    return errorDetails;
  }

  /**
   * Handle database operation errors
   */
  handleDatabaseError(error: any, operation: string, context: Record<string, any> = {}): ErrorDetails {
    let errorDetails: ErrorDetails;

    if (error?.code?.startsWith('P')) { // Prisma errors
      errorDetails = {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.HIGH,
        message: `Database operation failed: ${this.getPrismaErrorMessage(error)}`,
        code: error.code,
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: this.isPrismaErrorRecoverable(error),
        suggestedAction: this.getPrismaErrorSuggestion(error)
      };
    } else if (error?.code === 'ECONNREFUSED') {
      errorDetails = {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        message: 'Database connection refused',
        code: 'DB_CONNECTION_REFUSED',
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Check database server status'
      };
    } else {
      errorDetails = {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.HIGH,
        message: `Database error: ${error.message || 'Unknown error'}`,
        code: 'DB_UNKNOWN_ERROR',
        context: { operation, ...context, originalError: error.toString() },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Please retry the operation'
      };
    }

    this.logError(errorDetails);
    return errorDetails;
  }

  /**
   * Handle Shopify API errors
   */
  handleShopifyApiError(error: any, operation: string, context: Record<string, any> = {}): ErrorDetails {
    let errorDetails: ErrorDetails;

    // Check for rate limiting
    if (error.extensions?.cost?.throttleStatus?.currentlyAvailable <= 0) {
      errorDetails = {
        type: ErrorType.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Shopify API rate limit exceeded',
        code: 'SHOPIFY_RATE_LIMIT',
        context: { 
          operation, 
          ...context, 
          throttleStatus: error.extensions.cost.throttleStatus 
        },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Wait before retrying. Consider reducing batch sizes.'
      };
    } else if (error.message?.includes('authentication')) {
      errorDetails = {
        type: ErrorType.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message: 'Shopify authentication failed',
        code: 'SHOPIFY_AUTH_FAILED',
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: false,
        suggestedAction: 'Re-authenticate with Shopify'
      };
    } else if (error.networkError) {
      errorDetails = {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        message: `Network error: ${error.networkError.message}`,
        code: 'NETWORK_ERROR',
        context: { operation, ...context },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Check internet connection and retry'
      };
    } else {
      errorDetails = {
        type: ErrorType.SHOPIFY_API,
        severity: ErrorSeverity.HIGH,
        message: `Shopify API error: ${error.message || 'Unknown error'}`,
        code: 'SHOPIFY_API_ERROR',
        context: { operation, ...context, errors: error.graphQLErrors },
        timestamp: new Date(),
        recoverable: true,
        suggestedAction: 'Please retry or check your Shopify permissions'
      };
    }

    this.logError(errorDetails);
    return errorDetails;
  }

  /**
   * Handle pricing job processing errors
   */
  handleProcessingError(error: any, jobId: string, variantId: string): ErrorDetails {
    const errorDetails: ErrorDetails = {
      type: ErrorType.PROCESSING,
      severity: ErrorSeverity.MEDIUM,
      message: `Processing failed for variant ${variantId}: ${error.message || 'Unknown error'}`,
      code: 'PROCESSING_ERROR',
      context: { jobId, variantId, originalError: error.toString() },
      timestamp: new Date(),
      recoverable: true,
      suggestedAction: 'This variant will be skipped. Review error details and retry if needed.'
    };

    this.logError(errorDetails);
    return errorDetails;
  }

  /**
   * Log error details
   */
  private logError(errorDetails: ErrorDetails): void {
    // Add to in-memory log
    this.errorLog.push(errorDetails);
    
    // Keep log size under control
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift(); // Remove oldest entry
    }

    // Console logging with color coding
    const color = this.getConsoleColor(errorDetails.severity);
    console.error(
      `${color}[${errorDetails.severity}] ${errorDetails.type}: ${errorDetails.message}\x1b[0m`,
      errorDetails.context
    );

    // In production, you might want to send to external logging service
    // this.sendToLoggingService(errorDetails);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50, type?: ErrorType): ErrorDetails[] {
    let filtered = this.errorLog;
    
    if (type) {
      filtered = filtered.filter(error => error.type === type);
    }
    
    return filtered
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(hours = 24): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recoverable: number;
    critical: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(error => error.timestamp > cutoff);

    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = recentErrors.filter(e => e.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = recentErrors.filter(e => e.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    return {
      total: recentErrors.length,
      byType,
      bySeverity,
      recoverable: recentErrors.filter(e => e.recoverable).length,
      critical: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length
    };
  }

  /**
   * Clear old errors
   */
  clearOldErrors(olderThanHours = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialLength = this.errorLog.length;
    this.errorLog = this.errorLog.filter(error => error.timestamp > cutoff);
    return initialLength - this.errorLog.length;
  }

  /**
   * Utility methods for Prisma error handling
   */
  private getPrismaErrorMessage(error: any): string {
    const messages: Record<string, string> = {
      'P2002': 'Unique constraint violation',
      'P2025': 'Record not found',
      'P2003': 'Foreign key constraint violation',
      'P2014': 'Invalid relation',
      'P2016': 'Query interpretation error',
      'P2021': 'Table does not exist',
      'P2022': 'Column does not exist'
    };
    
    return messages[error.code] || error.message || 'Database error';
  }

  private isPrismaErrorRecoverable(error: any): boolean {
    const recoverableCodes = ['P2002', 'P2014', 'P2016'];
    return recoverableCodes.includes(error.code);
  }

  private getPrismaErrorSuggestion(error: any): string {
    const suggestions: Record<string, string> = {
      'P2002': 'Use a different value for the unique field',
      'P2025': 'Verify the record exists and you have access',
      'P2003': 'Ensure related records exist',
      'P2014': 'Check your data relationships',
      'P2021': 'Database schema may need updating'
    };
    
    return suggestions[error.code] || 'Please check your data and try again';
  }

  private getConsoleColor(severity: ErrorSeverity): string {
    const colors = {
      [ErrorSeverity.LOW]: '\x1b[36m', // Cyan
      [ErrorSeverity.MEDIUM]: '\x1b[33m', // Yellow
      [ErrorSeverity.HIGH]: '\x1b[31m', // Red
      [ErrorSeverity.CRITICAL]: '\x1b[35m' // Magenta
    };
    return colors[severity];
  }
}
