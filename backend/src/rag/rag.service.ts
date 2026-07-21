import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { NvidiaEmbeddings } from './nvidia-embeddings';
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
  private elasticClient: ElasticClient;
  private qdrantActive = false;
  private elasticActive = false;
  
  private inMemoryStore: InMemoryDoc[] = [];
  private embeddingsClient: NvidiaEmbeddings;

  constructor() {
    const apiKey = process.env.NVIDIA_API_KEY || '';
    this.embeddingsClient = new NvidiaEmbeddings({ apiKey });
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
      
      // Verify/Create collection
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(c => c.name === 'bureau_collection');
      if (!exists) {
        await this.qdrantClient.createCollection('bureau_collection', {
          vectors: {
            size: 2048,
            distance: 'Cosine'
          }
        });
        this.logger.log('Created Qdrant collection: bureau_collection');
      }

      this.qdrantActive = true;
      this.logger.log('Connected to Qdrant successfully.');
    } catch (err) {
      this.logger.warn('Qdrant is offline. Running vector search in mock/in-memory mode.');
    }

    // Initialize ElasticSearch Client
    try {
      this.elasticClient = new ElasticClient({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        maxRetries: 0,
        requestTimeout: 1500,
        checkCompatibility: false,
      } as any);
      await this.elasticClient.ping();
      
      // Verify/Create index
      const exists = await this.elasticClient.indices.exists({ index: 'bureau_documents' });
      if (!exists) {
        await this.elasticClient.indices.create({ index: 'bureau_documents' });
        this.logger.log('Created ElasticSearch index: bureau_documents');
      }

      this.elasticActive = true;
      this.logger.log('Connected to ElasticSearch successfully.');
    } catch (err) {
      this.logger.warn('ElasticSearch is offline. Running keyword search in mock/in-memory mode.');
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
        text: `Dynamic Island Interface: The pill-shaped dynamic island widget at the top of the interface displays active specialist status, current LLM model/provider (NVIDIA), and chat message counts. It pulses and transitions between boot, idle, thinking, and compact/expanded states dynamically.`,
        metadata: { source: 'System Local Memory', category: 'ui' }
      },
      {
        text: `Backend Architecture: The backend service is built using NestJS (TypeScript), running Express routes on port 3000. It coordinates agents via LangGraph.js StateGraph state-machines and integrates a hybrid vector/keyword retriever.`,
        metadata: { source: 'System Local Memory', category: 'backend' }
      },
      {
        text: `LLM Endpoint Provider: The primary LLM orchestrator uses the NVIDIA API Catalog (baseURL: https://integrate.api.nvidia.com/v1) running the meta/llama-3.1-8b-instruct model, authenticated via the NVIDIA_API_KEY environment variable.`,
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
      this.logger.error('Failed to generate in-memory embeddings. Falling back to static RAG contexts.', err.message);
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

  private getKeywordScore(text: string, query: string): number {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return 0;
    
    let matches = 0;
    const textLower = text.toLowerCase();
    for (const term of terms) {
      if (textLower.includes(term)) {
        matches++;
      }
    }
    return matches / terms.length;
  }

  /**
   * Performs hybrid search (Qdrant + ElasticSearch) with Reciprocal Rank Fusion (RRF).
   * Falls back to in-memory cosine similarity and keyword search if services are offline.
   */
  async hybridSearch(query: string, limit = 5): Promise<Array<{ text: string; score: number; source: string }>> {
    const vectorResults: any[] = [];
    const keywordResults: any[] = [];

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

    // Keyword Search (ElasticSearch)
    if (this.elasticActive) {
      try {
        const searchResult = await this.elasticClient.search({
          index: 'bureau_documents',
          query: { match: { content: query } },
          size: limit,
        });
        
        const hits = searchResult.hits.hits;
        for (const hit of hits) {
          const doc = hit._source as any;
          keywordResults.push({
            text: doc.content || '',
            score: hit._score || 0,
            source: doc.metadata?.source || 'ElasticSearch Keyword'
          });
        }
      } catch (err) {
        this.logger.error('Failed to perform ElasticSearch search', err);
      }
    }

    // In-memory RAG Fallback
    if (!this.qdrantActive && !this.elasticActive && this.inMemoryStore.length > 0) {
      try {
        const queryVector = await this.embeddingsClient.embedQuery(query);
        const scoredDocs = this.inMemoryStore.map(doc => {
          const vecScore = this.cosineSimilarity(queryVector, doc.embedding);
          const kwScore = this.getKeywordScore(doc.text, query);
          const combinedScore = 0.7 * vecScore + 0.3 * kwScore;
          return {
            text: doc.text,
            score: combinedScore,
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
    if (vectorResults.length === 0 && keywordResults.length === 0) {
      return [
        {
          text: `General Context: "The Bureau" is an advanced AI collaborative workspace composed of 5 core specialist agents: Strategist, Coder, Wordsmith, Analyst, and Coach.`,
          score: 1.0,
          source: 'System Local Memory',
        },
        {
          text: `RAG System Message: Hybrid search databases (Qdrant, ElasticSearch) are running in local fallback mode. Please start Docker containers to enable active document vector indexing.`,
          score: 0.9,
          source: 'System Local Memory',
        }
      ];
    }

    // Reciprocal Rank Fusion (RRF) to merge vector and keyword results
    const rrfMap = new Map<string, { text: string; score: number; source: string }>();
    const kConst = 60;

    const applyRRF = (results: any[]) => {
      results.forEach((item, index) => {
        const docKey = item.text;
        const rank = index + 1;
        const rrfContribution = 1 / (kConst + rank);

        if (rrfMap.has(docKey)) {
          rrfMap.get(docKey)!.score += rrfContribution;
        } else {
          rrfMap.set(docKey, {
            text: item.text,
            score: rrfContribution,
            source: item.source
          });
        }
      });
    };

    applyRRF(vectorResults);
    applyRRF(keywordResults);

    const merged = Array.from(rrfMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return merged;
  }

  /**
   * Helper to index documents to both databases, with in-memory fallback.
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

    if (this.elasticActive) {
      try {
        await this.elasticClient.index({
          index: 'bureau_documents',
          document: {
            content: text,
            metadata: metadata || { source: 'Manual Ingestion' }
          }
        });
      } catch (err) {
        this.logger.error('ElasticSearch indexing failed', err);
        success = false;
      }
    }

    if (!this.qdrantActive && !this.elasticActive) {
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


