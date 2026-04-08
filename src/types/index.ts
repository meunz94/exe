export interface Employee {
  id: string;
  name: string;
  description: string[];
  imageUrl: string;
  category: string;
  detail: EmployeeDetail;
}

export interface EmployeeProfile {
  codename: string;
  classification: string;
  attribute: string;
  "age & nationality": string;
  evaluation: string;
}

export interface EmployeeAbility {
  overview: string;
  skills: string[];
  berserkSign?: string;
}

export interface EmployeeAppearance {
  "height & build": string;
  "hair & eyes": string;
  outfit: string;
}

export interface EmployeeRelation {
  name: string;
  relation: string;
  description: string;
}

export interface EmployeeDetail {
  heroImageUrl: string;
  subtitle: string;
  title: string;
  descriptions: string[];
  profile: EmployeeProfile;
  ability: EmployeeAbility;
  appearance: EmployeeAppearance;
  relations: EmployeeRelation[];
}

export interface Post {
  id: string;
  title: string;
  date: string;
  preview: string;
  author: string;
  category: string;
  boardId: string;
  imageUrl?: string;
}

export interface PostWithContent extends Post {
  content: string;
}

export interface Board {
  id: string;
  name: string;
  postCount: number;
  category: string;
}

export interface Notice {
  id: string;
  text: string;
  category?: string;
}

export interface PlaylistItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  category: string;
  lyrics?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  category: string;
}

export interface PortfolioMember {
  name: string;
  role: string;
  imageUrl: string;
  descriptions: string[];
  note?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  members: PortfolioMember[];
  content: string;
}

export interface DisciplinaryRecord {
  id: string;
  subject: string;
  reason: string;
  date: string;
  level: string;
  category: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  category: string;
  page?: string;
}

export interface AppData {
  sidebarItems: SidebarItem[];
  employees: Employee[];
  posts: Post[];
  boards: Board[];
  notices: Notice[];
  portfolio: PortfolioItem[];
  playlist: PlaylistItem[];
  timeline: TimelineEvent[];
  disciplinary: DisciplinaryRecord[];
}
