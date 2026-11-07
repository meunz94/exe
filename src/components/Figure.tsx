import { publicUrl } from "../lib/url";

/**
 * 인물 이미지. src 가 없으면 디자인의 캡슐 자리표시(윗부분 둥근 사각형 + 라벨)를 그린다.
 * 바닥의 흐린 타원 그림자까지 포함.
 */
export function Figure({
  src,
  label,
  width,
  height,
  radius,
  alt = false,
  labelAt = "bottom",
  ground = true,
  className,
  style,
}: {
  src?: string;
  label: string;
  width: number;
  height: number;
  radius?: number;
  alt?: boolean;
  labelAt?: "top" | "bottom";
  ground?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const r = radius ?? width / 2;
  const has = !!src;
  return (
    <span className={`figure ${className ?? ""}`} style={style}>
      <span
        className={`figure-shape ${alt ? "alt" : ""} ${has ? "has-img" : ""}`}
        style={{
          width,
          height,
          borderRadius: `${r}px ${r}px 20px 20px`,
          alignItems: labelAt === "top" ? "flex-start" : "flex-end",
          padding: labelAt === "top" ? `${Math.round(height * 0.28)}px 0 0` : "0 0 20px",
        }}
      >
        {has ? <img src={publicUrl(src!)} alt={label} /> : label}
      </span>
      {ground && (
        <span
          aria-hidden="true"
          className="figure-ground"
          style={{ width: Math.round(width * 0.82), height: 14, marginTop: 4 }}
        />
      )}
    </span>
  );
}
