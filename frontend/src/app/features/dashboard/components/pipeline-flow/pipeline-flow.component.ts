import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentOutput, AuditResult } from '../../../../core/services/clinical-pipeline.service';

interface MonitorNode {
  id: string;
  name: string;
  tag: string;
  role: string;
  roleAbbr: string;
  status: 'pending' | 'running' | 'complete' | 'flagged';
  x: number;
  y: number;
  content?: string;
  claims?: string[];
  citedEvidence?: string[];
  confidence?: number;
}

@Component({
  selector: 'app-pipeline-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="trace-monitor-card">
      <div class="monitor-screen">
        <!-- Faint Ruled Grid Overlay -->
        <div class="monitor-grid-overlay"></div>
        
        <div class="monitor-layout">
          <!-- Horizontal Waveform Trace -->
          <div class="trace-flow-area">
            <svg class="trace-svg" viewBox="0 0 1000 80" preserveAspectRatio="none">
              <!-- Background Dotted Trace -->
              <path [attr.d]="backgroundPath" class="trace-bg-path"></path>
              <!-- Active Drawing Trace -->
              <path [attr.d]="activePath" class="trace-active-path"></path>
              <!-- Lead Glow Circle at furthest drawn point -->
              <circle 
                *ngIf="leadPoint" 
                [attr.cx]="leadPoint.x + '%'" 
                [attr.cy]="leadPoint.y" 
                r="4.5" 
                class="trace-lead-glow"
              ></circle>
            </svg>
            
            <!-- Nodes Interactive Layers -->
            <div 
              *ngFor="let node of nodes; let idx = index" 
              class="monitor-node-wrap" 
              [style.left]="node.x + '%'"
              [class.pending]="node.status === 'pending'"
              [class.running]="node.status === 'running'"
              [class.complete]="node.status === 'complete'"
              [class.flagged]="node.status === 'flagged'"
              [class.selected]="selectedAgentId === node.id"
              (click)="selectNode(node)"
            >
              <div class="monitor-node-dot">
                <span class="dot-num" *ngIf="node.status === 'pending'">{{ idx + 1 }}</span>
                <div class="dot-spinner" *ngIf="node.status === 'running'"></div>
                <svg class="dot-icon check" *ngIf="node.status === 'complete'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg class="dot-icon warning" *ngIf="node.status === 'flagged'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              </div>
              
              <div class="monitor-node-meta">
                <span class="node-tag">{{ node.tag }}</span>
                <span class="node-role-abbr">{{ node.roleAbbr }}</span>
              </div>
            </div>
          </div>
          
          <!-- final monitor readout panel -->
          <div class="readout-panel" [class.active]="runCompleted && auditResult">
            <span class="readout-label">Trust Index</span>
            <div class="readout-numeral-wrap">
              <span class="readout-numeral">{{ displayScore !== null ? displayScore : '--' }}</span>
              <span class="readout-unit">%</span>
            </div>
            <div class="readout-status" [class.optimal]="auditResult && auditResult.trustScore >= 0.9" [class.variance]="auditResult && auditResult.trustScore < 0.9">
              {{ auditResult ? (auditResult.trustScore >= 0.9 ? 'Optimal' : 'Variance') : 'Standby' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Inline Editorial Details Panel with smooth height transition -->
      <div class="inline-details-panel" [class.open]="selectedAgent">
        <div class="inline-details-inner" *ngIf="selectedAgent">
          <div class="details-header">
            <div class="agent-title-row">
              <h4 class="agent-details-title">{{ selectedAgent.name }}</h4>
              <span class="agent-details-role">{{ selectedAgent.role }}</span>
              <span class="agent-details-badge">{{ selectedAgent.tag }}</span>
            </div>
            <button class="details-close-btn" (click)="closeDetails()" aria-label="Close details">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="details-body-prose">
            <h5 class="prose-section-title">Clinical Synthesis</h5>
            <p class="prose-text">{{ selectedAgent.content }}</p>
            
            <div class="details-meta-grid">
              <div class="meta-column" *ngIf="selectedAgent.claims && selectedAgent.claims.length > 0">
                <span class="meta-label">Decisions & Claims</span>
                <ul class="meta-list">
                  <li *ngFor="let claim of selectedAgent.claims">{{ claim }}</li>
                </ul>
              </div>
              
              <div class="meta-column" *ngIf="selectedAgent.citedEvidence && selectedAgent.citedEvidence.length > 0">
                <span class="meta-label">Clinical Sources</span>
                <div class="sources-pill-wrap">
                  <span class="source-pill" *ngFor="let source of selectedAgent.citedEvidence">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/></svg>
                    {{ source }}
                  </span>
                </div>
              </div>

              <div class="meta-column" *ngIf="selectedAgent.confidence">
                <span class="meta-label">Execution Confidence</span>
                <div class="confidence-flex">
                  <span class="confidence-value">{{ selectedAgent.confidence * 100 | number:'1.0-0' }}%</span>
                  <div class="confidence-bar-bg">
                    <div class="confidence-bar-fill" [style.width]="(selectedAgent.confidence * 100) + '%'" [class.high]="selectedAgent.confidence >= 0.9"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .trace-monitor-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      box-shadow: var(--shadow);
      font-family: var(--font-body);
      overflow: hidden;
      animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .monitor-screen {
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      position: relative;
      overflow: hidden;
      height: 110px;
    }

    .monitor-grid-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background-size: 20px 20px;
      background-image: 
        linear-gradient(to right, rgba(31, 111, 99, 0.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(31, 111, 99, 0.04) 1px, transparent 1px);
    }

    .monitor-layout {
      position: relative;
      z-index: 2;
      display: flex;
      height: 100%;
    }

    .trace-flow-area {
      flex: 1;
      position: relative;
      height: 100%;
    }

    .trace-svg {
      width: 100%;
      height: 100%;
      display: block;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .trace-bg-path {
      stroke: var(--border-bright);
      stroke-width: 1.5;
      fill: none;
      stroke-dasharray: 2 4;
    }

    .trace-active-path {
      stroke: var(--accent);
      stroke-width: 2.5;
      fill: none;
      transition: d 200ms ease-in-out;
    }

    .trace-lead-glow {
      fill: var(--accent);
      animation: leadPulse 1.2s infinite ease-in-out;
    }

    @keyframes leadPulse {
      0%, 100% { r: 3.5px; opacity: 1; filter: drop-shadow(0 0 1px var(--accent)); }
      50% { r: 6px; opacity: 0.6; filter: drop-shadow(0 0 4px var(--accent)); }
    }

    .monitor-node-wrap {
      position: absolute;
      top: 40px;
      transform: translate(-50%, -50%);
      width: 68px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: default;
      z-index: 3;
      transition: transform 150ms ease-out;

      &.complete, &.flagged {
        cursor: pointer;
        
        &:hover {
          transform: translate(-50%, -50%) scale(1.05);
        }
      }
    }

    .monitor-node-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--bg-panel);
      border: 1.5px solid var(--border-bright);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--text-dim);
      transition: all 250ms var(--ease-smooth);

      .monitor-node-wrap.running & {
        border-color: var(--accent);
        color: var(--accent);
        box-shadow: 0 0 14px var(--accent-glow);
        animation: pulseGlow 1.5s infinite ease-in-out;
      }

      .monitor-node-wrap.complete & {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
        animation: scalePop 0.4s var(--ease-spring) both;
      }

      .monitor-node-wrap.flagged & {
        background: var(--error);
        border-color: var(--error);
        color: #fff;
        animation: scalePop 0.4s var(--ease-spring) both;
      }

      .monitor-node-wrap.selected & {
        box-shadow: 0 0 0 3.5px rgba(31, 111, 99, 0.35);
      }
    }

    @keyframes scalePop {
      0% { transform: scale(0.85); }
      70% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    .dot-num {
      font-family: var(--font-mono);
    }

    .dot-icon {
      width: 10px;
      height: 10px;
      color: #fff;
      display: block;
    }

    .dot-spinner {
      width: 10px;
      height: 10px;
      border: 1.5px solid transparent;
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .monitor-node-meta {
      margin-top: 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }

    .node-tag {
      font-family: var(--font-mono);
      font-size: 0.58rem;
      font-weight: 700;
      color: var(--text-dim);
      background: var(--bg-panel);
      padding: 1px 3px;
      border-radius: 3px;
      border: 1.5px solid var(--border);
      line-height: 1;

      .monitor-node-wrap.running & {
        color: var(--accent);
        border-color: var(--accent);
      }

      .monitor-node-wrap.complete & {
        color: var(--accent);
        border-color: var(--accent);
      }

      .monitor-node-wrap.flagged & {
        color: var(--error);
        border-color: var(--error);
      }
    }

    .node-role-abbr {
      font-size: 0.62rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* final monitor readout panel */
    .readout-panel {
      width: 130px;
      border-left: 1px solid var(--border);
      background: var(--bg-panel);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
      flex-shrink: 0;

      &.active {
        background: rgba(31, 111, 99, 0.025);
        box-shadow: inset -2px 0 14px var(--accent-glow);
        animation: pulseGlow 3s infinite ease-in-out;
      }
    }

    .readout-label {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }

    .readout-numeral-wrap {
      display: flex;
      align-items: baseline;
      margin: 2px 0;
    }

    .readout-numeral {
      font-family: var(--font-mono);
      font-size: 2.2rem;
      font-weight: 500;
      color: var(--text-dim);
      line-height: 1;

      .readout-panel.active & {
        color: var(--accent);
      }
    }

    .readout-unit {
      font-family: var(--font-mono);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-dim);
      margin-left: 1px;

      .readout-panel.active & {
        color: var(--accent);
      }
    }

    .readout-status {
      font-size: 0.58rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg-deep);
      color: var(--text-dim);
      font-family: var(--font-mono);

      &.optimal {
        background: rgba(31, 111, 99, 0.06);
        color: var(--accent);
      }

      &.variance {
        background: rgba(194, 139, 48, 0.06);
        color: var(--error);
      }
    }

    /* Inline Expanded details panel CSS Grid Height animation */
    .inline-details-panel {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 250ms var(--ease-smooth), opacity 250ms var(--ease-smooth);
      opacity: 0;
      overflow: hidden;

      &.open {
        grid-template-rows: 1fr;
        opacity: 1;
        margin-top: 14px;
        border-top: 1px solid var(--border);
        padding-top: 14px;
      }
    }

    .inline-details-inner {
      min-height: 0;
    }

    .details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .agent-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .agent-details-title {
      font-family: var(--font-body);
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .agent-details-role {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .agent-details-badge {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--text-dim);
      background: var(--bg-deep);
      border: 1px solid var(--border);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .details-close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 4px;
      transition: all 150ms ease-out;

      &:hover {
        background: var(--bg-deep);
        color: var(--text);
      }
    }

    .details-body-prose {
      padding: 8px 0 0 0;
    }

    .prose-section-title {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 500;
      color: var(--accent);
      margin: 0 0 6px;
    }

    .prose-text {
      font-size: 0.8rem;
      line-height: 1.6;
      color: var(--text);
      margin: 0 0 12px;
      font-weight: 400;
    }

    .details-meta-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-top: 1px dashed var(--border);
      padding-top: 10px;
    }

    .meta-column {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .meta-label {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }

    .meta-list {
      margin: 0;
      padding-left: 14px;
      
      li {
        font-size: 0.75rem;
        line-height: 1.45;
        color: var(--text-muted);
        margin-bottom: 2px;
        
        &::marker {
          color: var(--accent);
        }
      }
    }

    .sources-pill-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .source-pill {
      font-size: 0.68rem;
      font-weight: 500;
      color: var(--text);
      background: var(--clinical-bg);
      border: 1px solid var(--clinical-border);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      display: inline-flex;
      align-items: center;
      gap: 4px;

      svg {
        color: var(--accent);
        flex-shrink: 0;
      }
    }

    .confidence-flex {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .confidence-value {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .confidence-bar-bg {
      flex: 1;
      height: 3px;
      background: var(--bg-deep);
      border-radius: 1.5px;
      overflow: hidden;
      max-width: 120px;
    }

    .confidence-bar-fill {
      height: 100%;
      background: var(--error);
      border-radius: inherit;

      &.high {
        background: var(--accent);
      }
    }
  `]
})
export class PipelineFlowComponent implements OnChanges, OnDestroy {
  @Input() agents: AgentOutput[] = [];
  @Input() auditResult: AuditResult | null = null;
  
  nodes: MonitorNode[] = [];
  selectedAgentId: string | null = null;
  selectedAgent: MonitorNode | null = null;
  
  displayScore: number | null = null;
  runCompleted = false;
  private animationInterval: any = null;

  readonly POINTS = [
    { x: 5, y: 40, roleAbbr: 'Extract' },
    { x: 16, y: 40, roleAbbr: 'Evidence' },
    { x: 27, y: 40, roleAbbr: 'Guideline' },
    { x: 38, y: 40, roleAbbr: 'Safety' },
    { x: 49, y: 40, roleAbbr: 'Risk' },
    { x: 60, y: 40, roleAbbr: 'Recommend' },
    { x: 71, y: 40, roleAbbr: 'Ranking' },
    { x: 82, y: 40, roleAbbr: 'Explain' },
    { x: 93, y: 40, roleAbbr: 'Auditor' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    this.rebuildNodes();
    
    const isCompleted = this.agents.every(a => a.status === 'complete' || a.status === 'flagged') && this.agents.length > 0;
    
    if (isCompleted && this.auditResult) {
      if (!this.runCompleted) {
        this.runCompleted = true;
        this.animateScore();
      }
    } else {
      this.runCompleted = false;
      this.displayScore = null;
      if (this.animationInterval) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
      }
    }
  }

  rebuildNodes(): void {
    if (this.agents.length === 0) {
      this.nodes = this.POINTS.map((pt, idx) => ({
        id: idx < 8 ? `agent-${idx}` : 'auditor',
        name: idx < 8 ? `Agent ${idx + 1}` : 'Consistency Auditor',
        tag: idx < 8 ? ['PHE', 'CER', 'GLV', 'DIC', 'RPC', 'TRE', 'EVR', 'EXG'][idx] : 'AUD',
        role: idx < 8 ? ['Patient History Extraction', 'Clinical Evidence Retrieval', 'Guideline Validation', 'Drug Interaction Check', 'Risk Prediction', 'Treatment Recommendation', 'Evidence Ranking', 'Explainability Generation'][idx] : 'Consistency Auditor',
        roleAbbr: pt.roleAbbr,
        status: 'pending',
        x: pt.x,
        y: pt.y
      }));
      return;
    }

    this.nodes = this.POINTS.map((pt, idx) => {
      if (idx < 8) {
        const agent = this.agents[idx] || { status: 'pending', name: '', tag: '', role: '' };
        return {
          id: agent.id || `agent-${idx}`,
          name: agent.name,
          tag: agent.tag || ['PHE', 'CER', 'GLV', 'DIC', 'RPC', 'TRE', 'EVR', 'EXG'][idx],
          role: agent.role,
          roleAbbr: pt.roleAbbr,
          status: agent.status,
          x: pt.x,
          y: pt.y,
          content: agent.content,
          claims: agent.claims,
          citedEvidence: agent.citedEvidence,
          confidence: agent.confidence
        };
      } else {
        let status: 'pending' | 'running' | 'complete' | 'flagged' = 'pending';
        if (this.auditResult) {
          status = this.auditResult.trustScore >= 0.9 ? 'complete' : 'flagged';
        } else if (this.agents.every(a => a.status === 'complete' || a.status === 'flagged')) {
          status = 'running';
        }
        
        return {
          id: 'auditor',
          name: 'Consistency Auditor',
          tag: 'AUD',
          role: 'Multi-Agent Logic Auditor',
          roleAbbr: pt.roleAbbr,
          status: status,
          x: pt.x,
          y: pt.y,
          content: this.auditResult?.reasoning || 'Consistency Auditor verifies multi-agent reasoning paths for logic contradictions and safety flags.',
          claims: this.auditResult?.unresolvedFlags || [],
          citedEvidence: this.auditResult?.contradictions.map(c => `${c.sourceAgent} ⟷ ${c.targetAgent}: ${c.description}`) || []
        };
      }
    });

    if (this.selectedAgentId) {
      const found = this.nodes.find(n => n.id === this.selectedAgentId);
      this.selectedAgent = found && found.status !== 'pending' && found.status !== 'running' ? found : null;
    }
  }

  animateScore(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    if (!this.auditResult) {
      this.displayScore = null;
      return;
    }
    const target = Math.round(this.auditResult.trustScore * 100);
    const duration = 750; // ms
    const startTime = Date.now();

    this.animationInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress);
      this.displayScore = Math.round(easeProgress * target);

      if (progress >= 1) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
      }
    }, 16);
  }

  get backgroundPath(): string {
    let d = `M ${this.POINTS[0].x}% 40`;
    for (let i = 1; i < this.POINTS.length; i++) {
      d += ` L ${this.POINTS[i].x}% 40`;
    }
    return d;
  }

  get activePath(): string {
    if (this.nodes.length === 0) return '';
    
    let d = `M ${this.POINTS[0].x}% 40`;
    
    let furthestIdx = -1;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].status !== 'pending') {
        furthestIdx = i;
      }
    }
    
    if (furthestIdx === -1) return '';

    for (let i = 1; i <= furthestIdx; i++) {
      const p1 = this.POINTS[i - 1];
      const p2 = this.POINTS[i];
      const nodeStatus = this.nodes[i].status;
      
      const isFlagged = nodeStatus === 'flagged';
      
      if (isFlagged) {
        const midX = (p1.x + p2.x) / 2;
        d += ` L ${midX - 2.5}% 40 L ${midX - 1}% 45 L ${midX}% 10 L ${midX + 1}% 70 L ${midX + 2}% 38 L ${midX + 3.5}% 40 L ${p2.x}% 40`;
      } else {
        d += ` L ${p2.x}% 40`;
      }
    }
    return d;
  }

  get leadPoint(): MonitorNode | null {
    if (this.nodes.length === 0) return null;
    
    let activeNode: MonitorNode | null = null;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].status === 'running') {
        return this.nodes[i];
      }
      if (this.nodes[i].status !== 'pending') {
        activeNode = this.nodes[i];
      }
    }
    return activeNode;
  }

  selectNode(node: MonitorNode): void {
    if (node.status === 'pending' || node.status === 'running') return;
    this.selectedAgentId = this.selectedAgentId === node.id ? null : node.id;
    this.selectedAgent = this.selectedAgentId ? node : null;
  }

  closeDetails(): void {
    this.selectedAgentId = null;
    this.selectedAgent = null;
  }

  ngOnDestroy(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
  }
}
