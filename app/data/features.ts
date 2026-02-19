import { 
  Search, 
  TrendingUp, 
  Bot, 
  Calendar,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  BarChart3,
  Shield,
  Users,
  Zap
} from 'lucide-react';

export const dealFlowFeatures = [
  {
    icon: Search,
    title: "Unified Lead Intake",
    description: "Pull MLS, wholesalers, and off-market into one queue; dedupe & tag"
  },
  {
    icon: TrendingUp,
    title: "AI Deal Analyzer",
    description: "ARV, rehab, comps, holding cost model → buy/no-buy score"
  },
  {
    icon: Calendar,
    title: "Follow-Up Sequences",
    description: "Auto touch every 7/14/30 days until disposition"
  },
  {
    icon: Bot,
    title: "Agent/Wholesaler Bot",
    description: "Instant replies that ask for deal sheets, pics, price flexibility"
  }
];

export const operationsFeatures = [
  {
    icon: AlertTriangle,
    title: "Budget vs Actual Alerts",
    description: "Flag any category >10% variance before it snowballs"
  },
  {
    icon: Clock,
    title: "Milestone Scheduler",
    description: "Scope→milestone→photo proof→payment release"
  },
  {
    icon: DollarSign,
    title: "Utility/Interest Burn",
    description: "Daily dashboard of carrying-cost drag"
  },
  {
    icon: FileText,
    title: "Draw Package Builder",
    description: "One-click lender-ready PDF (invoices + photos)"
  }
];

export const processSteps = [
  {
    icon: BarChart3,
    step: 1,
    title: "Audit (free)",
    description: "We map your current deal flow & ops"
  },
  {
    icon: Zap,
    step: 2,
    title: "Pilot (2-3 weeks)",
    description: "We ship 1-2 high-impact workflows"
  },
  {
    icon: Shield,
    step: 3,
    title: "Implement",
    description: "We productionize, add guardrails, and train your team"
  },
  {
    icon: Users,
    step: 4,
    title: "Scale",
    description: "We roll out portfolio dashboards and ongoing optimization"
  }
];

export const metrics = [
  {
    value: "157M+",
    label: "properties in national database"
  },
  {
    value: "15+",
    label: "distress signals per property"
  },
  {
    value: "Automated",
    label: "skip tracing built-in"
  },
  {
    value: "Real-time",
    label: "MAO & ROI calculations"
  }
];