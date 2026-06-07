import React from "react";

export function HomeActionBtn({
  icon, active, activeClass, onClick
}: {
  icon: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
        active ? activeClass : "bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
      }`}
    >
      {icon}
    </button>
  );
}
