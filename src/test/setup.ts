// jsdom doesn't implement layout. Give Ranges zero-size rects so selection code can run.
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() { return {}; } }) as DOMRect;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = rect;
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([rect()], { item: (i: number) => (i === 0 ? rect() : null) }) as unknown as DOMRectList;
}

// jsdom's Blob/File lack text() and arrayBuffer(); browsers have them.
if (!Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(this);
    });
  };
}
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(this);
    });
  };
}
