import { useEffect, useRef } from "react";
import { createTimeline } from "animejs";
import "../../LoadingScreen.css";

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !dotsRef.current) {
      return;
    }
    const dots = Array.from(dotsRef.current.querySelectorAll<HTMLElement>(".dot"));
    const anims = dots.map((dot, i) => {
      return createTimeline({ loop: true })
        .add(dot, {
          translateY: -30,
          duration: 400,
          ease: "outSine",
          delay: i * 150,
        })
        .add(dot, {
          translateY: 0,
          duration: 400,
          ease: "inSine",
        });
    });
    return () => {
      console.log("LoadingScreen cleanup pausing animations");
      anims.forEach((a) => {
        a.pause();
      });
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="loading-overlay">
      <div ref={dotsRef} className="loading-dots-container">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    </div>
  );
}
