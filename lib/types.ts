export interface Organisation {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  logo_url: string;
  company_type: string;
  enabled_features: string[];
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  email: string;
  role: "admin" | "manager" | "owner" | "viewer";
  display_name: string;
  status: "active" | "suspended";
  allowed_views: string[] | null;
  organisation_id: string | null;
  registration_complete: boolean;
  phone: string;
  department: string;
  job_title: string;
  start_date: string | null;
  employee_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
}

export interface InviteRequest {
  id: string;
  user_id: string;
  organisation_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface BoardItem {
  id: string;
  user_id: string;
  organisation_id: string | null;
  assigned_to: string;
  visibility: string;
  type: "deal" | "project" | "task";
  title: string;
  company: string;
  owner: string;
  priority: "high" | "medium" | "low";
  value: number;
  due: string;
  status: string;
  notes: string;
  document_url: string;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  organisation_id: string | null;
  board_item_id: string | null;
  activity_date: string;
  title: string;
  channel: string;
  notes: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmDocument {
  id: string;
  organisation_id: string | null;
  board_item_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string;
  uploaded_by: string;
  created_at: string;
}

export interface CrmMessage {
  id: string;
  organisation_id: string | null;
  sender_id: string;
  sender_email: string;
  recipient_id: string;
  recipient_email: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface ChangeRequest {
  id: string;
  organisation_id: string | null;
  board_item_id: string | null;
  action: "create" | "update" | "delete";
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  payload: Record<string, unknown>;
  before_payload: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface CrmService {
  id: string;
  organisation_id: string | null;
  name: string;
  unit_price: number;
  unit_label: string;
  created_at: string;
}

export interface MessageThread {
  id: string;
  email: string;
  messages: CrmMessage[];
}

export interface Column {
  id: string;
  title: string;
  color: string;
}

export const PIPELINE_COLUMNS: Column[] = [
  { id: "responded_email", title: "Responded to Email", color: "#2563eb" },
  { id: "meeting_booked", title: "Meeting Booked", color: "#0f766e" },
  { id: "meeting_done", title: "Meeting Done", color: "#0891b2" },
  { id: "proposal_sent", title: "Proposal Sent", color: "#b45309" },
  { id: "follow_up", title: "Follow Up", color: "#7c3aed" },
  { id: "contract_signed", title: "Contract Signed", color: "#15803d" },
  { id: "kickoff", title: "Kickoff", color: "#0e7490" },
  { id: "in_progress", title: "In Progress", color: "#4f46e5" },
  { id: "review", title: "Review", color: "#be123c" },
  { id: "project_done", title: "Project Done", color: "#166534" },
];

export const PROJECT_COLUMNS: Column[] = [
  { id: "project_brief", title: "Project Brief", color: "#64748b" },
  { id: "project_planning", title: "Planning", color: "#2563eb" },
  { id: "project_kickoff", title: "Kickoff", color: "#0f766e" },
  { id: "project_build", title: "Build", color: "#4f46e5" },
  { id: "project_qa", title: "QA / Review", color: "#b45309" },
  { id: "client_approval", title: "Client Approval", color: "#7c3aed" },
  { id: "project_delivered", title: "Delivered", color: "#0891b2" },
  { id: "project_closed", title: "Closed", color: "#15803d" },
];

export const ROLES = ["admin", "manager", "owner", "viewer"] as const;

export const NAV_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "projects", label: "Projects" },
  { id: "activity", label: "Activity" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "approvals", label: "Approvals" },
  { id: "focus", label: "Focus" },
  { id: "team", label: "Team" },
  { id: "pricing", label: "Pricing" },
  { id: "profile", label: "My Profile" },
] as const;

export const ADMIN_BOOTSTRAP_EMAILS = ["iseo6lu@gmail.com", "iseolu6@gmail.com"];

export const SERVICE_UNITS = ["flat", "hourly", "per seat", "monthly"];

export const FOCUS_COLUMNS: Column[] = [
  { id: "overdue", title: "Overdue", color: "#be123c" },
  { id: "soon", title: "Next 7 days", color: "#b45309" },
  { id: "later", title: "Later", color: "#0f766e" },
];

export interface CompanyType {
  id: string;
  label: string;
  description: string;
  defaultFeatures: string[];
}

export const COMPANY_TYPES: CompanyType[] = [
  {
    id: "b2b",
    label: "B2B",
    description: "Business-to-business sales and client management",
    defaultFeatures: ["overview", "projects", "activity", "documents", "messages", "approvals", "focus", "team", "pricing", "profile"],
  },
  {
    id: "b2c",
    label: "B2C",
    description: "Business-to-consumer service delivery",
    defaultFeatures: ["overview", "pipeline", "activity", "documents", "messages", "focus", "profile"],
  },
  {
    id: "agency",
    label: "Agency",
    description: "Full-service agency with client projects and pipeline",
    defaultFeatures: ["overview", "pipeline", "projects", "activity", "documents", "messages", "approvals", "focus", "team", "pricing", "profile"],
  },
  {
    id: "saas",
    label: "SaaS",
    description: "Software-as-a-Service customer operations",
    defaultFeatures: ["overview", "projects", "activity", "documents", "messages", "approvals", "focus", "team", "pricing", "profile"],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Multi-vendor marketplace management",
    defaultFeatures: ["overview", "pipeline", "projects", "activity", "documents", "messages", "approvals", "focus", "team", "profile"],
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    description: "Non-profit organisation donor and grant tracking",
    defaultFeatures: ["overview", "projects", "activity", "documents", "messages", "focus", "team", "profile"],
  },
  {
    id: "other",
    label: "Other",
    description: "Custom CRM setup — toggle features as needed",
    defaultFeatures: ["overview", "pipeline", "projects", "activity", "documents", "messages", "approvals", "focus", "team", "pricing", "profile"],
  },
];

export const FEATURE_LABELS: Record<string, string> = {
  overview: "Overview Dashboard",
  pipeline: "Pipeline Board",
  projects: "Project Delivery",
  activity: "Daily Activities",
  documents: "Documents",
  messages: "Messages",
  approvals: "Approvals Queue",
  focus: "Focus Queue",
  team: "Team Management",
  pricing: "Pricing Calculator",
  profile: "My Profile",
};
