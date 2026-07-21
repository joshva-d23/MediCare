import { MediscribeStateType, AuditResult } from "../state";

import { callModel } from "../llmProvider";

/**
 * Node 9 — Consistency Auditor
 *
 * Runs after all 8 agents complete. Audits the full pipeline trace for claim support,
 * unresolved flags, and contradictions between agents, producing a composite trust score.
 */
export async function auditorNode(
  state: MediscribeStateType
): Promise<Partial<MediscribeStateType>> {
  // Extract all flags and claims to determine counts for the trust score formula
  let totalFlags: string[] = [];

  // Extract drug interaction flags
  if (state.drugInteractions) {
    if (Array.isArray(state.drugInteractions)) {
      state.drugInteractions.forEach((di: any) => {
        if (di.flags && Array.isArray(di.flags)) {
          totalFlags = totalFlags.concat(di.flags);
        } else if (di.flag) {
          totalFlags.push(di.flag);
        }
      });
    } else if (typeof state.drugInteractions === "object") {
      const di = state.drugInteractions as any;
      if (di.flags && Array.isArray(di.flags)) {
        totalFlags = totalFlags.concat(di.flags);
      }
    }
  }

  const stateAny = state as any;
  if (stateAny.drugInteraction) {
    const di = stateAny.drugInteraction;
    if (di.flags && Array.isArray(di.flags)) {
      totalFlags = totalFlags.concat(di.flags);
    }
  }

  // Extract risk prediction flags
  if (state.riskPrediction) {
    const rp = state.riskPrediction as any;
    if (rp.flags && Array.isArray(rp.flags)) {
      totalFlags = totalFlags.concat(rp.flags);
    }
  }

  const totalFlagsRaised = totalFlags.length;

  // Extract treatment recommendation claims
  const treatmentClaims = state.treatmentRecommendation?.claims || state.treatmentRecommendation?.candidateActions || [];
  const totalClaims = Array.isArray(treatmentClaims) ? treatmentClaims.length : 0;

  // Construct LLM Prompt
  const systemPrompt = `You are the Consistency Auditor for Mediscribe, a clinical AI decision-support platform.
Your job is to audit the sequential reasoning trace of the upstream agents for clinical consistency, claim support, and contradictions.

You will receive the entire pipeline state serialized as JSON. You must audit the following:
1. CLAIM SUPPORT: For every claim/action in treatmentRecommendation.claims (or treatmentRecommendation.candidateActions), trace it back to citedEvidence across upstream agents (clinicalEvidence, guidelineValidation, evidenceRanking) and confirm the evidence actually supports the claim, rather than just being plausible.
2. UNRESOLVED FLAGS: Check every flag raised in drugInteractions (or drugInteraction) and riskPrediction. Mark any flag that is NOT addressed or reflected in treatmentRecommendation or evidenceRanking as unresolved.
3. CONTRADICTIONS: Detect direct contradictions between any two agents' outputs (e.g. guidelineValidation says X is contraindicated, but treatmentRecommendation recommends X anyway).

You MUST respond with a single JSON block wrapped in standard markdown code fences (\`\`\`json ... \`\`\`).
Do not include any other text before or after the JSON block.

JSON Structure:
{
  "claimSupportScore": 0.9, // Float between 0.0 and 1.0 indicating degree of claim support
  "unresolvedFlags": ["list", "of", "descriptions", "for", "flags", "that", "were", "ignored"],
  "contradictions": [
    {
      "sourceAgent": "AgentName", // e.g. guidelineValidator
      "targetAgent": "AgentName", // e.g. treatmentRecommendation
      "description": "Description of the contradiction"
    }
  ],
  "reasoning": "A concise paragraph explaining your overall audit findings and justification for the scores."
}`;

  const userPrompt = `Here is the current Mediscribe pipeline state as JSON:
${JSON.stringify(state, null, 2)}

Perform the consistency audit and output the JSON response.`;

  let auditResult: AuditResult = {
    claimSupportScore: 1.0,
    unresolvedFlags: [],
    contradictions: [],
    trustScore: 1.0,
    reasoning: "Audit stub: LLM call was not completed successfully.",
  };

  try {
    const response = await callModel({ systemPrompt, messages: [{ role: "user", content: userPrompt }] });
    
    // Parse the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/{[\s\S]*}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      auditResult.claimSupportScore = typeof parsed.claimSupportScore === "number" ? parsed.claimSupportScore : 1.0;
      auditResult.unresolvedFlags = Array.isArray(parsed.unresolvedFlags) ? parsed.unresolvedFlags : [];
      auditResult.contradictions = Array.isArray(parsed.contradictions) ? parsed.contradictions : [];
      auditResult.reasoning = parsed.reasoning || "";
    }
  } catch (err: any) {
    console.error("[ConsistencyAuditor] Error calling LLM or parsing audit result:", err);
    auditResult.reasoning = `Error executing audit LLM: ${err.message}`;
  }

  // Compute composite trustScore using the specified formula:
  // trustScore = 0.4 * claimSupportScore
  //            + 0.3 * (1 - unresolvedFlags.length / max(totalFlagsRaised, 1))
  //            + 0.3 * (1 - contradictions.length / max(totalClaims, 1))
  const unresolvedFlagsCount = auditResult.unresolvedFlags.length;
  const contradictionsCount = auditResult.contradictions.length;

  const flagTerm = 1 - (unresolvedFlagsCount / Math.max(totalFlagsRaised, 1));
  const contradictionTerm = 1 - (contradictionsCount / Math.max(totalClaims, 1));

  const trustScore = 0.4 * auditResult.claimSupportScore + 0.3 * flagTerm + 0.3 * contradictionTerm;

  // Round trustScore to 2 decimal places and clamp between 0 and 1
  auditResult.trustScore = Math.max(0, Math.min(1, Math.round(trustScore * 100) / 100));

  return {
    auditResult,
    auditTrail: [
      {
        agent: "ConsistencyAuditor",
        timestamp: new Date().toISOString(),
        note: `Audited clinical pipeline trace. Trust Score: ${auditResult.trustScore}. Captured ${contradictionsCount} contradictions and ${unresolvedFlagsCount} unresolved flags.`,
      },
    ],
  };
}
