import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Health check controller — exposes liveness and readiness probes
 * for infrastructure monitoring and the Angular frontend status panel.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  private getActiveModel(): string {
    const provider = (process.env.PROVIDER ?? 'nvidia').toLowerCase();
    if (provider === 'groq') {
      return process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    }
    if (provider === 'nvidia') {
      return process.env.NVIDIA_MODEL ?? 'meta/llama-3.1-8b-instruct';
    }
    return process.env.OPENAI_MODEL ?? 'gpt-4o';
  }

  @Get()
  getHealth(): Record<string, unknown> {
    return {
      ok: true,
      platform: 'Clinical AI Platform',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      database: this.prisma.isConnected ? 'connected' : 'disconnected',
      provider: process.env.PROVIDER ?? 'nvidia',
      model: this.getActiveModel(),
      timestamp: new Date().toISOString(),
    };
  }
}
