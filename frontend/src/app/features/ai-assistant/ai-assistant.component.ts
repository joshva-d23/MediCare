import { Component, OnInit, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';

interface ChatMessage {
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

@Pipe({
  name: 'messageCount',
  standalone: true
})
export class MessageCountPipe implements PipeTransform {
  transform(messages: ChatMessage[], agentId: string): number {
    if (!messages) return 0;
    return messages.filter(m => m.agentId === agentId && m.role === 'assistant').length;
  }
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageCountPipe],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.scss']
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = [];
  composerText = '';
  sending = false;
  activeAgentId = '';
  provider = 'NVIDIA';
  model = 'meta/llama-3.1-8b-instruct';
  agents: any[] = [];
  
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  ngOnDestroy(): void {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
  }

  private loadAgents(): void {
    this.http.get<any>('http://localhost:3000/api/agents').subscribe({
      next: (res) => {
        this.agents = res.agents || [];
        this.provider = res.provider || 'NVIDIA';
        this.model = res.model || 'meta/llama-3.1-8b-instruct';
        if (this.agents.length > 0) {
          this.activeAgentId = this.agents[0].id;
        }
      },
      error: (err) => {
        console.warn('Failed to load agents from backend, using fallbacks', err);
        this.agents = [
          { id: 'clinical-decision', name: 'Clinical Decision Support', role: 'Diagnostic Reasoning', tagline: 'Differential diagnoses and symptom checks', accent: '#8b5cf6', tag: 'CDS', description: 'Assists with clinical diagnostic reasoning, symptom analysis, and differential diagnosis generation.' },
          { id: 'evidence-retrieval', name: 'Evidence-Based Medicine', role: 'Literature & Guidelines', tagline: 'Cochrane, PubMed, and guideline checks', accent: '#0ea5e9', tag: 'EBM', description: 'Searches clinical literature, grades evidence, and retrieves consensus guidelines.' },
          { id: 'drug-safety', name: 'Pharmacology Safety', role: 'Interactions & Contraindications', tagline: 'Check interactions and dosing controls', accent: '#ef4444', tag: 'PHA', description: 'Checks drug-drug/drug-allergy interactions, renal dosing adjustments, and safety profiles.' },
          { id: 'patient-summary', name: 'Patient Summary Synthesizer', role: 'SOAP & EHR Structuring', tagline: 'EHR records parsing and soap note draft', accent: '#10b981', tag: 'SOAP', description: 'Parses patient history and builds structured SOAP notes or clinical handoff summaries.' },
        ];
        this.activeAgentId = 'clinical-decision';
        this.provider = 'NVIDIA';
        this.model = 'meta/llama-3.1-8b-instruct';
      }
    });
  }

  get activeAgent() {
    return this.agents.find(a => a.id === this.activeAgentId);
  }

  get activeMessages() {
    return this.messages.filter(m => m.agentId === this.activeAgentId);
  }

  selectAgent(agentId: string): void {
    this.activeAgentId = agentId;
    this.scrollToBottom();
  }

  formatMessage(content: string): SafeHtml {
    if (!content) return '';
    // Basic formatting for rendering clinical results nicely with custom styles
    let formatted = content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/🔴/g, '<span style="color:#ef4444">🔴</span>')
      .replace(/🟡/g, '<span style="color:#eab308">🟡</span>')
      .replace(/🟢/g, '<span style="color:#22c55e">🟢</span>')
      .replace(/⚠️/g, '<span style="color:#f59e0b">⚠️</span>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  formatTime(timestamp: Date): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  sendMessage(): void {
    const text = this.composerText.trim();
    if (!text || this.sending) return;

    this.composerText = '';
    
    // Add user message
    const userMsg: ChatMessage = {
      agentId: this.activeAgentId,
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    this.messages.push(userMsg);
    this.scrollToBottom();

    this.sending = true;

    // Get message history for active agent
    const history = this.messages
      .filter(m => m.agentId === this.activeAgentId)
      .map(m => ({ role: m.role, content: m.content }));

    this.http.post<any>('http://localhost:3000/api/chat', {
      agentId: this.activeAgentId,
      messages: history
    }).subscribe({
      next: (res) => {
        const assistantMsg: ChatMessage = {
          agentId: this.activeAgentId,
          role: 'assistant',
          content: res.reply || 'No response received.',
          timestamp: new Date()
        };
        this.messages.push(assistantMsg);
        this.sending = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Chat API failed', err);
        const errorMsg: ChatMessage = {
          agentId: this.activeAgentId,
          role: 'assistant',
          content: `Failed to connect to the clinical agent: ${err.error?.message || err.message || 'Service offline'}.`,
          timestamp: new Date(),
          error: true
        };
        this.messages.push(errorMsg);
        this.sending = false;
        this.scrollToBottom();
      }
    });
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearMessages(): void {
    this.messages = this.messages.filter(m => m.agentId !== this.activeAgentId);
  }

  private scrollToBottom(): void {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      const el = document.getElementById('aiTranscript');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
