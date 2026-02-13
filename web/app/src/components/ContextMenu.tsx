import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export type MenuItem =
  | { type: "action"; label: string; shortcut?: string; onClick: () => void; disabled?: boolean }
  | { type: "separator" }
  | { type: "submenu"; label: string; children: MenuItem[] };

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

interface SubMenuState {
  index: number;
  x: number;
  y: number;
}

function MenuList({
  items,
  x,
  y,
  onClose,
  depth,
}: {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
  depth: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<SubMenuState | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Clamp to viewport on mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) {
      left = depth > 0 ? x - rect.width : window.innerWidth - rect.width;
    }
    if (top + rect.height > window.innerHeight) {
      top = window.innerHeight - rect.height;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    setPosition({ left, top });
  }, [x, y, depth]);

  const handleItemMouseEnter = useCallback(
    (item: MenuItem, index: number, e: React.MouseEvent) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (item.type === "submenu") {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        hoverTimerRef.current = setTimeout(() => {
          setSubmenu({ index, x: rect.right, y: rect.top });
        }, 200);
      } else {
        setSubmenu(null);
      }
    },
    [],
  );

  const handleItemMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        background: "#303030",
        border: "1px solid #1a1a1a",
        borderRadius: 4,
        padding: "3px 0",
        minWidth: 180,
        zIndex: 10000 + depth,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
      }}
    >
      {items.map((item, i) => {
        if (item.type === "separator") {
          return (
            <div
              key={`sep-${i}`}
              role="separator"
              style={{
                borderTop: "1px solid #484848",
                margin: "3px 0",
              }}
            />
          );
        }

        if (item.type === "submenu") {
          return (
            <div
              key={item.label}
              role="menuitem"
              aria-haspopup="true"
              style={{
                padding: "6px 24px",
                color: submenu?.index === i ? "#fff" : "#d0d0d0",
                background: submenu?.index === i ? "#4b6eaf" : "transparent",
                cursor: "default",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}
              onMouseEnter={(e) => handleItemMouseEnter(item, i, e)}
              onMouseLeave={handleItemMouseLeave}
            >
              <span>{item.label}</span>
              <span style={{ marginLeft: 16, fontSize: 10 }}>&#9654;</span>
              {submenu?.index === i && (
                <MenuList
                  items={item.children}
                  x={submenu.x}
                  y={submenu.y}
                  onClose={onClose}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        // action
        const disabled = item.disabled ?? false;
        return (
          <div
            key={item.label}
            role="menuitem"
            aria-disabled={disabled}
            style={{
              padding: "6px 24px",
              color: disabled ? "#606060" : "#d0d0d0",
              cursor: disabled ? "default" : "default",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLElement).style.background = "#4b6eaf";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }
              handleItemMouseEnter(item, i, e);
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = disabled
                ? "#606060"
                : "#d0d0d0";
              handleItemMouseLeave();
            }}
            onClick={() => {
              if (!disabled) {
                item.onClick();
                onClose();
              }
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ marginLeft: 24, color: "#808080", fontSize: 12 }}>
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[role='menu']")) {
        onClose();
      }
    };
    // Use a timeout so the opening right-click doesn't immediately close
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleMouseDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  return createPortal(
    <MenuList items={items} x={x} y={y} onClose={onClose} depth={0} />,
    document.body,
  );
}
