/**
 * API client with auth token management and error handling.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

interface APIResponse<T = unknown> {
  data: T;
  error?: string;
}

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  setToken(token: string) {
    localStorage.setItem('access_token', token);
  }

  setRefreshToken(token: string) {
    localStorage.setItem('refresh_token', token);
  }

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try refresh token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        const retryResponse = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({}));
          throw new Error(error.error || 'Request failed');
        }
        return retryResponse.json();
      }
      this.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }

    // if (!response.ok) {
    //   const error = await response.json().catch(() => ({}));
    //   throw new Error(error.error || `Request failed: ${response.status}`);
    // }
    if (!response.ok) {
  const error = await response.json().catch(() => ({}));

  // authentication expired
  if (response.status === 401) {
    this.clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error("Session expired. Please login again.");
  }

  // rate limit exceeded
  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a few seconds.");
  }

  // server error
  if (response.status >= 500) {
    throw new Error("Server error. Please try again later.");
  }

  throw new Error(error.error || `Request failed: ${response.status}`);
}
    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setToken(data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Auth ───
  async register(email: string, password: string, name: string) {
    const data = await this.request<{
      user: User;
      access_token: string;
      refresh_token: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.access_token);
    this.setRefreshToken(data.refresh_token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      user: User;
      access_token: string;
      refresh_token: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    this.setRefreshToken(data.refresh_token);
    return data;
  }

  async getProfile() {
    return this.request<User>('/auth/profile');
  }

  // ─── Documents ───
  async uploadDocument(file: File, title?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    return this.request<Document>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getDocuments(page = 1, perPage = 20) {
    return this.request<{
      documents: Document[];
      total: number;
      page: number;
      pages: number;
    }>(`/documents?page=${page}&per_page=${perPage}`);
  }

  async getDocument(id: number) {
    return this.request<Document>(`/documents/${id}`);
  }

  async deleteDocument(id: number) {
    return this.request<{ message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── AI ───
  async queryAI(query: string) {
    return this.request<{
      answer: string;
      sources: { document_id: number; title: string; relevance: number }[];
      query: string;
      chunks_used: number;
    }>('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async summarizeDocument(documentId: number) {
    return this.request<{ summary: string; word_count: number }>('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  // ─── Roadmaps ───
  async generateRoadmap(goal: string, level?: string, timeAvailable?: string) {
    return this.request<Roadmap>('/roadmap/generate', {
      method: 'POST',
      body: JSON.stringify({
        goal,
        level: level || 'beginner',
        time_available: timeAvailable || '2 hours/day',
      }),
    });
  }

  async getRoadmaps() {
    return this.request<{ roadmaps: Roadmap[] }>('/roadmap');
  }

  async getRoadmap(id: number) {
    return this.request<Roadmap>(`/roadmap/${id}`);
  }

  async updateRoadmapProgress(
    roadmapId: number,
    phaseId: string,
    topicIndex: number,
    completed: boolean
  ) {
    return this.request<Roadmap>(`/roadmap/${roadmapId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({
        phase_id: phaseId,
        topic_index: topicIndex,
        completed,
      }),
    });
  }

  async deleteRoadmap(id: number) {
    return this.request<{ message: string }>(`/roadmap/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Intelligence ───
  async generateMindMap(topic: string, useDocuments = false, depth = 3) {
    return this.request<MindMapNode>('/intelligence/mindmap', {
      method: 'POST',
      body: JSON.stringify({ topic, use_documents: useDocuments, depth }),
    });
  }

  async saveMindMap(title: string, topic: string, mindmapData: MindMapNode) {
    return this.request<SavedMindMap>('/intelligence/mindmap/save', {
      method: 'POST',
      body: JSON.stringify({ title, topic, mindmap_data: mindmapData }),
    });
  }

  async getMindMaps() {
    return this.request<{ mindmaps: SavedMindMap[] }>('/intelligence/mindmaps');
  }

  async getMindMap(id: number) {
    return this.request<SavedMindMap>(`/intelligence/mindmap/${id}`);
  }

  async updateMindMap(id: number, title?: string, mindmapData?: MindMapNode) {
    return this.request<SavedMindMap>(`/intelligence/mindmap/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, mindmap_data: mindmapData }),
    });
  }

  async deleteMindMap(id: number) {
    return this.request<{ message: string }>(`/intelligence/mindmap/${id}`, {
      method: 'DELETE',
    });
  }

  async convertMindMapToRoadmap(mindmapData: MindMapNode, level = 'beginner', timeAvailable = '2 hours/day') {
    return this.request<Roadmap>('/intelligence/mindmap-to-roadmap', {
      method: 'POST',
      body: JSON.stringify({ mindmap_data: mindmapData, level, time_available: timeAvailable }),
    });
  }

  async getKnowledgeGraph() {
    return this.request<KnowledgeGraph>('/intelligence/knowledge-graph');
  }

  async generateQuiz(topic: string, documentId?: number) {
    return this.request<QuizResult>('/intelligence/quiz', {
      method: 'POST',
      body: JSON.stringify({ topic, document_id: documentId, num_questions: 5 }),
    });
  }

  async summarizeDoc(docId: number) {
    return this.request<{ document_id: number; title: string; summary: string }>(
      `/intelligence/summarize/${docId}`
    );
  }

  async explainConcept(concept: string, useDocuments = false) {
    return this.request<{ concept: string; explanation: string }>('/intelligence/explain', {
      method: 'POST',
      body: JSON.stringify({ concept, use_documents: useDocuments }),
    });
  }

  // ─── Workspaces ───
  async createWorkspace(name: string, description = '') {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async getWorkspaces() {
    return this.request<{ workspaces: Workspace[] }>('/workspaces');
  }

  async inviteToWorkspace(wsId: number, email: string, role: string) {
    return this.request<WorkspaceMember>(`/workspaces/${wsId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async shareToWorkspace(wsId: number, documentId: number) {
    return this.request<{ id: number }>(`/workspaces/${wsId}/share`, {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  async getWorkspaceDocuments(wsId: number) {
    return this.request<{ documents: SharedDoc[] }>(`/workspaces/${wsId}/documents`);
  }
}

// ─── Types ───
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface Document {
  id: number;
  user_id: number;
  title: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  created_at: string;
}

export interface RoadmapResource {
  type: string;
  title: string;
  url: string;
}

export interface RoadmapTopic {
  title: string;
  completed: boolean;
  estimated_hours?: number;
  resources?: RoadmapResource[];
}

export interface RoadmapPhase {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: string;
  estimated_hours?: number;
  topics: RoadmapTopic[];
}

export interface RoadmapData {
  title: string;
  total_estimated_hours?: number;
  phases: RoadmapPhase[];
}

export interface Roadmap {
  id: number;
  user_id: number;
  goal: string;
  level: string;
  time_available: string;
  roadmap_data: RoadmapData;
  progress: number;
  created_at: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  color?: string;
  children: MindMapNode[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'document' | 'concept';
  color: string;
  size: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  weight: number;
  label: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: { total_nodes: number; total_edges: number; documents: number; concepts: number };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

export interface QuizResult {
  topic: string;
  quiz: QuizQuestion[];
  explanation: string;
}

export interface Workspace {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  is_public: boolean;
  member_count: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  role: string;
  user_name: string;
  user_email: string;
  joined_at: string;
}

export interface SharedDoc {
  id: number;
  title: string;
  filename: string;
  shared_by: number;
  shared_at: string;
}

export interface SavedMindMap {
  id: number;
  user_id: number;
  title: string;
  topic: string;
  mindmap_data: MindMapNode;
  created_at: string;
  updated_at: string;
}

export const api = new APIClient(API_BASE);
export default api;

