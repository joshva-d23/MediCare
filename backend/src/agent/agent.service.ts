import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { RagService } from '../rag/rag.service';
import { PrismaService } from '../database/prisma.service';
import { PatientsService } from '../patients/patients.service';

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

export interface MessageItem {
  role: string;
  content: string;
}

export interface GraphState {
  messages: MessageItem[];
  activeAgentId: string;
  retrievedContext: string;
}

// ---------------------------------------------------------------------------
// Agent roster types
// ---------------------------------------------------------------------------

export interface AgentSpec {
  id: string;
  name: string;
  role: string;
  tag: string;
  accent: string;
  tagline: string;
  systemPrompt: string;
}

export type AgentRoster = Record<string, AgentSpec>;

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<MessageItem[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  activeAgentId: Annotation<string>({
    reducer: (_x, y) => y ?? _x,
    default: () => 'patient-registry',
  }),
  retrievedContext: Annotation<string>({
    reducer: (_x, y) => y ?? _x,
    default: () => '',
  }),
});

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private model!: ChatOpenAI;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private graph!: any;

  // -------------------------------------------------------------------------
  // Clinical specialists roster
  // -------------------------------------------------------------------------
  public readonly AGENTS_ROSTER: AgentRoster = {
    'patient-registry': {
      id: 'patient-registry',
      name: 'Patient Registry & Intake',
      role: 'Patient Search & Registration',
      tag: 'REG',
      accent: '#10B981',
      tagline: 'Search patients by phone, name, or age, and register admissions',
      systemPrompt: `You are a Patient Registry & Intake AI specialist. You assist doctors and nurses in retrieving patient medical records, searching patient history by name, age, or phone number, and registering new patient admissions. You have access to tools: 'searchPatients', 'getPatientDetails', 'registerPatient', and 'addTreatmentRecord'.
      
When asked to find or search for a patient, use the 'searchPatients' tool.
When asked for details about a patient, use 'getPatientDetails'.
When asked to register a patient, use 'registerPatient'.
When asked to add a treatment record or log vitals, use 'addTreatmentRecord'.

Always display retrieved patient information cleanly in markdown, showing their name, age, phone number, allergies, and history. Keep responses concise and clinical.`,
    },

    'clinical-decision': {
      id: 'clinical-decision',
      name: 'Clinical Decision Support',
      role: 'Differential Diagnosis & Treatment',
      tag: 'CDS',
      accent: '#0EA5E9',
      tagline: 'Evidence-based differential diagnosis and treatment planning',
      systemPrompt: `You are a Clinical Decision Support AI specialist operating within a professional clinical informatics platform. You assist licensed physicians and healthcare providers. Every response must carry an explicit disclaimer that physician review and clinical judgment are mandatory before any action is taken.

CORE CAPABILITIES:
• Analyze presenting symptoms, patient history, vital signs, and laboratory/imaging results provided in context.
• Generate ranked differential diagnoses with mechanistic reasoning, likelihood weighting, and supporting/refuting evidence for each diagnosis.
• Recommend evidence-based diagnostic workup (labs, imaging, specialist referrals) aligned with current clinical guidelines.
• Propose treatment considerations drawn from peer-reviewed literature and recognized guidelines.
• Identify red flags that necessitate urgent or emergent escalation.

RESPONSE STRUCTURE — always use these labeled sections:
─────────────────────────────────────────
**Assessment**
Brief synthesis of the clinical picture based on the information provided.

**Differential Diagnoses**
1. [Diagnosis] — Confidence: [High/Moderate/Low]
   • Supporting findings: …
   • Refuting findings: …

**Recommended Workup**
Prioritized diagnostic steps with clinical rationale.

**Treatment Considerations**
Evidence-based pharmacologic and non-pharmacologic options.

**Red Flags / Urgent Escalation Criteria**
Any features in the presentation that require immediate escalation.

⚠️ DISCLAIMER: This analysis is decision-support for licensed clinicians. All clinical decisions must be approved by a qualified physician.
─────────────────────────────────────────`,
    },

    'drug-safety': {
      id: 'drug-safety',
      name: 'Drug Safety Advisor',
      role: 'Pharmacology & Interactions',
      tag: 'DSA',
      accent: '#F59E0B',
      tagline: 'Pharmacological safety, interactions, and contraindications',
      systemPrompt: `You are a Drug Safety Advisor AI specialist within a clinical informatics platform. You assist licensed pharmacists and physicians with pharmacological safety analysis.

CORE CAPABILITIES:
• Screen for clinically significant drug-drug interactions (DDIs) using interaction severity classifications (Major / Moderate / Minor).
• Identify drug-disease contraindications and precautions based on patient's history.
• Recommend dose adjustments for renal impairment, hepatic impairment, and age-related changes.
• Provide therapeutic alternatives when an agent is contraindicated.

RESPONSE STRUCTURE:
─────────────────────────────────────────
**Medication Review Summary**
List all medications under review with drug class.

**Drug-Drug Interactions**
- Pair: [Drug A] ↔ [Drug B] — Severity: Major / Moderate / Minor
- Management: Monitor / Dose adjust / Avoid / Alternative agent

**Contraindications & Precautions**
Drug-disease interactions with clinical rationale.

**Dose Adjustments & Alternatives**
Renal/hepatic dose adjustments, and safer substitutes where applicable.

⚠️ DISCLAIMER: Recommendations are decision support. Prescribing decisions must be validated by a licensed prescriber.
─────────────────────────────────────────`,
    },

    'patient-summary': {
      id: 'patient-summary',
      name: 'Patient Summary',
      role: 'EHR Analysis & Summarization',
      tag: 'PSA',
      accent: '#8B5CF6',
      tagline: 'Structured clinical summaries & SOAP note drafting',
      systemPrompt: `You are a Patient Summary AI specialist. You transform raw, fragmented EHR data into concise, structured clinical SOAP notes to support care team communication and transitions.

CORE CAPABILITIES:
• Parse and synthesize progress notes, discharge summaries, labs, medications, and problem lists.
• Generate SOAP notes (Subjective, Objective, Assessment, Plan) from encounter data.
• Identify and surface active problems, allergies, recent vitals, and pending follow-ups.

RESPONSE STRUCTURE:
─────────────────────────────────────────
**Patient Snapshot**
Basic demographics and primary reason for current encounter.

**SOAP Summary**
*Subjective*: Chief complaint and symptoms.
*Objective*: Vital signs, physical exams, and lab values.
*Assessment*: Active problem list and working diagnoses.
*Plan*: Medication list, pending orders, and follow-ups.

⚠️ DISCLAIMER: SOAP notes are AI-generated draft summaries and must be verified and signed by the responsible clinician.
─────────────────────────────────────────`,
    },
  };

  // Plain JSON function schemas for tool calling in ChatOpenAI
  private readonly tools = [
    {
      type: 'function' as const,
      function: {
        name: 'searchPatients',
        description: 'Search for patient records in the hospital database by name, phone number, or age.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The patient name, phone number, or age to search for.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'getPatientDetails',
        description: 'Get full details, medical history, allergies, chronic conditions, current medications, and past clinical notes for a specific patient by ID.',
        parameters: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
              description: 'The unique patient ID (e.g. P-4821).',
            },
          },
          required: ['patientId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'registerPatient',
        description: 'Register a new patient intake record in the hospital database.',
        parameters: {
          type: 'object',
          properties: {
            mrn: { type: 'string', description: 'Unique Medical Record Number (e.g., MRN-4821).' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            dateOfBirth: { type: 'string', description: 'ISO date of birth YYYY-MM-DD.' },
            gender: { type: 'string', description: 'MALE | FEMALE | OTHER' },
            phoneNumber: { type: 'string' },
            bloodGroup: { type: 'string', description: 'e.g., O+, A-' },
            allergies: { type: 'array', items: { type: 'string' } },
            chronicConditions: { type: 'array', items: { type: 'string' } },
          },
          required: ['mrn', 'firstName', 'lastName', 'dateOfBirth', 'gender'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'addTreatmentRecord',
        description: "Add a new treatment record, vital signs, prescription, or clinical note to a patient's medical file.",
        parameters: {
          type: 'object',
          properties: {
            patientId: { type: 'string', description: 'The unique patient ID.' },
            recordType: { type: 'string', description: 'VITAL_SIGNS | PRESCRIPTION | LAB_RESULT | IMAGING | PROCEDURE' },
            title: { type: 'string', description: 'Short title for the record.' },
            description: { type: 'string' },
            data: {
              type: 'object',
              description: 'Details. e.g., vitals: { bp: "120/80", hr: 72 }, prescription: { dosage: "10mg" }',
            },
          },
          required: ['patientId', 'recordType', 'title'],
        },
      },
    },
  ];

  constructor(
    private readonly ragService: RagService,
    private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
  ) {}

  onModuleInit(): void {
    this.initModel();
    this.compileGraph();
    // Seed clinical specialists in DB in background — do not await
    void this.seedAgents();
  }

  // -------------------------------------------------------------------------
  // Model initialization
  // -------------------------------------------------------------------------

  private initModel(): void {
    const provider = (process.env.PROVIDER ?? 'nvidia').toLowerCase();

    if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY ?? '';
      this.model = new ChatOpenAI({
        apiKey,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
        modelName: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        temperature: 0.3,
      });
      this.logger.log(`Model initialized: Groq endpoint with model ${process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'}`);
    } else if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY ?? '';
      this.model = new ChatOpenAI({
        apiKey,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
        },
        modelName: process.env.NVIDIA_MODEL ?? 'meta/llama-3.1-8b-instruct',
        temperature: 0.3,
      });
      this.logger.log('Model initialized: NVIDIA endpoint');
    } else {
      // Standard OpenAI
      this.model = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY ?? '',
        modelName: process.env.OPENAI_MODEL ?? 'gpt-4o',
        temperature: 0.3,
      });
      this.logger.log('Model initialized: OpenAI endpoint');
    }
  }

  private compileGraph(): void {
    // --- Retrieval Node ---------------------------------------------------
    const retrieveNode = async (
      state: typeof AgentStateAnnotation.State,
    ): Promise<Partial<typeof AgentStateAnnotation.State>> => {
      this.logger.log('Executing retrieval node...');
      const userMessage = [...state.messages]
        .reverse()
        .find((m) => m.role === 'user');
      let context = '';

      if (userMessage) {
        const results = await this.ragService.hybridSearch(userMessage.content);
        context = results
          .map((r: { source: string; text: string }) => `[Source: ${r.source}] ${r.text}`)
          .join('\n\n');
      }

      return { retrievedContext: context };
    };

    // --- Agent Node with Tool Execution Loop ------------------------------
    const agentNode = async (
      state: typeof AgentStateAnnotation.State,
    ): Promise<Partial<typeof AgentStateAnnotation.State>> => {
      this.logger.log(`Executing specialist node for agent: ${state.activeAgentId}`);

      const agent: AgentSpec =
        this.AGENTS_ROSTER[state.activeAgentId] ??
        this.AGENTS_ROSTER['patient-registry'];

      // Augment system prompt with RAG context when available
      let systemPrompt = agent.systemPrompt;
      if (state.retrievedContext) {
        systemPrompt +=
          `\n\n─────────────────────────────────────────\n` +
          `RETRIEVED CLINICAL KNOWLEDGE BASE CONTEXT:\n` +
          `─────────────────────────────────────────\n` +
          state.retrievedContext;
      }

      // Convert messages to LangChain format
      const formattedMessages = [
        new SystemMessage(systemPrompt),
        ...state.messages.map((m) => {
          if (m.role === 'user') return new HumanMessage(m.content);
          if (m.role === 'tool') return new HumanMessage(`[Tool Output]: ${m.content}`);
          return new AIMessage(m.content);
        }),
      ];

      // Bind tools if using the registry agent
      let modelWithTools: any = this.model;
      if (state.activeAgentId === 'patient-registry') {
        modelWithTools = this.model.bindTools(this.tools as any);
      }

      const response = await modelWithTools.invoke(formattedMessages);

      // Check for tool calls in response
      if (response.additional_kwargs?.tool_calls?.length) {
        const toolCalls = response.additional_kwargs.tool_calls;
        const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        const newMessages: MessageItem[] = [
          { role: 'assistant', content: responseContent || 'Processing request...' }
        ];

        for (const tc of toolCalls) {
          const toolName = tc.function.name;
          const args = JSON.parse(tc.function.arguments);
          this.logger.log(`Agent invoked tool "${toolName}" with parameters: ${tc.function.arguments}`);

          let toolResult = '';
          try {
            if (toolName === 'searchPatients') {
              const res = await this.patientsService.search(args.query);
              toolResult = JSON.stringify(res);
            } else if (toolName === 'getPatientDetails') {
              const patient = await this.patientsService.findOne(args.patientId);
              const records = await this.patientsService.getHealthRecords(args.patientId);
              const notes = await this.patientsService.getClinicalNotes(args.patientId);
              toolResult = JSON.stringify({ patient, records, notes });
            } else if (toolName === 'registerPatient') {
              const res = await this.patientsService.create(args);
              toolResult = `Patient registered successfully: ${JSON.stringify(res)}`;
            } else if (toolName === 'addTreatmentRecord') {
              const res = await this.patientsService.addHealthRecord(args.patientId, {
                recordType: args.recordType,
                title: args.title,
                description: args.description,
                data: args.data || {},
              });
              toolResult = `Treatment record added: ${JSON.stringify(res)}`;
            }
          } catch (err) {
            toolResult = `Error executing tool: ${(err as Error).message}`;
          }

          newMessages.push({ role: 'tool', content: toolResult });
        }

        // Re-call model with tool responses in history
        const secondFormattedMessages = [
          new SystemMessage(systemPrompt),
          ...state.messages.map((m) => {
            if (m.role === 'user') return new HumanMessage(m.content);
            return new AIMessage(m.content);
          }),
          ...newMessages.map((m) => {
            if (m.role === 'tool') return new HumanMessage(`[Tool Output]: ${m.content}`);
            return new AIMessage(m.content);
          }),
        ];

        const secondResponse = await this.model.invoke(secondFormattedMessages);
        const content = typeof secondResponse.content === 'string' ? secondResponse.content : JSON.stringify(secondResponse.content);
        return {
          messages: [
            ...newMessages,
            { role: 'assistant', content }
          ]
        };
      }

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      return {
        messages: [{ role: 'assistant', content }],
      };
    };

    // --- Graph wiring -----------------------------------------------------
    this.graph = new StateGraph(AgentStateAnnotation)
      .addNode('retrieve', retrieveNode)
      .addNode('agent', agentNode)
      .addEdge(START, 'retrieve')
      .addEdge('retrieve', 'agent')
      .addEdge('agent', END)
      .compile();

    this.logger.log('LangGraph compiled successfully with custom tools.');
  }

  async chat(
    agentId: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const inputState = {
      messages: history,
      activeAgentId: agentId,
    };

    try {
      const output = await this.graph.invoke(inputState);

      const assistantMsgs = (
        output.messages as Array<{ role: string; content: string }>
      ).filter((m) => m.role === 'assistant');

      const latestReply =
        assistantMsgs[assistantMsgs.length - 1]?.content ??
        'I encountered an issue generating a response.';

      const lastUserMsg = history[history.length - 1];
      if (lastUserMsg) {
        void this.saveHistory(agentId, lastUserMsg.content, latestReply);
      }

      return latestReply;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Error invoking LangGraph', err);
      throw new Error(`LangGraph execution failed: ${message}`);
    }
  }

  private async seedAgents(): Promise<void> {
    if (!this.prisma.isConnected) {
      this.logger.warn('PostgreSQL is offline. Skipping database seeding.');
      return;
    }
    try {
      for (const agent of Object.values(this.AGENTS_ROSTER)) {
        await this.prisma.agent.upsert({
          where: { id: agent.id },
          update: {
            name: agent.name,
            role: agent.role,
            tagline: agent.tagline,
            accent: agent.accent,
            tag: agent.tag,
          },
          create: {
            id: agent.id,
            name: agent.name,
            role: agent.role,
            tagline: agent.tagline,
            accent: agent.accent,
            tag: agent.tag,
          },
        });
      }
      this.logger.log('Successfully seeded clinical specialists in database.');
    } catch {
      this.logger.warn(
        'Could not seed agents in database (PostgreSQL might be offline).',
      );
    }
  }

  private async saveHistory(
    agentId: string,
    userText: string,
    assistantText: string,
  ): Promise<void> {
    if (!this.prisma.isConnected) return;
    try {
      const exists = await this.prisma.agent.findUnique({
        where: { id: agentId },
      });
      if (!exists) return;

      await this.prisma.message.createMany({
        data: [
          { agentId, role: 'user', content: userText },
          { agentId, role: 'assistant', content: assistantText },
        ],
      });
    } catch {
      // Gracefully ignore
    }
  }
}
