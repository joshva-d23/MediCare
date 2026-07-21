import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import {
  createJiraTicket,
  sendSlackAlert,
  sendEmail,
  blockDocument,
} from './mock-integrations';

const logger = new Logger('ComplianceGraph');

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

export const ComplianceStateAnnotation = Annotation.Root({
  documentId:        Annotation<string>({ reducer: (_x, y) => y, default: () => '' }),
  documentContent:   Annotation<string>({ reducer: (_x, y) => y, default: () => '' }),
  documentType:      Annotation<string>({ reducer: (_x, y) => y, default: () => 'claim' }),

  complianceRules:   Annotation<any[]>({ reducer: (_x, y) => y, default: () => [] }),
  retrievedPolicies: Annotation<any[]>({ reducer: (_x, y) => y, default: () => [] }),

  issuesFound:       Annotation<any[]>({ reducer: (_x, y) => y, default: () => [] }),
  riskScore:         Annotation<number>({ reducer: (_x, y) => y, default: () => 0 }),
  confidence:        Annotation<number>({ reducer: (_x, y) => y, default: () => 0 }),

  decision:          Annotation<string>({ reducer: (_x, y) => y, default: () => '' }),
  decisionReasoning: Annotation<string>({ reducer: (_x, y) => y, default: () => '' }),
  actions:           Annotation<any[]>({ reducer: (_x, y) => y, default: () => [] }),

  auditLog:          Annotation<any[]>({ reducer: (x, y) => x.concat(y), default: () => [] }),

  // SSE emitter injected externally
  emitStep:          Annotation<((step: string, data: any) => void) | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});

export type ComplianceState = typeof ComplianceStateAnnotation.State;

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

function addAudit(state: ComplianceState, step: string, details: Record<string, any>) {
  const entry = { step, timestamp: new Date().toISOString(), ...details };
  if (state.emitStep) state.emitStep(step, details);
  return entry;
}

async function callClaude(prompt: string, maxTokens = 1200): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model  = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  return (response.content[0] as { text: string }).text;
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    // strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// NODE 1 — RETRIEVE CONTEXT
// ─────────────────────────────────────────────────────────────

async function retrieveContext(state: ComplianceState) {
  logger.log(`[RETRIEVE] ${state.documentId}`);
  const t0 = Date.now();

  // Import PrismaService lazily to avoid circular dep in graph
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  let complianceRules: any[] = [];
  try {
    const rules = await prisma.complianceRule.findMany({
      where: { active: true },
    });
    complianceRules = rules.map(r => ({
      ruleId:   r.id,
      name:     r.ruleName,
      text:     r.ruleText,
      severity: r.severity,
      category: r.category,
    }));
    await prisma.$disconnect();
  } catch (err) {
    logger.warn('Could not fetch compliance rules from DB — using defaults');
    complianceRules = DEFAULT_RULES;
  }

  const duration = Date.now() - t0;
  const auditEntry = addAudit(state, 'retrieve_context', {
    rulesFound:     complianceRules.length,
    policiesFound:  0,
    durationMs:     duration,
  });

  return {
    complianceRules,
    retrievedPolicies: [] as any[],
    auditLog: [auditEntry],
  };
}

// ─────────────────────────────────────────────────────────────
// NODE 2 — COMPLIANCE CHECKER
// ─────────────────────────────────────────────────────────────

async function complianceChecker(state: ComplianceState) {
  logger.log(`[COMPLIANCE_CHECK] ${state.documentId}`);
  const t0 = Date.now();

  const rulesText = state.complianceRules
    .map((r, i) => `${i + 1}. [${r.severity}] ${r.text ?? r.ruleText}`)
    .join('\n');

  const docSnippet = state.documentContent.slice(0, 2500);

  const prompt = `You are a compliance analyst. Analyze this document against the rules below.

DOCUMENT:
${docSnippet}

COMPLIANCE RULES:
${rulesText}

For each rule, determine:
1. Does this document violate it? (true/false)
2. If true, describe the violation.
3. Severity: CRITICAL, HIGH, MEDIUM, or LOW

Return a JSON array ONLY — no other text, no markdown fences:
[
  {
    "rule": "rule text",
    "violated": true,
    "violationDescription": "description of the violation",
    "severity": "HIGH"
  }
]`;

  let issuesFound: any[] = [];
  try {
    const raw = await callClaude(prompt, 1500);
    const parsed: any[] = safeParseJSON(raw, []);
    issuesFound = parsed.filter(v => v.violated === true);
  } catch (err) {
    logger.error('Compliance check LLM error:', err);
  }

  const duration = Date.now() - t0;
  const auditEntry = addAudit(state, 'compliance_check', {
    rulesChecked:    state.complianceRules.length,
    violationsFound: issuesFound.length,
    violations:      issuesFound,
    durationMs:      duration,
  });

  return { issuesFound, auditLog: [auditEntry] };
}

