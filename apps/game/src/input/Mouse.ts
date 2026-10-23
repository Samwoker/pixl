/** Pointer state in canvas-local CSS pixels. */
export class Mouse {
  screenX = 0;
  screenY = 0;
  primaryDown = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('blur', this.onUp);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('blur', this.onUp);
  }

  private updatePosition(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.screenX = event.clientX - rect.left;
    this.screenY = event.clientY - rect.top;
  }

  private readonly onMove = (event: PointerEvent): void => {
    this.updatePosition(event);
  };

  private readonly onDown = (event: PointerEvent): void => {
    this.updatePosition(event);
    if (event.button === 0) this.primaryDown = true;
    this.canvas.focus();
  };

  private readonly onUp = (event?: Event): void => {
    if (!(event instanceof PointerEvent) || event.button === 0) this.primaryDown = false;
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };
}
