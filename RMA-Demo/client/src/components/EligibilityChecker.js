import React, { useState } from 'react';
import './EligibilityChecker.css';

const EligibilityChecker = () => {
  const [formData, setFormData] = useState({
    question: '',
    debt: '',
    income: '',
    assets: '',
    topic: 'dro_eligibility'
  });
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        question: formData.question,
        topic: formData.topic,
        include_diagram: true
      };

      // Only include numeric values if provided
      if (formData.debt) payload.debt = parseFloat(formData.debt);
      if (formData.income) payload.income = parseFloat(formData.income);
      if (formData.assets) payload.assets = parseFloat(formData.assets);

      const response = await fetch('http://localhost:8102/eligibility-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
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

  const getStatusClass = (status) => {
    switch (status) {
      case 'eligible':
        return 'status-eligible';
      case 'not_eligible':
        return 'status-not-eligible';
      case 'near_miss':
        return 'status-near-miss';
      case 'unknown':
        return 'status-unknown';
      default:
        return '';
    }
  };

  const getOverallResultClass = (result) => {
    switch (result) {
      case 'eligible':
        return 'overall-eligible';
      case 'not_eligible':
        return 'overall-not-eligible';
      case 'requires_review':
        return 'overall-review';
      case 'incomplete_information':
        return 'overall-incomplete';
      default:
        return '';
    }
  };

  return (
    <div className="eligibility-checker">
      <h2>Debt Solution Eligibility Checker</h2>
      
      <form onSubmit={handleSubmit} className="eligibility-form">
        <div className="form-group">
          <label htmlFor="question">Question:</label>
          <input
            type="text"
            id="question"
            name="question"
            value={formData.question}
            onChange={handleChange}
            placeholder="e.g., Can I get a DRO?"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="debt">Total Debt (£):</label>
            <input
              type="number"
              id="debt"
              name="debt"
              value={formData.debt}
              onChange={handleChange}
              placeholder="e.g., 45000"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="income">Monthly Income (£):</label>
            <input
              type="number"
              id="income"
              name="income"
              value={formData.income}
              onChange={handleChange}
              placeholder="e.g., 70"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="assets">Total Assets (£):</label>
            <input
              type="number"
              id="assets"
              name="assets"
              value={formData.assets}
              onChange={handleChange}
              placeholder="e.g., 1500"
              step="0.01"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="topic">Debt Solution:</label>
          <select
            id="topic"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
          >
            <option value="dro_eligibility">DRO (Debt Relief Order)</option>
            <option value="bankruptcy_eligibility">Bankruptcy</option>
            <option value="iva_eligibility">IVA (Individual Voluntary Arrangement)</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Checking Eligibility...' : 'Check Eligibility'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="eligibility-results">
          <div className={`overall-result ${getOverallResultClass(result.overall_result)}`}>
            <h3>Overall Result: {result.overall_result.replace(/_/g, ' ').toUpperCase()}</h3>
            <div className="confidence">Confidence: {(result.confidence * 100).toFixed(0)}%</div>
          </div>

          <div className="answer-section">
            <h4>Answer from Manuals:</h4>
            <p>{result.answer}</p>
          </div>

          {result.criteria && result.criteria.length > 0 && (
            <div className="criteria-section">
              <h4>Eligibility Criteria Breakdown:</h4>
              <div className="criteria-grid">
                {result.criteria.map((criterion, index) => (
                  <div key={index} className={`criterion-card ${getStatusClass(criterion.status)}`}>
                    <div className="criterion-header">
                      <span className="criterion-icon">{getStatusIcon(criterion.status)}</span>
                      <span className="criterion-name">{criterion.criterion.toUpperCase()}</span>
                    </div>
                    <div className="criterion-details">
                      <div className="criterion-row">
                        <span className="label">Threshold:</span>
                        <span className="value">£{criterion.threshold_value?.toLocaleString()}</span>
                      </div>
                      {criterion.client_value !== null && (
                        <div className="criterion-row">
                          <span className="label">Your Value:</span>
                          <span className="value">£{criterion.client_value?.toLocaleString()}</span>
                        </div>
                      )}
                      {criterion.gap !== null && criterion.gap > 0 && (
                        <div className="criterion-row">
                          <span className="label">Gap:</span>
                          <span className="value gap-value">£{criterion.gap?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="criterion-explanation">
                        {criterion.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.near_misses && result.near_misses.length > 0 && (
            <div className="near-misses-section">
              <h4>⚠️ Near-Miss Opportunities:</h4>
              <p className="near-miss-intro">You're close! Here are opportunities to qualify:</p>
              {result.near_misses.map((nearMiss, index) => (
                <div key={index} className="near-miss-card">
                  <div className="near-miss-header">
                    <strong>{nearMiss.threshold_name}</strong>
                    <span className="tolerance-badge">
                      Within £{nearMiss.tolerance?.toLocaleString()} tolerance
                    </span>
                  </div>
                  {nearMiss.strategies && nearMiss.strategies.length > 0 && (
                    <div className="strategies">
                      <p className="strategies-label">Possible strategies:</p>
                      <ul>
                        {nearMiss.strategies.map((strategy, sIndex) => (
                          <li key={sIndex}>
                            <strong>{strategy.description}</strong>
                            {strategy.actions && strategy.actions.length > 0 && (
                              <ul className="strategy-actions">
                                {strategy.actions.map((action, aIndex) => (
                                  <li key={aIndex}>{action}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="recommendations-section">
              <h4>💡 Recommendations:</h4>
              <div className="recommendations-list">
                {result.recommendations.map((rec, index) => (
                  <div key={index} className={`recommendation-card priority-${rec.priority}`}>
                    <div className="recommendation-header">
                      <span className="priority-badge">{rec.priority} priority</span>
                      <span className="rec-type">{rec.type}</span>
                    </div>
                    <p className="recommendation-action">{rec.action}</p>
                    {rec.steps && rec.steps.length > 0 && (
                      <ul className="recommendation-steps">
                        {rec.steps.map((step, sIndex) => (
                          <li key={sIndex}>{step}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.sources && result.sources.length > 0 && (
            <div className="sources-section">
              <h4>📚 Sources:</h4>
              <ul className="sources-list">
                {result.sources.map((source, index) => (
                  <li key={index}>{source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EligibilityChecker;
