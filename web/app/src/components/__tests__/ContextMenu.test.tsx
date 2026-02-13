import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { ContextMenu, type MenuItem } from "../ContextMenu";

describe("ContextMenu", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onClick: ReturnType<typeof vi.fn>;

  const baseItems: MenuItem[] = [
    { type: "action", label: "Cut", shortcut: "Ctrl+X", onClick: vi.fn() },
    { type: "action", label: "Copy", shortcut: "Ctrl+C", onClick: vi.fn() },
    { type: "separator" },
    { type: "action", label: "Paste", onClick: vi.fn() },
    { type: "action", label: "Disabled Item", onClick: vi.fn(), disabled: true },
    {
      type: "submenu",
      label: "Mirror",
      children: [
        { type: "action", label: "X", onClick: vi.fn() },
        { type: "action", label: "Y", onClick: vi.fn() },
      ],
    },
  ];

  beforeEach(() => {
    onClose = vi.fn();
    onClick = vi.fn();
    // Reset all click handlers
    for (const item of baseItems) {
      if (item.type === "action") {
        (item.onClick as ReturnType<typeof vi.fn>).mockClear();
      }
      if (item.type === "submenu") {
        for (const child of item.children) {
          if (child.type === "action") {
            (child.onClick as ReturnType<typeof vi.fn>).mockClear();
          }
        }
      }
    }
  });

  function renderMenu(items?: MenuItem[], x = 100, y = 100) {
    return render(
      <ContextMenu x={x} y={y} items={items ?? baseItems} onClose={onClose} />,
    );
  }

  it("renders at the correct position", () => {
    renderMenu();
    const menu = document.querySelector("[role='menu']") as HTMLElement;
    expect(menu).toBeTruthy();
    // Position is set via style
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("100px");
  });

  it("shows correct items for edit mode items", () => {
    const editItems: MenuItem[] = [
      { type: "action", label: "Extrude Faces", shortcut: "E", onClick: vi.fn() },
      { type: "action", label: "Subdivide", shortcut: "W", onClick: vi.fn() },
      { type: "separator" },
      { type: "action", label: "Delete Faces", shortcut: "X", onClick: vi.fn() },
    ];
    renderMenu(editItems);
    const menuItems = document.querySelectorAll("[role='menuitem']");
    expect(menuItems.length).toBe(3);
    expect(menuItems[0].textContent).toContain("Extrude Faces");
    expect(menuItems[1].textContent).toContain("Subdivide");
    expect(menuItems[2].textContent).toContain("Delete Faces");
  });

  it("shows correct items for object mode items", () => {
    const objectItems: MenuItem[] = [
      { type: "action", label: "Shade Smooth", onClick: vi.fn() },
      { type: "action", label: "Shade Flat", onClick: vi.fn() },
      { type: "separator" },
      { type: "action", label: "Delete", shortcut: "X", onClick: vi.fn() },
    ];
    renderMenu(objectItems);
    const menuItems = document.querySelectorAll("[role='menuitem']");
    expect(menuItems.length).toBe(3);
    expect(menuItems[0].textContent).toContain("Shade Smooth");
    expect(menuItems[1].textContent).toContain("Shade Flat");
    expect(menuItems[2].textContent).toContain("Delete");
  });

  it("click on item fires callback and closes menu", () => {
    renderMenu();
    const menuItems = document.querySelectorAll("[role='menuitem']");
    fireEvent.click(menuItems[0]); // "Cut"
    expect((baseItems[0] as unknown as { onClick: ReturnType<typeof vi.fn> }).onClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("separator renders as divider", () => {
    renderMenu();
    const separators = document.querySelectorAll("[role='separator']");
    expect(separators.length).toBe(1);
  });

  it("hover on submenu shows children after delay", async () => {
    vi.useFakeTimers();
    renderMenu();
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const submenuItem = Array.from(menuItems).find((el) =>
      el.textContent?.includes("Mirror"),
    );
    expect(submenuItem).toBeTruthy();

    fireEvent.mouseEnter(submenuItem!);

    // Before delay, submenu should not be visible
    let submenus = document.querySelectorAll("[role='menu']");
    expect(submenus.length).toBe(1); // Only root menu

    // After delay, submenu appears
    act(() => { vi.advanceTimersByTime(250); });
    submenus = document.querySelectorAll("[role='menu']");
    expect(submenus.length).toBe(2); // Root + submenu

    // Check submenu has X and Y items
    const allItems = document.querySelectorAll("[role='menuitem']");
    const labels = Array.from(allItems).map((el) => el.textContent?.trim());
    expect(labels).toContain("X");
    expect(labels).toContain("Y");

    vi.useRealTimers();
  });

  it("Escape closes menu", () => {
    renderMenu();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("click outside closes menu", async () => {
    vi.useFakeTimers();
    renderMenu();

    // Advance past the setTimeout(0) guard
    act(() => { vi.advanceTimersByTime(10); });

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("disabled items are not clickable", () => {
    renderMenu();
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const disabledItem = Array.from(menuItems).find((el) =>
      el.textContent?.includes("Disabled Item"),
    );
    expect(disabledItem).toBeTruthy();
    expect(disabledItem?.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(disabledItem!);
    expect((baseItems[4] as unknown as { onClick: ReturnType<typeof vi.fn> }).onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shortcuts display correctly", () => {
    renderMenu();
    const menuItems = document.querySelectorAll("[role='menuitem']");
    expect(menuItems[0].textContent).toContain("Ctrl+X");
    expect(menuItems[1].textContent).toContain("Ctrl+C");
  });

  it("menu clamped to viewport bounds", () => {
    // Place menu at bottom-right corner
    renderMenu(baseItems, window.innerWidth + 100, window.innerHeight + 100);
    const menu = document.querySelector("[role='menu']") as HTMLElement;
    expect(menu).toBeTruthy();
    // Position should be clamped (exact values depend on menu size)
    const left = parseInt(menu.style.left);
    const top = parseInt(menu.style.top);
    expect(left).toBeLessThanOrEqual(window.innerWidth);
    expect(top).toBeLessThanOrEqual(window.innerHeight);
  });

  it("renders as portal to document.body", () => {
    const { container } = renderMenu();
    // The menu should NOT be inside the container — it's a portal
    const menuInContainer = container.querySelector("[role='menu']");
    expect(menuInContainer).toBeNull();
    // But it should exist in document.body
    const menuInBody = document.querySelector("[role='menu']");
    expect(menuInBody).toBeTruthy();
  });

  it("submenu arrow character is shown", () => {
    renderMenu();
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const submenuItem = Array.from(menuItems).find((el) =>
      el.getAttribute("aria-haspopup") === "true",
    );
    expect(submenuItem).toBeTruthy();
    // Should contain the right-pointing triangle
    expect(submenuItem?.textContent).toContain("\u25B6");
  });
});
