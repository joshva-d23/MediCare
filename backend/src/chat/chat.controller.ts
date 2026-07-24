import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AgentService } from '../agent/agent.service';

interface ChatRequestBody {
  agentId: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Chat controller — handles clinical AI agent interactions.
 * Exposes agent roster, platform config, and chat endpoints.
 */
@Controller()
export class ChatController {
  constructor(private readonly agentService: AgentService) {}

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

  @Get('config')
  getConfig(): Record<string, unknown> {
    return {
      platform: 'Clinical AI Platform',
      provider: process.env.PROVIDER ?? 'nvidia',
      model: this.getActiveModel(),
      agentCount: Object.keys(this.agentService.AGENTS_ROSTER).length,
      version: '1.0.0',
    };
  }

  @Get('agents')
  getAgents(): Record<string, unknown> {
    const roster = Object.values(this.agentService.AGENTS_ROSTER).map(agent => {
      const { id, name, role, tagline, accent, tag } = agent;
      return { id, name, role, tagline, accent, tag };
    });

    return {
      provider: process.env.PROVIDER ?? 'nvidia',
      model: this.getActiveModel(),
      agents: roster,
    };
  }

  @Post('chat')
  async handleChat(@Body() body: ChatRequestBody): Promise<Record<string, unknown>> {
    const { agentId, messages } = body ?? {};

    if (!agentId || !this.agentService.AGENTS_ROSTER[agentId]) {
      throw new BadRequestException(
        `Unknown clinical agent ID: "${agentId}". Valid agents: ${Object.keys(this.agentService.AGENTS_ROSTER).join(', ')}`,
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('Messages must be a non-empty array.');
    }

    try {
      const reply = await this.agentService.chat(agentId, messages);
      const agent = this.agentService.AGENTS_ROSTER[agentId];
      return {
        reply,
        agent: {
          id: agentId,
          name: agent.name,
          role: agent.role,
          tag: agent.tag,
        },
      };
    } catch (err) {
      throw new InternalServerErrorException(
        (err as Error).message || 'Clinical AI processing failed.',
      );
    }
  }
}
