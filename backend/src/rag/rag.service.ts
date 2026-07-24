import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { HuggingFaceEmbeddings } from './huggingface-embeddings';
import { randomUUID } from 'crypto';

interface InMemoryDoc {
  text: string;
  metadata: any;
  embedding: number[];
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private qdrantClient: QdrantClient;
  private qdrantActive = false;
  
  private inMemoryStore: InMemoryDoc[] = [];
  private embeddingsClient: HuggingFaceEmbeddings;

  constructor() {
    const apiKey = process.env.HF_ACCESS_TOKEN || '';
    const modelName = process.env.HF_EMBEDDINGS_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
    this.embeddingsClient = new HuggingFaceEmbeddings({ apiKey, modelName });
  }

  async onModuleInit() {
    // Check connections asynchronously in background so server boots immediately
    this.checkDatabaseConnections();

    // Seed context docs in memory asynchronously
    this.seedInMemoryStore();
  }

  private async checkDatabaseConnections() {
    // Initialize Qdrant Client
    try {
      this.qdrantClient = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
      });
      
      // Perform ping with 1.5s timeout
      await Promise.race([
        this.qdrantClient.getCollections(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1500))
      ]);

      // Get embedding size dynamically
      let embeddingSize = 384;
      try {
        const testEmbedding = await this.embeddingsClient.embedQuery('test');
        embeddingSize = testEmbedding.length;
        this.logger.log(`HuggingFace embeddings active. Vector dimension: ${embeddingSize}`);
      } catch (err) {
        this.logger.error(`Failed to get embedding size from Hugging Face: ${err.message}. Defaulting to 384.`);
      }
      
      // Verify/Create collection
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(c => c.name === 'bureau_collection');
      if (exists) {
        try {
          const info = await this.qdrantClient.getCollection('bureau_collection');
          const currentSize = info.config?.params?.vectors?.size;
          if (currentSize !== embeddingSize) {
            this.logger.warn(`Vector size mismatch in Qdrant (existing: ${currentSize}, new: ${embeddingSize}). Recreating bureau_collection...`);
            await this.qdrantClient.deleteCollection('bureau_collection');
            await this.qdrantClient.createCollection('bureau_collection', {
              vectors: {
                size: embeddingSize,
                distance: 'Cosine'
              }
            });
            this.logger.log('Recreated Qdrant collection with correct dimensions.');
          }
        } catch (err) {
          this.logger.error('Failed to verify existing Qdrant collection details', err);
        }
      } else {
        await this.qdrantClient.createCollection('bureau_collection', {
          vectors: {
            size: embeddingSize,
            distance: 'Cosine'
          }
        });
        this.logger.log(`Created Qdrant collection: bureau_collection with size ${embeddingSize}`);
      }

      this.qdrantActive = true;
      this.logger.log('Connected to Qdrant successfully.');
    } catch (err) {
      this.logger.warn('Qdrant is offline. Running vector search in mock/in-memory mode.');
    }
  }

  private async seedInMemoryStore() {
    this.logger.log('Embedding and seeding workspace docs in-memory...');
    const seedDocs = [
      {
        text: `Workspace Config: "The Bureau" is an advanced AI collaborative workspace composed of 5 core specialist agents: Strategist (Business & Planning, accent #C8643A), Coder (Software & Debugging, accent #5E7C99), Wordsmith (Writing & Storytelling, accent #D4A24C), Analyst (Data & Research, accent #7C9473), and Coach (Focus & Accountability, accent #9C5066).`,
        metadata: { source: 'System Local Memory', category: 'workspace' }
      },
      {
        text: `Theme Settings: The application features a dynamic theme toggle. To switch between Light Mode (default vibrant glassmorphic UI) and Dark Mode, click the Sun/Moon button next to "Staff Directory" in the sidebar roster header. The selected theme will persist in localStorage.`,
        metadata: { source: 'System Local Memory', category: 'theme' }
      },
      {
        text: `Dynamic Island Interface: The pill-shaped dynamic island widget at the top of the interface displays active specialist status, current LLM model/provider (Groq), and chat message counts. It pulses and transitions between boot, idle, thinking, and compact/expanded states dynamically.`,
        metadata: { source: 'System Local Memory', category: 'ui' }
      },
      {
        text: `Backend Architecture: The backend service is built using NestJS (TypeScript), running Express routes on port 3000. It coordinates agents via LangGraph.js StateGraph state-machines and integrates a HuggingFace vector retriever.`,
        metadata: { source: 'System Local Memory', category: 'backend' }
      },
      {
        text: `LLM Endpoint Provider: The primary LLM orchestrator uses the Groq API (baseURL: https://api.groq.com/openai/v1) running the llama-3.3-70b-versatile model, authenticated via the GROQ_API_KEY environment variable.`,
        metadata: { source: 'System Local Memory', category: 'llm' }
      }
    ];

    try {
      for (const doc of seedDocs) {
        const embedding = await this.embeddingsClient.embedQuery(doc.text);
        this.inMemoryStore.push({
          text: doc.text,
          metadata: doc.metadata,
          embedding
        });
      }
      this.logger.log(`Successfully indexed ${this.inMemoryStore.length} docs in-memory.`);
    } catch (err) {
      this.logger.error(`Failed to generate in-memory embeddings: ${err.message}. Falling back to static RAG contexts.`);
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs vector search (Qdrant).
   * Falls back to in-memory cosine similarity if services are offline.
   */
  async hybridSearch(query: string, limit = 5): Promise<Array<{ text: string; score: number; source: string }>> {
    const vectorResults: any[] = [];

    // Dense Vector Search (Qdrant)
    if (this.qdrantActive) {
      try {
        const queryVector = await this.embeddingsClient.embedQuery(query);
        const searchResult = await this.qdrantClient.search('bureau_collection', {
          vector: queryVector,
          limit,
          with_payload: true
        });
        
        for (const hit of searchResult) {
          vectorResults.push({
            text: hit.payload?.text as string || '',
            score: hit.score,
            source: (hit.payload?.metadata as any)?.source || 'Qdrant Vector DB'
          });
        }
      } catch (err) {
        this.logger.error('Failed to perform Qdrant search', err);
      }
    }

    // In-memory RAG Fallback
    if (!this.qdrantActive && this.inMemoryStore.length > 0) {
      try {
        const queryVector = await this.embeddingsClient.embedQuery(query);
        const scoredDocs = this.inMemoryStore.map(doc => {
          const vecScore = this.cosineSimilarity(queryVector, doc.embedding);
          return {
            text: doc.text,
            score: vecScore,
            source: doc.metadata.source || 'In-Memory Store',
          };
        });

        scoredDocs.sort((a, b) => b.score - a.score);
        return scoredDocs.slice(0, limit);
      } catch (err) {
        this.logger.error('Failed in-memory RAG retrieval', err);
      }
    }

    // Emergency static fallback if in-memory seeding failed and no databases are active
    if (vectorResults.length === 0) {
      return [
        {
          text: `General Context: "The Bureau" is an advanced AI collaborative workspace composed of 5 core specialist agents: Strategist, Coder, Wordsmith, Analyst, and Coach.`,
          score: 1.0,
          source: 'System Local Memory',
        },
        {
          text: `RAG System Message: Vector search database (Qdrant) is running in local fallback mode. Please start Docker containers to enable active document vector indexing.`,
          score: 0.9,
          source: 'System Local Memory',
        }
      ];
    }

    vectorResults.sort((a, b) => b.score - a.score);
    return vectorResults.slice(0, limit);
  }

  /**
   * Helper to index documents, with in-memory fallback.
   */
  async indexDocument(text: string, metadata: any): Promise<boolean> {
    this.logger.log(`Indexing document: ${text.substring(0, 40)}...`);
    let success = true;

    if (this.qdrantActive) {
      try {
        const embedding = await this.embeddingsClient.embedQuery(text);
        const pointId = randomUUID();
        await this.qdrantClient.upsert('bureau_collection', {
          wait: true,
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                text,
                metadata: metadata || { source: 'Manual Ingestion' }
              }
            }
          ]
        });
      } catch (err) {
        this.logger.error('Qdrant indexing failed', err);
        success = false;
      }
    }

    if (!this.qdrantActive) {
      try {
        const embedding = await this.embeddingsClient.embedQuery(text);
        this.inMemoryStore.push({
          text,
          metadata: metadata || { source: 'Manual Ingestion' },
          embedding,
        });
        this.logger.log(`Document indexed in-memory fallback store. Total documents: ${this.inMemoryStore.length}`);
      } catch (err) {
        this.logger.error('In-memory indexing failed', err);
        success = false;
      }
    }

    return success;
  }
}


