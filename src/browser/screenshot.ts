export async function normalizeBrowserScreenshot(
  buffer: Buffer,
  opts?: {
    maxSide?: number;
    maxBytes?: number;
  },
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  // Normalize constraints with fallbacks
  const maxSide = Math.max(1, Math.round(opts?.maxSide ?? DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE));
  const maxBytes = Math.max(1, Math.round(opts?.maxBytes ?? DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES));

  const meta = await getImageMetadata(buffer);
  const width = Number(meta?.width ?? 0);
  const height = Number(meta?.height ?? 0);
  
  // OPTIMIZATION: Early exit if the image is already within constraints.
  // This prevents unnecessary CPU cycles on complaint images.
  const isWithinByteLimit = buffer.byteLength <= maxBytes;
  const isWithinDimLimit = width <= maxSide && height <= maxSide;

  if (isWithinByteLimit && isWithinDimLimit) {
    return { buffer, contentType: "image/jpeg" };
  }

  // ALGORITHM: Deterministic O(1) Scaling
  // Replaces legacy iterative resizing loop. We calculate the target scale factor
  // mathematically based on the square root law of area-to-byte proportionality.
  
  // 1. Calculate constraint based on linear dimensions
  const dimensionScale = Math.min(1, maxSide / Math.max(width, height));
  
  // 2. Calculate constraint based on byte budget
  // Since Image Area ∝ File Size, the Linear Scale Factor ∝ Sqrt(TargetBytes / CurrentBytes)
  const byteScale = Math.sqrt(maxBytes / buffer.byteLength);
  
  // 3. Determine the limiting factor and apply a 5% safety buffer for compression variance
  const targetScale = Math.min(dimensionScale, byteScale) * 0.95;

  const newWidth = Math.max(1, Math.round(width * targetScale));
  const newHeight = Math.max(1, Math.round(height * targetScale));

  // EXECUTION: Single-pass resize operation
  const newBuffer = await resizeToJpeg(buffer, {
    width: newWidth,
    height: newHeight,
    quality: 80, // Balanced for VLM ingestion
  });

  return { buffer: newBuffer, contentType: "image/jpeg" };
}
