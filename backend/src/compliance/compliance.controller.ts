import {
  Controller, Post, Get, Body, Param,
  Sse, MessageEvent, HttpCode, HttpStatus,
  NotFoundException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, map } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { ComplianceService } from './compliance.service';

interface AnalyzeRequest {
  documentContent: string;
  documentType?: string; // 'claim' | 'policy' | 'contract'
}

@Controller('compliance')
export class ComplianceController {
  private readonly logger = new Logger(ComplianceController.name);

  constructor(
    private readonly complianceService: ComplianceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * POST /api/compliance/analyze
   * Ingest document → queue for autonomous processing
   */
  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  async analyzeDocument(@Body() body: AnalyzeRequest) {
    if (!body.documentContent?.trim()) {
      return { error: 'documentContent is required' };
    }

    const documentId   = uuidv4();
    const documentType = body.documentType ?? 'claim';

    // Create initial DB record (non-blocking if DB is offline)
    await this.complianceService.createDecisionRecord(documentId, documentType);

    // Emit async event — pipeline starts in background
    this.eventEmitter.emit('compliance.document.ingested', {
      documentId,
      content:      body.documentContent,
      documentType,
    });

    this.logger.log(`Queued document ${documentId} (${documentType})`);

    return {
      status:     'QUEUED',
      documentId,
      documentType,
      message:    'Document queued for autonomous compliance analysis.',
      streamUrl:  `/api/compliance/stream/${documentId}`,
      auditUrl:   `/api/compliance/audit/${documentId}`,
    };
  }

  /**
   * GET /api/compliance/stream/:documentId
   * Server-Sent Events — real-time pipeline progress
   */
  @Sse('stream/:documentId')
  streamDecisions(@Param('documentId') documentId: string): Observable<MessageEvent> {
    const subject = this.complianceService.getOrCreateStream(documentId);
    return subject.asObservable().pipe(
      map(event => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }

  /**
   * GET /api/compliance/audit/:documentId
   * Complete audit trail for a processed document
   */
  @Get('audit/:documentId')
  async getAuditTrail(@Param('documentId') documentId: string) {
    const decision = await this.complianceService.getDecisionById(documentId);

    if (!decision) {
      throw new NotFoundException(`No decision record found for document ${documentId}`);
    }

    return {
      documentId:   decision.documentId,
      documentType: decision.documentType,
      decision:     decision.decision,
      riskScore:    decision.riskScore,
      reasoning:    decision.reasoning,
      confidence:   decision.confidenceScore,
      status:       decision.status,
      executedActions: decision.executedActions,
      violationsFound: decision.violationsFound,
      auditLog:     decision.auditLog,
      auditTrail:   decision.auditTrailEntries,
      createdAt:    decision.createdAt,
      completedAt:  decision.completedAt,
      durationMs:   decision.processingDurationMs,
    };
  }

  /**
   * GET /api/compliance/dashboard
   * Real-time KPI stats for the dashboard
   */
  @Get('dashboard')
  async getDashboard() {
    return this.complianceService.getDashboardStats();
  }

  /**
   * POST /api/compliance/seed-rules
   * Seed default compliance rules into the database
   */
  @Post('seed-rules')
  async seedRules() {
    const count = await this.complianceService.seedDefaultRules();
    return { seeded: count, message: `${count} compliance rules seeded.` };
  }
}
