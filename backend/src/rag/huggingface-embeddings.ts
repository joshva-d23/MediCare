import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';

export interface HuggingFaceEmbeddingsParams extends EmbeddingsParams {
  apiKey: string;
  modelName?: string;
}

export class HuggingFaceEmbeddings extends Embeddings {
  private apiKey: string;
  private modelName: string;

  constructor(fields: HuggingFaceEmbeddingsParams) {
    super(fields ?? {});
    this.apiKey = fields.apiKey;
    this.modelName = fields.modelName || 'sentence-transformers/all-MiniLM-L6-v2';
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const doc of documents) {
      const emb = await this.callApi(doc);
      embeddings.push(emb);
    }
    return embeddings;
  }

  async embedQuery(document: string): Promise<number[]> {
    return await this.callApi(document);
  }

  private async callApi(text: string): Promise<number[]> {
    const url = `https://router.huggingface.co/hf-inference/models/${this.modelName}/pipeline/feature-extraction`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hugging Face Embeddings Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let embedding: any = data;
    while (Array.isArray(embedding) && Array.isArray(embedding[0])) {
      embedding = embedding[0];
    }
    if (!Array.isArray(embedding)) {
      throw new Error('Hugging Face Embeddings API returned an unexpected response structure.');
    }
    return embedding as number[];
  }
}
