import styles from "./GuestPage.module.css";

export default function GuestPage() {
  return (
    <div className={styles.page} data-light-bg>
      <h1 className={styles.title}>GUEST</h1>
      <p className={styles.sub}>준비 중입니다.</p>
    </div>
  );
}
