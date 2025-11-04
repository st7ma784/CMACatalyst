/**
 * Graph Service API Client
 * Communicates with NER Graph Service backend
 * Endpoints: /graph, /search, /compare, /reasoning
 */

import axios, { AxiosInstance } from 'axios';
import {
  DocumentGraph,
  Entity,
  Relationship,
  GraphComparison,
  SearchResult,
  ApplicableRule,
  GraphStatistics,
  ReasoningChain,
} from '@/types/graph.types';

class GraphService {
  private apiClient: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_NER_SERVICE_URL || 'http://localhost:8108') {
    this.baseURL = baseURL;
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Health check - verify NER service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('NER service health check failed:', error);
      return false;
    }
  }

  /**
   * Get full graph by ID
   * Returns complete graph with all entities and relationships
   */
  async getGraph(graphId: string): Promise<DocumentGraph> {
    try {
      const response = await this.apiClient.get<DocumentGraph>(`/graph/${graphId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch graph ${graphId}:`, error);
      throw new Error(`Failed to fetch graph: ${(error as any).message}`);
    }
  }

  /**
   * Search entities within a graph
   * Returns matching entities with relationships
   */
  async searchEntities(
    graphId: string,
    query: string,
    entityTypes?: string[],
    limit: number = 50
  ): Promise<SearchResult> {
    try {
      const response = await this.apiClient.post<SearchResult>(`/graph/${graphId}/search`, {
        query,
        entity_types: entityTypes,
        limit,
      });
      return response.data;
    } catch (error) {
      console.error(`Search failed in graph ${graphId}:`, error);
      throw new Error(`Search failed: ${(error as any).message}`);
    }
  }

  /**
   * Compare two graphs and find applicable rules
   * Returns matching rules, gaps, and entity mappings
   */
  async compareGraphs(
    manualGraphId: string,
    clientGraphId: string
  ): Promise<GraphComparison> {
    try {
      const response = await this.apiClient.post<GraphComparison>('/graph/compare', {
        graph1_id: manualGraphId,
        graph2_id: clientGraphId,
      });
      return response.data;
    } catch (error) {
      console.error(`Graph comparison failed:`, error);
      throw new Error(`Graph comparison failed: ${(error as any).message}`);
    }
  }

  /**
   * Get reasoning chain between two entities
   * Returns the path and relationships connecting them
   */
  async getReasoningChain(
    graphId: string,
    startEntityId: string,
    endEntityId: string
  ): Promise<ReasoningChain> {
    try {
      const response = await this.apiClient.post<ReasoningChain>(
        `/graph/${graphId}/reasoning/chain`,
        {
          start_entity_id: startEntityId,
          end_entity_id: endEntityId,
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to get reasoning chain:`, error);
      throw new Error(`Reasoning chain failed: ${(error as any).message}`);
    }
  }

  /**
   * Get graph statistics
   * Returns counts and summaries
   */
  async getGraphStatistics(graphId: string): Promise<GraphStatistics> {
    try {
      const response = await this.apiClient.get<GraphStatistics>(`/graph/${graphId}/stats`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get graph statistics:`, error);
      throw new Error(`Statistics failed: ${(error as any).message}`);
    }
  }

  /**
   * Get single entity details
   */
  async getEntity(graphId: string, entityId: string): Promise<Entity> {
    try {
      const response = await this.apiClient.get<Entity>(
        `/graph/${graphId}/entities/${entityId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch entity:`, error);
      throw new Error(`Entity fetch failed: ${(error as any).message}`);
    }
  }

  /**
   * Get relationships for an entity
   */
  async getEntityRelationships(
    graphId: string,
    entityId: string
  ): Promise<Relationship[]> {
    try {
      const response = await this.apiClient.get<Relationship[]>(
        `/graph/${graphId}/entities/${entityId}/relationships`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch entity relationships:`, error);
      throw new Error(`Relationships fetch failed: ${(error as any).message}`);
    }
  }

  /**
   * Extract graph from document text
   * Called when ingesting new documents
   */
  async extractGraphFromDocument(
    documentText: string,
    documentId: string,
    filename: string
  ): Promise<DocumentGraph> {
    try {
      const response = await this.apiClient.post<DocumentGraph>('/graph/extract', {
        document_text: documentText,
        document_id: documentId,
        filename,
      });
      return response.data;
    } catch (error) {
      console.error(`Graph extraction failed:`, error);
      throw new Error(`Graph extraction failed: ${(error as any).message}`);
    }
  }

  /**
   * Filter graph by entity types
   * Returns filtered graph with only specified entity types
   */
  async filterGraphByEntityTypes(
    graphId: string,
    entityTypes: string[]
  ): Promise<DocumentGraph> {
    try {
      const response = await this.apiClient.post<DocumentGraph>(
        `/graph/${graphId}/filter`,
        {
          entity_types: entityTypes,
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Graph filtering failed:`, error);
      throw new Error(`Graph filtering failed: ${(error as any).message}`);
    }
  }

  /**
   * Filter graph by temporal validity
   * Returns relationships valid on specified date
   */
  async filterGraphByDate(
    graphId: string,
    date: Date
  ): Promise<DocumentGraph> {
    try {
      const response = await this.apiClient.post<DocumentGraph>(
        `/graph/${graphId}/filter/temporal`,
        {
          date: date.toISOString().split('T')[0],
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Temporal filtering failed:`, error);
      throw new Error(`Temporal filtering failed: ${(error as any).message}`);
    }
  }

  /**
   * Get applicable rules for client situation
   */
  async getApplicableRules(
    manualGraphId: string,
    clientGraphId: string,
    asOfDate?: Date
  ): Promise<ApplicableRule[]> {
    try {
      const response = await this.apiClient.post<ApplicableRule[]>(
        '/graph/applicable-rules',
        {
          manual_graph_id: manualGraphId,
          client_graph_id: clientGraphId,
          as_of_date: asOfDate?.toISOString().split('T')[0],
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to get applicable rules:`, error);
      throw new Error(`Applicable rules failed: ${(error as any).message}`);
    }
  }

  /**
   * Set API base URL
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
    this.apiClient.defaults.baseURL = baseURL;
  }

  /**
   * Get current API base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
}

// Export singleton instance
export const graphService = new GraphService();

export default GraphService;
