export interface Project {
  id: string;
  name: string;
  baseUrl: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  lastActiveAt: string;
  stats: {
    totalRuns: number;
    passingTests: number;
    failingTests: number;
    openIssues: number;
  };
  recentRuns: RecentRun[];
  openIssues: OpenIssue[];
}

export interface RecentRun {
  id: string;
  testName: string;
  status: 'passed' | 'failed' | 'warning' | 'running';
  mode: 'autonomous' | 'deterministic';
  duration: string;
  timestamp: string;
}

export interface OpenIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'low';
  foundIn: string;
  timestamp: string;
}

export const PROJECT_COLORS = [
  { name: 'Blue',       value: '#7BA7C2' },
  { name: 'Terracotta', value: '#C27B6E' },
  { name: 'Sage',       value: '#7BA87E' },
  { name: 'Violet',     value: '#8B7BC2' },
  { name: 'Slate',      value: '#7B8FC2' },
  { name: 'Amber',      value: '#C2A97B' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'my-saas',
    baseUrl: 'app.mysaas.com',
    color: '#7B8FC2',
    pinned: false,
    createdAt: '2025-01-15',
    lastActiveAt: '2025-03-28',
    stats: { totalRuns: 47, passingTests: 8, failingTests: 1, openIssues: 5 },
    recentRuns: [
      { id: 'r-1', testName: 'Checkout Flow', status: 'passed', mode: 'autonomous', duration: '42s', timestamp: '2 min ago' },
      { id: 'r-2', testName: 'User Onboarding', status: 'failed', mode: 'deterministic', duration: '18s', timestamp: '8 min ago' },
      { id: 'r-3', testName: 'Settings Page', status: 'passed', mode: 'autonomous', duration: '31s', timestamp: '1 hr ago' },
    ],
    openIssues: [
      { id: 'TR-1001', title: 'Checkout button disabled for guest users', severity: 'high', foundIn: 'Checkout Flow', timestamp: '2 days ago' },
      { id: 'TR-1004', title: 'Settings avatar fails on slow connection', severity: 'low', foundIn: 'Settings Page', timestamp: '5 days ago' },
    ],
  },
  {
    id: 'proj-2',
    name: 'side-project',
    baseUrl: 'sideproject.io',
    color: '#7BA87E',
    pinned: false,
    createdAt: '2025-02-01',
    lastActiveAt: '2025-03-25',
    stats: { totalRuns: 12, passingTests: 3, failingTests: 0, openIssues: 2 },
    recentRuns: [
      { id: 'r-4', testName: 'Landing Page Load', status: 'passed', mode: 'autonomous', duration: '12s', timestamp: '2 days ago' },
      { id: 'r-5', testName: 'Contact Form', status: 'passed', mode: 'deterministic', duration: '9s', timestamp: '3 days ago' },
    ],
    openIssues: [
      { id: 'TR-1002', title: 'Contact form submit button unresponsive on iOS', severity: 'high', foundIn: 'Contact Form', timestamp: '3 days ago' },
    ],
  },
  {
    id: 'proj-3',
    name: 'client-portal',
    baseUrl: 'portal.clientco.com',
    color: '#C27B6E',
    pinned: true,
    createdAt: '2025-02-20',
    lastActiveAt: '2025-03-30',
    stats: { totalRuns: 31, passingTests: 5, failingTests: 0, openIssues: 7 },
    recentRuns: [
      { id: 'r-6', testName: 'Login Flow', status: 'passed', mode: 'deterministic', duration: '22s', timestamp: '30 min ago' },
      { id: 'r-7', testName: 'Document Upload', status: 'warning', mode: 'autonomous', duration: '55s', timestamp: '1 hr ago' },
      { id: 'r-8', testName: 'Dashboard Load', status: 'passed', mode: 'autonomous', duration: '14s', timestamp: '2 hr ago' },
    ],
    openIssues: [
      { id: 'TR-1003', title: 'PDF preview broken for files > 10MB', severity: 'critical', foundIn: 'Document Upload', timestamp: '1 day ago' },
      { id: 'TR-1005', title: 'Dashboard chart flickers on resize', severity: 'low', foundIn: 'Dashboard Load', timestamp: '4 days ago' },
    ],
  },
];

export const WORKSPACE_STATS = {
  totalProjects: MOCK_PROJECTS.length,
  passingProjects: MOCK_PROJECTS.filter(p => p.stats.failingTests === 0).length,
  failingProjects: MOCK_PROJECTS.filter(p => p.stats.failingTests > 0).length,
  openIssues: MOCK_PROJECTS.reduce((sum, p) => sum + p.stats.openIssues, 0),
};
