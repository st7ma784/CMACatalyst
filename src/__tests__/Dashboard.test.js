import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import { AuthContext } from '../contexts/AuthContext';

// Mock API calls
global.fetch = jest.fn();

// Mock chart components to avoid canvas issues in tests
jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
  })),
}));

const mockAuthContext = {
  user: {
    id: 1,
    username: 'testuser',
    role: 'advisor',
    centre_id: 1
  },
  token: 'mock-token',
  logout: jest.fn()
};

const DashboardWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthContext.Provider value={mockAuthContext}>
      {children}
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('Dashboard Component', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  it('renders dashboard with loading state initially', () => {
    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays dashboard statistics after loading', async () => {
    const mockStats = {
      totalCases: 150,
      activeCases: 85,
      completedCases: 65,
      totalClients: 120,
      pendingAppointments: 12,
      overdueActions: 8
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats
    });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument(); // total cases
      expect(screen.getByText('85')).toBeInTheDocument();  // active cases
      expect(screen.getByText('120')).toBeInTheDocument(); // total clients
    });

    expect(fetch).toHaveBeenCalledWith('/api/dashboard/stats', {
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json'
      }
    });
  });

  it('displays recent activity feed', async () => {
    const mockActivity = [
      {
        id: 1,
        activity_type: 'case_created',
        description: 'New case created for client John Doe',
        created_at: new Date().toISOString(),
        user_name: 'Test User'
      },
      {
        id: 2,
        activity_type: 'appointment_scheduled',
        description: 'Appointment scheduled with Jane Smith',
        created_at: new Date().toISOString(),
        user_name: 'Test User'
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // stats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivity
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('New case created for client John Doe')).toBeInTheDocument();
      expect(screen.getByText('Appointment scheduled with Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays upcoming appointments', async () => {
    const mockAppointments = [
      {
        id: 1,
        client_name: 'John Doe',
        appointment_date: '2024-01-15T10:00:00Z',
        appointment_type: 'Initial Consultation',
        status: 'scheduled'
      },
      {
        id: 2,
        client_name: 'Jane Smith',
        appointment_date: '2024-01-15T14:30:00Z',
        appointment_type: 'Follow-up',
        status: 'scheduled'
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // stats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // activity
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAppointments
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });
  });

  it('displays system alerts', async () => {
    const mockAlerts = [
      {
        id: 1,
        type: 'warning',
        title: 'Overdue Follow-ups',
        message: 'You have 3 overdue follow-ups',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        type: 'info',
        title: 'System Maintenance',
        message: 'Scheduled maintenance tonight at 2 AM',
        created_at: new Date().toISOString()
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // stats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // activity
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // appointments
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlerts
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Overdue Follow-ups')).toBeInTheDocument();
      expect(screen.getByText('System Maintenance')).toBeInTheDocument();
      expect(screen.getByText('You have 3 overdue follow-ups')).toBeInTheDocument();
    });
  });

  it('handles alert dismissal', async () => {
    const mockAlerts = [
      {
        id: 1,
        type: 'warning',
        title: 'Test Alert',
        message: 'Test message',
        created_at: new Date().toISOString()
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // stats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // activity
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // appointments
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlerts
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Alert dismissed' })
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Alert')).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/dismiss-alert/1', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      });
    });
  });

  it('displays performance metrics', async () => {
    const mockMetrics = {
      casesThisMonth: 25,
      casesLastMonth: 20,
      averageCaseResolutionTime: 14.5,
      clientSatisfactionScore: 4.2,
      appointmentsThisWeek: 8
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // stats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // activity
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // appointments
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // alerts
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // cases this month
      expect(screen.getByText('4.2')).toBeInTheDocument(); // satisfaction score
      expect(screen.getByText('14.5')).toBeInTheDocument(); // avg resolution time
    });
  });

  it('handles API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalCases: 150 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      })
      // Second set of calls after refresh
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalCases: 155 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('155')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledTimes(10); // 5 initial + 5 after refresh
  });

  it('shows role-specific content for different user roles', async () => {
    const managerAuthContext = {
      ...mockAuthContext,
      user: { ...mockAuthContext.user, role: 'manager' }
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const { rerender } = render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.queryByText('Management Tools')).not.toBeInTheDocument();
    });

    // Re-render with manager role
    rerender(
      <BrowserRouter>
        <AuthContext.Provider value={managerAuthContext}>
          <Dashboard />
        </AuthContext.Provider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Management Tools')).toBeInTheDocument();
    });
  });

  it('renders charts when data is available', async () => {
    const mockStats = {
      totalCases: 150,
      activeCases: 85,
      completedCases: 65
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats
    });

    render(
      <DashboardWrapper>
        <Dashboard />
      </DashboardWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cases-chart')).toBeInTheDocument();
    });
  });
});