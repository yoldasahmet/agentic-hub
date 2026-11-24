import {
  Activity,
  Bot,
  GitPullRequest,
  Inbox,
  type LucideIcon,
  MessageSquare,
  Settings,
  SquareKanban,
  Workflow,
} from "lucide-react";

export type NavItem = {
  path:
    | "/chats"
    | "/agents"
    | "/workflows"
    | "/runs"
    | "/inbox"
    | "/github"
    | "/jira"
    | "/settings";
  label: string;
  icon: LucideIcon;
  /** One sentence for the empty state until the feature lands. */
  description: string;
};

export const navItems: NavItem[] = [
  {
    path: "/chats",
    label: "Chats",
    icon: MessageSquare,
    description: "Chat with the app, an agent, or a workflow.",
  },
  {
    path: "/agents",
    label: "Agents",
    icon: Bot,
    description: "Create agents with their own prompts, models, inputs, and outputs.",
  },
  {
    path: "/workflows",
    label: "Workflows",
    icon: Workflow,
    description: "Compose agents into graphs with branches, loops, and human gates.",
  },
  {
    path: "/runs",
    label: "Runs",
    icon: Activity,
    description: "Every agent, workflow, and chat run, with its full state history.",
  },
  {
    path: "/inbox",
    label: "Inbox",
    icon: Inbox,
    description: "Gates waiting for you and runs that failed, in one place.",
  },
  {
    path: "/github",
    label: "GitHub",
    icon: GitPullRequest,
    description: "Repositories, issues, and pull requests, for you and your agents.",
  },
  {
    path: "/jira",
    label: "Jira",
    icon: SquareKanban,
    description: "Projects and issues that can start workflows.",
  },
];

export const settingsItem: NavItem = {
  path: "/settings",
  label: "Settings",
  icon: Settings,
  description: "Secrets, providers, and the database.",
};
