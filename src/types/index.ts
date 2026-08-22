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

export interface AgentTmi {
  title: string;
  text: string;
}

export interface AgentDetail {
  heroImageUrl: string;
  subtitle: string;
  title: string;
  descriptions: string[];
  profile: AgentProfile;
  ability: AgentAbility;
  appearance: AgentAppearance;
  tmi?: AgentTmi[];
  relations: AgentRelation[];
}

export interface Post {
  id: string;
  title: string;
  date: string;
  preview: string;
  author: string;
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
}

export interface PlaylistItem {
  id: string;
  title: string;
  artist: string;
  lyrics?: string;
  /** YouTube id. Present = the disc is playable; absent = display only. */
  videoId?: string;
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

export interface AuQuote {
  memberIndex: number;
  text: string;
}

export interface AuItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePosition?: string;
  tags: string[];
  section?: "main" | "sub";
  members: AuMember[];
  content: string;
  gallery?: AuGalleryImage[];
  quotes?: AuQuote[];
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
  /** Height-capped webp emitted by scripts/generate-gallery.mjs. */
  thumbUrl?: string;
  caption?: string;
  category: string;
}

export interface YoutubeVideo {
  id: string;
  videoId: string;
  title: string;
  category: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  category: string;
  page?: string;
  synopsis?: string;
  /** Adds the AU tab to this entry — the alternate-universe set belongs to it. */
  hasAu?: boolean;
}

export interface AppData {
  sidebarItems: SidebarItem[];
  agents: Agent[];
  posts: Post[];
  boards: Board[];
  au: AuItem[];
  auPosts: AuPost[];
  playlist: PlaylistItem[];
  gallery: GalleryImage[];
  youtube: YoutubeVideo[];
}