// ─────────────────────────────────────────────────────────────
// NODE 3 — RISK RANKER
// ─────────────────────────────────────────────────────────────

async function riskRanker(state: ComplianceState) {
  logger.log(`[RISK_RANK] ${state.documentId}`);
  const t0 = Date.now();

  let riskScore = 0;
  let confidence = 1.0;

  if (state.issuesFound.length === 0) {
    riskScore  = 0.5;
    confidence = 1.0;
  } else {
    const violationsText = JSON.stringify(state.issuesFound, null, 2);
    const prompt = `You are a risk assessment expert. Score the compliance risk (0.0 – 10.0).

VIOLATIONS FOUND:
${violationsText}

DOCUMENT TYPE: ${state.documentType}

Consider:
- Severity of each violation (CRITICAL = heavy penalty)
- Number of violations
- Document type risk profile
- Regulatory impact

Return JSON ONLY — no markdown, no extra text:
{
  "riskScore": 7.5,
  "reasoning": "brief explanation",
  "confidence": 0.92
}`;

    try {
      const raw = await callClaude(prompt, 400);
      const data: any = safeParseJSON(raw, {});
      riskScore  = typeof data.riskScore  === 'number' ? data.riskScore  : 5.0;
      confidence = typeof data.confidence === 'number' ? data.confidence : 0.7;
    } catch {
      riskScore  = 5.0;
      confidence = 0.5;
    }
  }

  const duration = Date.now() - t0;
  const auditEntry = addAudit(state, 'risk_ranking', {
    riskScore,
    confidence,
    durationMs: duration,
  });

  return { riskScore, confidence, auditLog: [auditEntry] };
}

// ─────────────────────────────────────────────────────────────
// NODE 4 — DECISION MAKER
// ─────────────────────────────────────────────────────────────

async function decisionMaker(state: ComplianceState) {
  logger.log(`[DECISION_MAKER] ${state.documentId}`);
  const t0 = Date.now();

  const violationsText = state.issuesFound.length
    ? JSON.stringify(state.issuesFound, null, 2)
    : 'None';

  const prompt = `You are an autonomous compliance agent. Make a final decision on this document.

DOCUMENT ID: ${state.documentId}
DOCUMENT TYPE: ${state.documentType}
RISK SCORE: ${state.riskScore.toFixed(1)}/10
VIOLATIONS DETECTED:
${violationsText}

Decision logic:
- APPROVE: Risk < 3.0 AND no CRITICAL violations
- REJECT:  Risk > 7.0 OR any CRITICAL violation
- ESCALATE: anything in between (3.0 ≤ risk ≤ 7.0 OR HIGH violations)

Then list actions to execute. Allowed action types:
- "create_ticket"   { type, priority, label }
- "send_alert"      { type, channel, message }
- "block_document"  { type }
- "send_email"      { type, recipient, subject }

Return JSON ONLY — no markdown, no extra text:
{
  "decision": "APPROVE",
  "reasoning": "Why this decision was made (2-3 sentences).",
  "confidence": 0.95,
  "actions": [
    { "type": "send_alert", "channel": "#compliance-alerts", "message": "Approved: ${state.documentId}" }
  ]
}`;

  let decision          = 'ESCALATE';
  let decisionReasoning = 'Error parsing decision — escalated for manual review.';
  let actions: any[]    = [{ type: 'create_ticket', priority: 'HIGH', label: `Manual Review: ${state.documentId}` }];
  let conf              = 0.7;

  try {
    const raw  = await callClaude(prompt, 800);
    const data: any = safeParseJSON(raw, {});
    decision          = data.decision          ?? 'ESCALATE';
    decisionReasoning = data.reasoning         ?? decisionReasoning;
    actions           = Array.isArray(data.actions) ? data.actions : actions;
    conf              = typeof data.confidence === 'number' ? data.confidence : conf;
  } catch (err) {
    logger.error('Decision maker LLM error:', err);
  }

  const duration = Date.now() - t0;
  const auditEntry = addAudit(state, 'decision_made', {
    decision,
    confidence: conf,
    actionsCount: actions.length,
    durationMs:   duration,
  });

  return { decision, decisionReasoning, actions, auditLog: [auditEntry] };
}

