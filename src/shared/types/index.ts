export type UserRole = 'student' | 'professor' | 'admin';

export type Page = 'dashboard' | 'chat' | 'tasks' | 'members' | 'deliverables' | 'settings' | 'groups' | 'users' | 'projects' | 'stats';

export interface Deliverable {
  id: number;
  title: string;
  type: 'PDF' | 'DOC' | 'ZIP' | 'LINK';
  date: string;
  status: 'SUBMITTED' | 'PENDING' | 'LATE';
  size?: string;
}

export interface GroupDeliverables {
  groupName: string;
  deliverables: Deliverable[];
}

export interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  cne: string;
  cin: string;
  linkedin: string;
  github: string;
  avatar: string;
}

export interface Project {
  id: number;
  title: string;
  category: string;
  progress: number;
  date: string;
  timeLeft: string;
  color: string;
}

export interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  avatar: string;
}

export interface Task {
  id: number;
  title: string;
  assignee: string;
  status: 'DONE' | 'PENDING' | 'URGENT';
  date: string;
  comments: number;
  likes: number;
}

export interface TaskColumn {
  title: string;
  subtitle: string;
  tasks: Task[];
}
