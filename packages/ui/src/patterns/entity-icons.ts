import {
  Bot,
  Brain,
  Bug,
  ClipboardList,
  Code,
  FileText,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  Hammer,
  Hand,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Tag,
  Terminal,
  Ticket,
  Wand,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * The icons users can pick for agents and workflows. A fixed map keeps the
 * bundle small and the CSP strict (no runtime icon loading).
 */
export const entityIcons: Record<string, LucideIcon> = {
  bot: Bot,
  brain: Brain,
  bug: Bug,
  "clipboard-list": ClipboardList,
  code: Code,
  "file-text": FileText,
  "flask-conical": FlaskConical,
  "git-branch": GitBranch,
  "git-pull-request": GitPullRequest,
  hand: Hand,
  hammer: Hammer,
  lightbulb: Lightbulb,
  "list-checks": ListChecks,
  "message-square": MessageSquare,
  rocket: Rocket,
  search: Search,
  shield: Shield,
  sparkles: Sparkles,
  tag: Tag,
  terminal: Terminal,
  ticket: Ticket,
  wand: Wand,
  workflow: Workflow,
  wrench: Wrench,
  zap: Zap,
};

export const entityIconNames = Object.keys(entityIcons);

export function entityIcon(name: string): LucideIcon {
  return entityIcons[name] ?? Bot;
}
