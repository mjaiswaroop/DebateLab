"use client";

import React from "react";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delayMs?: number;
  staggerMs?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  className = "",
  delayMs = 200,
  staggerMs = 35,
}) => {
  const words = text.split(" ");

  return (
    <span className={`inline ${className}`}>
      {words.map((word, idx) => (
        <span
          key={idx}
          className="animate-word-entry"
          style={{
            animationDelay: `${(delayMs + idx * staggerMs) / 1000}s`,
            marginRight: "0.28em",
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
};