// ─────────────────────────────────────────────────────────────
// NODE 5 — ACTION EXECUTOR
// ─────────────────────────────────────────────────────────────

async function actionExecutor(state: ComplianceState) {
  logger.log(`[ACTION_EXECUTOR] Executing ${state.actions.length} action(s)`);
  const t0 = Date.now();

  const executedActions: any[] = [];

  for (const action of state.actions) {
    try {
      let resultId = '';

      switch (action.type) {
        case 'create_ticket':
          resultId = await createJiraTicket({
            title:       action.label ?? `Compliance Review: ${state.documentId}`,
            description: `Document: ${state.documentId}\nDecision: ${state.decision}\nReason: ${state.decisionReasoning}`,
            priority:    action.priority ?? 'MEDIUM',
            assignee:    'compliance-team',
          });
          break;

        case 'send_alert':
          resultId = await sendSlackAlert({
            channel: action.channel ?? '#compliance-alerts',
            message: action.message ?? `${state.decision} on ${state.documentId} — ${state.decisionReasoning}`,
          });
          break;

        case 'block_document':
          await blockDocument(state.documentId);
          resultId = state.documentId;
          break;

        case 'send_email':
          resultId = await sendEmail({
            to:      action.recipient ?? 'compliance@example.com',
            subject: action.subject   ?? `Document Status: ${state.decision}`,
            body:    `Your document ${state.documentId} has been ${state.decision.toLowerCase()}d.\n\nReason: ${state.decisionReasoning}`,
          });
          break;

        default:
          logger.warn(`Unknown action type: ${action.type}`);
      }

      executedActions.push({ ...action, status: 'SUCCESS', resultId });
    } catch (err: any) {
      executedActions.push({ ...action, status: 'FAILED', error: err.message });
    }
  }

  const duration = Date.now() - t0;
  const auditEntry = addAudit(state, 'actions_executed', {
    actionsCount:  executedActions.length,
    successCount:  executedActions.filter(a => a.status === 'SUCCESS').length,
    failureCount:  executedActions.filter(a => a.status === 'FAILED').length,
    durationMs:    duration,
  });

  return { actions: executedActions, auditLog: [auditEntry] };
}

// ─────────────────────────────────────────────────────────────
// BUILD GRAPH
// ─────────────────────────────────────────────────────────────

export function buildComplianceGraph() {
  const workflow = new StateGraph(ComplianceStateAnnotation)
    .addNode('retrieve',         retrieveContext)
    .addNode('compliance_check', complianceChecker)
    .addNode('risk_rank',        riskRanker)
    .addNode('decide',           decisionMaker)
    .addNode('execute',          actionExecutor)
    .addEdge(START,              'retrieve')
    .addEdge('retrieve',         'compliance_check')
    .addEdge('compliance_check', 'risk_rank')
    .addEdge('risk_rank',        'decide')
    .addEdge('decide',           'execute')
    .addEdge('execute',          END);

  return workflow.compile();
}

// ─────────────────────────────────────────────────────────────
// DEFAULT RULES (used when DB is unavailable)
// ─────────────────────────────────────────────────────────────

const DEFAULT_RULES = [
  { ruleId: 'd1', name: 'Fraud Indicators',       text: 'The document must not contain signs of falsified information, duplicate claim numbers, or inconsistent dates.', severity: 'CRITICAL', category: 'fraud_detection' },
  { ruleId: 'd2', name: 'Coverage Validation',    text: 'The claimed amount must fall within the policy coverage limits stated in the policyholder record.', severity: 'HIGH', category: 'coverage_check' },
  { ruleId: 'd3', name: 'Documentation Complete', text: 'All required supporting documents must be referenced: incident report, medical records (if applicable), and proof of ownership.', severity: 'HIGH', category: 'policy_validation' },
  { ruleId: 'd4', name: 'Time Limit Compliance',  text: 'The claim must be filed within 30 days of the incident date as per standard policy terms.', severity: 'MEDIUM', category: 'policy_validation' },
  { ruleId: 'd5', name: 'Identity Verification',  text: 'Policyholder identity must be verifiable through matching name, policy number, and date of birth.', severity: 'HIGH', category: 'fraud_detection' },
  { ruleId: 'd6', name: 'Geographic Coverage',    text: 'The incident must have occurred within the geographic coverage area specified in the policy.', severity: 'MEDIUM', category: 'coverage_check' },
];
