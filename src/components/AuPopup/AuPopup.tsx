import { useEffect, useCallback, useState } from "react";
import type { AuItem, AuPost } from "../../types";
import { publicUrl, displayDate } from "../../utils/publicUrl";
import styles from "./AuPopup.module.css";

interface AuPopupProps {
  item: AuItem;
  posts: AuPost[];
  loadingAuPostId: string | null;
  onPostClick: (post: AuPost) => void;
  onClose: () => void;
}

export default function AuPopup({ item, posts, loadingAuPostId, onPostClick, onClose }: AuPopupProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const gallery = item.gallery ?? [];

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxIdx !== null) {
          setLightboxIdx(null);
        } else {
          onClose();
        }
      }
      if (lightboxIdx !== null && gallery.length > 1) {
        if (e.key === "ArrowLeft") setLightboxIdx((i) => (i! - 1 + gallery.length) % gallery.length);
        if (e.key === "ArrowRight") setLightboxIdx((i) => (i! + 1) % gallery.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, lightboxIdx, gallery.length]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleScrollAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className={styles.overlay} data-dark-bg onClick={handleOverlayClick}>
      <div className={styles.popupScroll} onClick={handleScrollAreaClick}>
        <div className={styles.popup} data-light-bg>
          <div className={styles.hero} data-dark-bg>
            <div
              className={styles.heroBackground}
              style={item.imageUrl ? {
                backgroundImage: `url(${publicUrl(item.imageUrl)})`,
                backgroundSize: "cover",
                backgroundPosition: item.imagePosition ?? "center",
              } : undefined}
            />
            <div className={styles.heroGradient} />
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
            <div className={styles.heroContent}>
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <h2 className={styles.title}>{item.title}</h2>
              <p className={styles.subtitle}>{item.description}</p>
            </div>
          </div>

          <div className={styles.membersSection}>
            <h3 className={styles.sectionTitle}>PROFILE</h3>
            <div className={styles.membersList}>
              {item.members.map((member, idx) => (
                <div key={idx} className={styles.memberCard}>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberRole}>{member.role}</span>
                    <span className={styles.memberName}>{member.name}</span>
                    <div className={styles.memberDescs}>
                      {member.descriptions.map((desc, i) => (
                        <p key={i} className={styles.memberDesc}>{desc}</p>
                      ))}
                    </div>
                  </div>
                  {member.note && (
                    <div className={styles.memberNote}>
                      <p className={styles.memberNoteText}>{member.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.contentSection}>
            <h3 className={styles.sectionTitle}>ABOUT</h3>
            <p className={styles.content}>{item.content}</p>
          </div>

          {item.quotes && item.quotes.length > 0 && (
            <div className={styles.quotesSection}>
              <h3 className={styles.sectionTitle}>QUOTES</h3>
              <div className={styles.quotesList}>
                {item.quotes.map((q, i, arr) => {
                  const isRight = q.memberIndex === 1;
                  const speaker = item.members[q.memberIndex]?.name;
                  const prevSpeakerIndex = i > 0 ? arr[i - 1].memberIndex : null;
                  const showName = speaker && prevSpeakerIndex !== q.memberIndex;
                  return (
                    <div
                      key={i}
                      className={isRight ? styles.quoteRowRight : styles.quoteRowLeft}
                    >
                      {showName && <span className={styles.quoteName}>{speaker}</span>}
                      <div className={isRight ? styles.bubbleRight : styles.bubbleLeft}>
                        {q.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.archiveSection}>
            <h3 className={styles.sectionTitle}>ARCHIVE</h3>
            {posts.length === 0 ? (
              <p className={styles.archiveEmpty}>등록된 게시글이 없습니다.</p>
            ) : (
              <div className={styles.archiveList}>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className={
                      loadingAuPostId === post.id
                        ? styles.archiveItemLoading
                        : styles.archiveItem
                    }
                    onClick={() => onPostClick(post)}
                  >
                    <div className={styles.archiveItemHeader}>
                      <span className={styles.archiveItemTitle}>{post.title}</span>
                      <span className={styles.archiveItemDate}>{displayDate(post.date)}</span>
                    </div>
                    <p className={styles.archiveItemPreview}>{post.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.gallerySection}>
            <h3 className={styles.sectionTitle}>GALLERY</h3>
            {gallery.length === 0 ? (
              <p className={styles.galleryEmpty}>등록된 이미지가 없습니다.</p>
            ) : (
              <div className={styles.galleryGrid}>
                {gallery.map((img, idx) => (
                  <div
                    key={idx}
                    className={styles.galleryThumb}
                    onClick={() => setLightboxIdx(idx)}
                  >
                    <img src={publicUrl(img.url)} alt={img.caption ?? ""} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxIdx !== null && gallery[lightboxIdx] && (
        <div className={styles.lightbox} data-dark-bg onClick={() => setLightboxIdx(null)}>
          {gallery.length > 1 && (
            <button
              className={styles.lbPrev}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((i) => (i! - 1 + gallery.length) % gallery.length);
              }}
            >
              ‹
            </button>
          )}
          <div className={styles.lbCenter} onClick={(e) => e.stopPropagation()}>
            <img
              src={publicUrl(gallery[lightboxIdx].url)}
              alt={gallery[lightboxIdx].caption ?? ""}
              className={styles.lbImage}
            />
            {gallery[lightboxIdx].caption && (
              <p className={styles.lbCaption}>{gallery[lightboxIdx].caption}</p>
            )}
            <span className={styles.lbCounter}>
              {lightboxIdx + 1} / {gallery.length}
            </span>
          </div>
          {gallery.length > 1 && (
            <button
              className={styles.lbNext}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((i) => (i! + 1) % gallery.length);
              }}
            >
              ›
            </button>
          )}
          <button className={styles.lbClose} onClick={() => setLightboxIdx(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
