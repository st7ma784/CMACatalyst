'use client';

import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Alert } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface EligibilityRequest {
  question: string;
  debt?: number;
  income?: number;
  assets?: number;
  topic: string;
  include_diagram?: boolean;
  client_id?: string; // Optional: for client-specific context
}

interface CriterionStatus {
  criterion: string;
  threshold_value: number;
  client_value?: number;
  status: 'eligible' | 'not_eligible' | 'near_miss' | 'unknown';
  gap?: number;
  operator?: string;
  explanation: string;
}

interface NearMiss {
  threshold_name: string;
  tolerance: number;
  strategies?: {
    description: string;
    actions?: string[];
    likelihood?: string;
  }[];
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  steps?: string[];
}

interface EligibilityResponse {
  answer: string;
  overall_result: 'eligible' | 'not_eligible' | 'requires_review' | 'incomplete_information';
  confidence: number;
  criteria: CriterionStatus[];
  near_misses: NearMiss[];
  recommendations: Recommendation[];
  sources: string[];
  diagram?: string;
}

const EligibilityChecker: React.FC = () => {
  const [formData, setFormData] = useState<EligibilityRequest>({
    question: '',
    debt: undefined,
    income: undefined,
    assets: undefined,
    topic: 'dro_eligibility',
    include_diagram: false,
    client_id: undefined
  });
  
  const [mode, setMode] = useState<'manual' | 'client'>('manual'); // Toggle between modes
  const [clients, setClients] = useState<Array<{client_id: string, client_name: string}>>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [result, setResult] = useState<EligibilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const UPLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL || 'http://localhost:8103';
  const RAG_SERVICE_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL || 'http://localhost:8102';

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const token = localStorage.getItem('advisor_token');
      if (!token) {
        return;
      }

      const response = await fetch(`${UPLOAD_SERVICE_URL}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'debt' || name === 'income' || name === 'assets') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? undefined : parseFloat(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: EligibilityRequest = {
        question: formData.question,
        topic: formData.topic,
        include_diagram: formData.include_diagram
      };

      // Add values based on mode
      if (mode === 'manual') {
        // Manual mode: use form inputs
        if (formData.debt !== undefined) payload.debt = formData.debt;
        if (formData.income !== undefined) payload.income = formData.income;
        if (formData.assets !== undefined) payload.assets = formData.assets;
      } else {
        // Client mode: include client_id for document-based extraction
        if (formData.client_id) {
          payload.client_id = formData.client_id;
        }
      }

      const response = await fetch(`${RAG_SERVICE_URL}/eligibility-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: EligibilityResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'eligible':
        return '✅';
      case 'not_eligible':
        return '❌';
      case 'near_miss':
        return '⚠️';
      case 'unknown':
        return '❓';
      default:
        return '◯';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'eligible':
        return 'bg-green-50 border-green-500 text-green-900';
      case 'not_eligible':
        return 'bg-red-50 border-red-500 text-red-900';
      case 'near_miss':
        return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'unknown':
        return 'bg-gray-50 border-gray-500 text-gray-900';
      default:
        return 'bg-white border-gray-300';
    }
  };

  const getOverallResultColor = (result: string): string => {
    switch (result) {
      case 'eligible':
        return 'bg-green-100 border-green-500 text-green-900';
      case 'not_eligible':
        return 'bg-red-100 border-red-500 text-red-900';
      case 'requires_review':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'incomplete_information':
        return 'bg-gray-100 border-gray-500 text-gray-900';
      default:
        return 'bg-white border-gray-300';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-black';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
        Debt Solution Eligibility Checker
      </h2>

      {/* Mode Selector */}
      <Card className="p-4 mb-6 bg-blue-50">
        <div className="flex items-center gap-4">
          <Label className="font-semibold text-gray-700">Mode:</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              📝 Manual Input (Hypothetical)
            </button>
            <button
              type="button"
              onClick={() => setMode('client')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                mode === 'client'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              👤 Client Documents (RAG)
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {mode === 'manual'
            ? '🔹 Ask hypothetical questions with manual values (e.g., "What if someone has £51k debt?")'
            : '🔹 Query specific client documents - values will be extracted automatically'}
        </p>
      </Card>
      
      <Card className="p-6 mb-8 bg-gray-50">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="question" className="block text-sm font-semibold text-gray-700 mb-2">
              Question:
            </label>
            <input
              type="text"
              id="question"
              name="question"
              value={formData.question}
              onChange={handleChange}
              placeholder={
                mode === 'manual'
                  ? "e.g., Can someone with £51k debt get a DRO?"
                  : "e.g., Is this client eligible for a DRO?"
              }
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {mode === 'client' && (
            <div>
              <label htmlFor="client_id" className="block text-sm font-semibold text-gray-700 mb-2">
                Select Client:
              </label>
              <select
                id="client_id"
                name="client_id"
                value={formData.client_id || ''}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select a client --</option>
                {clients.map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.client_name || client.client_id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Values will be extracted from client documents automatically
              </p>
            </div>
          )}

          {mode === 'manual' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="debt" className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Debt (£):
                </label>
                <input
                  type="number"
                  id="debt"
                  name="debt"
                  value={formData.debt ?? ''}
                  onChange={handleChange}
                  placeholder="e.g., 45000"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="income" className="block text-sm font-semibold text-gray-700 mb-2">
                  Monthly Income (£):
                </label>
                <input
                  type="number"
                  id="income"
                  name="income"
                  value={formData.income ?? ''}
                  onChange={handleChange}
                  placeholder="e.g., 70"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="assets" className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Assets (£):
                </label>
                <input
                  type="number"
                  id="assets"
                  name="assets"
                  value={formData.assets ?? ''}
                  onChange={handleChange}
                  placeholder="e.g., 1500"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="topic" className="block text-sm font-semibold text-gray-700 mb-2">
              Debt Solution:
            </label>
            <select
              id="topic"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="dro_eligibility">DRO (Debt Relief Order)</option>
              <option value="bankruptcy_eligibility">Bankruptcy</option>
              <option value="iva_eligibility">IVA (Individual Voluntary Arrangement)</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="include_diagram"
              name="include_diagram"
              checked={formData.include_diagram}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="include_diagram" className="ml-2 block text-sm text-gray-700">
              Include decision tree diagram
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
          >
            {loading ? 'Checking Eligibility...' : 'Check Eligibility'}
          </button>
        </form>
      </Card>

      {error && (
        <Alert className="mb-6 bg-red-50 border-red-500 text-red-900">
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {result && (
        <div className="space-y-6 animate-fadeIn">
          <Card className={`p-6 border-2 ${getOverallResultColor(result.overall_result)}`}>
            <h3 className="text-2xl font-bold mb-2">
              Overall Result: {result.overall_result.replace(/_/g, ' ').toUpperCase()}
            </h3>
            <div className="text-lg">
              Confidence: {(result.confidence * 100).toFixed(0)}%
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="text-xl font-semibold text-gray-900 mb-3">Answer from Manuals:</h4>
            <p className="text-gray-700 leading-relaxed">{result.answer}</p>
          </Card>

          {result.criteria && result.criteria.length > 0 && (
            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">
                Eligibility Criteria Breakdown:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.criteria.map((criterion, index) => (
                  <Card
                    key={index}
                    className={`p-4 border-l-4 hover:shadow-lg transition-shadow ${getStatusColor(criterion.status)}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{getStatusIcon(criterion.status)}</span>
                      <span className="text-lg font-bold uppercase">{criterion.criterion}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Threshold:</span>
                        <span className="font-semibold">£{criterion.threshold_value?.toLocaleString()}</span>
                      </div>
                      {criterion.client_value !== null && criterion.client_value !== undefined && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-gray-600">Your Value:</span>
                          <span className="font-semibold">£{criterion.client_value?.toLocaleString()}</span>
                        </div>
                      )}
                      {criterion.gap !== null && criterion.gap !== undefined && criterion.gap > 0 && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-gray-600">Gap:</span>
                          <span className="font-bold text-red-700">£{criterion.gap?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-2 mt-2 border-t border-gray-200 text-gray-700 italic">
                        {criterion.explanation}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {result.near_misses && result.near_misses.length > 0 && (
            <Card className="p-6 bg-yellow-50 border-2 border-yellow-500">
              <h4 className="text-xl font-semibold text-yellow-900 mb-2">
                ⚠️ Near-Miss Opportunities:
              </h4>
              <p className="text-yellow-900 mb-4 font-medium">
                You're close! Here are opportunities to qualify:
              </p>
              <div className="space-y-4">
                {result.near_misses.map((nearMiss, index) => (
                  <Card key={index} className="p-4 bg-white">
                    <div className="flex justify-between items-center mb-3">
                      <strong className="text-gray-900">{nearMiss.threshold_name}</strong>
                      <span className="px-3 py-1 bg-yellow-500 text-black text-xs font-semibold rounded-full">
                        Within £{nearMiss.tolerance?.toLocaleString()} tolerance
                      </span>
                    </div>
                    {nearMiss.strategies && nearMiss.strategies.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-700 mb-2">Possible strategies:</p>
                        <ul className="space-y-2">
                          {nearMiss.strategies.map((strategy, sIndex) => (
                            <li key={sIndex} className="text-gray-700">
                              <strong>{strategy.description}</strong>
                              {strategy.actions && strategy.actions.length > 0 && (
                                <ul className="ml-4 mt-1 space-y-1 text-sm text-gray-600">
                                  {strategy.actions.map((action, aIndex) => (
                                    <li key={aIndex}>• {action}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <Card className="p-6 bg-blue-50 border-2 border-blue-500">
              <h4 className="text-xl font-semibold text-blue-900 mb-4">💡 Recommendations:</h4>
              <div className="space-y-3">
                {result.recommendations.map((rec, index) => (
                  <Card
                    key={index}
                    className="p-4 bg-white border-l-4"
                    style={{
                      borderLeftColor:
                        rec.priority === 'high'
                          ? '#dc2626'
                          : rec.priority === 'medium'
                          ? '#fbbf24'
                          : '#16a34a'
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${getPriorityColor(rec.priority)}`}>
                        {rec.priority} priority
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{rec.type}</span>
                    </div>
                    <p className="font-semibold text-gray-900 mb-2">{rec.action}</p>
                    {rec.steps && rec.steps.length > 0 && (
                      <ul className="space-y-1 text-sm text-gray-700">
                        {rec.steps.map((step, sIndex) => (
                          <li key={sIndex}>• {step}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {result.sources && result.sources.length > 0 && (
            <Card className="p-6">
              <h4 className="text-xl font-semibold text-gray-900 mb-3">📚 Sources:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                {result.sources.map((source, index) => (
                  <li key={index} className="pl-4 border-l-2 border-gray-300">
                    {source}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.diagram && (
            <Card className="p-6">
              <h4 className="text-xl font-semibold text-gray-900 mb-3">🌳 Decision Tree:</h4>
              <div className="bg-white p-4 rounded border border-gray-200 overflow-x-auto">
                <pre className="text-sm">{result.diagram}</pre>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default EligibilityChecker;
