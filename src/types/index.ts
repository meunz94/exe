export interface Agent {
  id: string;
  name: string;
  description: string[];
  imageUrl: string;
  category: string;
  detail: AgentDetail;
}

export interface AgentProfile {
  codename: string;
  classification: string;
  attribute: string;
  "age & nationality": string;
  evaluation: string;
}

export interface AgentAbility {
  overview: string;
  skills: string[];
  berserkSign?: string;
}

export interface AgentAppearance {
  "height & build": string;
  "hair & eyes": string;
  outfit: string;
}

export interface AgentRelation {
  name: string;
  relation: string;
  description: string;
}

export interface AgentDetail {
  heroImageUrl: string;
  subtitle: string;
  title: string;
  descriptions: string[];
  profile: AgentProfile;
  ability: AgentAbility;
  appearance: AgentAppearance;
  relations: AgentRelation[];
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
  contentPath?: string;
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

export interface AuMember {
  name: string;
  role: string;
  imageUrl: string;
  descriptions: string[];
  note?: string;
}

export interface AuGalleryImage {
  url: string;
  caption?: string;
}

export interface AuItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePosition?: string;
  tags: string[];
  members: AuMember[];
  content: string;
  gallery?: AuGalleryImage[];
}

export interface AuPost {
  id: string;
  auId: string;
  title: string;
  date: string;
  preview: string;
  contentPath?: string;
}

export interface AuPostWithContent extends AuPost {
  content: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  category: string;
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
  synopsis?: string;
}

export interface AppData {
  sidebarItems: SidebarItem[];
  agents: Agent[];
  posts: Post[];
  boards: Board[];
  notices: Notice[];
  au: AuItem[];
  auPosts: AuPost[];
  playlist: PlaylistItem[];
  timeline: TimelineEvent[];
  disciplinary: DisciplinaryRecord[];
  gallery: GalleryImage[];
}
