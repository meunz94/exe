import { useCallback, useMemo, useState } from "react";
import type { AuItem, AuPost } from "../types";
import type { Route } from "../utils/hashRouter";
import AuPopup from "../components/AuPopup/AuPopup";
import { publicUrl } from "../utils/publicUrl";
import styles from "./AuPage.module.css";

interface AuPageProps {
  items: AuItem[];
  auPosts: AuPost[];
  selectedAuId: string | null;
  loadingAuPostId: string | null;
  navigate: (route: Route, replace?: boolean) => void;
  onBack: () => void;
}

const FILTER_TAGS = ["현대", "시대극", "장르 기반", "NSFW", "고등학교", "대학교", "연예계"] as const;

export default function AuPage({
  items,
  auPosts,
  selectedAuId,
  loadingAuPostId,
  navigate,
  onBack,
}: AuPageProps) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const selectedItem = useMemo(
    () => (selectedAuId ? items.find((i) => i.id === selectedAuId) ?? null : null),
    [items, selectedAuId]
  );

  const selectedPosts = useMemo(
    () =>
      selectedItem
        ? auPosts
            .filter((p) => p.auId === selectedItem.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [],
    [auPosts, selectedItem]
  );

  const filteredItems = useMemo(() => {
    const base =
      activeTags.size === 0
        ? items
        : items.filter((item) => [...activeTags].every((t) => item.tags.includes(t)));
    return [...base].sort((a, b) => {
      const aMain = (a.section ?? "main") === "main" ? 0 : 1;
      const bMain = (b.section ?? "main") === "main" ? 0 : 1;
      return aMain - bMain;
    });
  }, [items, activeTags]);

  const handleCardClick = useCallback(
    (item: AuItem) => {
      navigate({ page: "au-item", auId: item.id });
    },
    [navigate]
  );

  const handlePopupClose = useCallback(() => {
    navigate({ page: "au" }, true);
  }, [navigate]);

  const handlePostClick = useCallback(
    (post: AuPost) => {
      if (selectedAuId) {
        navigate({ page: "au-post", auId: selectedAuId, postId: post.id });
      }
    },
    [navigate, selectedAuId]
  );

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const renderCard = (item: AuItem) => (
    <div
      key={item.id}
      className={styles.card}
      onClick={() => handleCardClick(item)}
    >
      <div className={styles.cardImage}>
        {(item.section ?? "main") === "main" && (
          <span className={styles.loveBadge}>♥ RECOMMEND</span>
        )}
        {item.imageUrl ? (
          <img src={publicUrl(item.imageUrl)} alt={item.title} />
        ) : (
          <div className={styles.placeholder}>
            <svg className={styles.placeholderIcon} viewBox="0 0 32 32" width="40" height="40" fill="none">
              <path d="M16 28V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 16c0-7 7-12 12-8-2 5-7 8-12 8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M16 20c0-7-7-12-12-8 2 5 7 8 12 8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.cardDesc}>{item.description}</p>
        <div className={styles.tags}>
          {item.tags.map((tag) => (
            <span
              key={tag}
              className={`${styles.tag} ${activeTags.has(tag) ? styles.tagHighlight : ""}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← BACK
        </button>
        <h1 className={styles.title}>ANOTHER UNIVERSE</h1>
        <p className={styles.subtitle}>Archive of Memory Fragment</p>
      </header>

      <div className={styles.filterBar} role="group" aria-label="태그 필터">
        {FILTER_TAGS.map((tag) => {
          const isActive = activeTags.has(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ""}`}
              aria-pressed={isActive}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {filteredItems.length > 0 && (
        <div className={styles.gallery}>{filteredItems.map(renderCard)}</div>
      )}

      {items.length === 0 && (
        <div className={styles.empty}>
          아직 등록된 항목이 없습니다.
        </div>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <div className={styles.empty}>
          해당 태그에 맞는 항목이 없습니다.
        </div>
      )}

      {selectedItem && (
        <AuPopup
          item={selectedItem}
          posts={selectedPosts}
          loadingAuPostId={loadingAuPostId}
          onPostClick={handlePostClick}
          onClose={handlePopupClose}
        />
      )}
    </div>
  );
}
