import { useRef, useState, useCallback } from "react";
import type { Employee } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import EmployeeCard3D from "./EmployeeCard3D";
import styles from "./EmployeeCard.module.css";

interface EmployeeCardProps {
  employee: Employee;
  onClick: (employee: Employee) => void;
}

export default function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotation({ x: y * 12, y: -x * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotation({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  return (
    <div
      ref={cardRef}
      className={styles.cardWrapper}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={() => onClick(employee)}
      style={{
        transform: `perspective(800px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.02 : 1})`,
      }}
    >
      <div className={styles.card}>
        <div className={styles.canvasArea}>
          {employee.imageUrl ? (
            <img
              className={styles.photo}
              src={publicUrl(employee.imageUrl)}
              alt={employee.name}
            />
          ) : (
            <EmployeeCard3D rotationX={rotation.x} rotationY={rotation.y} />
          )}
        </div>
        <div className={styles.info}>
          <h3 className={styles.name}>{employee.name}</h3>
          {employee.description.map((desc, i) => (
            <p key={i} className={styles.description}>
              {desc}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
