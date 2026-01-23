/**
 * Type stub for sharp module.
 * Sharp is an optional dependency - when not installed, the Rust backend is used.
 */
declare module "sharp" {
  interface SharpOptions {
    failOnError?: boolean;
  }

  interface Metadata {
    width?: number;
    height?: number;
    orientation?: number;
    format?: string;
  }

  interface ResizeOptions {
    fit?: string;
    width?: number;
    height?: number;
    withoutEnlargement?: boolean;
  }

  interface JpegOptions {
    quality?: number;
    mozjpeg?: boolean;
  }

  interface Sharp {
    metadata(): Promise<Metadata>;
    rotate(): Sharp;
    resize(width?: number, height?: number, options?: ResizeOptions): Sharp;
    resize(options?: ResizeOptions): Sharp;
    jpeg(options?: JpegOptions): Sharp;
    toBuffer(): Promise<Buffer>;
  }

  function sharp(input: Buffer, options?: SharpOptions): Sharp;

  export = sharp;
}
