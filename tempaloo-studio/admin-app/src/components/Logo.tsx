import type { CSSProperties } from 'react';

interface Props {
  size?:  number;
  style?: CSSProperties;
  className?: string;
}

/**
 * Tempaloo iconmark — taken from logos/logo templaoo (1).svg.
 * fill = currentColor so it inherits ink from whatever element holds it.
 */
export function LogoMark({ size = 28, style, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1563 1563"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <path
        transform="translate(3,259)"
        d="m0 0h385l33 2 34 4 32 5 28 6 26 7 25 8 24 9 26 11 25 12 21 11 21 12 19 12 20 14 16 12 9 7 10 8 14 12 24 22 8 8 2 1v2h2l7 8 11 11 7 8 10 11 9 11 12 15 14 19 14 20 17 28 9 16 15 29 12 26 13 34 12 36 10 41 7 36 4 31 3 37v56l-4 44-4 27-7 34-10 37-13 38-11 27-11 25-12 26-13 28-14 30-16 34-11 24-1 1h-448l-1-2 13-28 17-35 13-28 16-34 17-36 16-34 9-20 18-38 16-34 19-41 17-36 16-34 12-26 19-40 16-34 13-28 18-38 13-28 15-31 3-8-480-1-5-6-13-22-16-28-9-15-17-29-15-26-10-17-12-21-13-22-15-26-8-13-11-20-14-23-15-26-16-27-15-26-10-17-10-18-6-11z"
        fill="currentColor"
      />
      <path
        transform="translate(884,259)"
        d="m0 0h446l8 13 16 28 13 22 17 29 16 28 15 25 13 22 13 23 17 29 17 28 15 27 14 24 17 29 13 22 14 24 10 18 2 4v4h-234l-33-2-27-4-23-5-33-10-21-8-20-9-28-15-17-11-17-12-12-9-10-9-8-7-7-7-8-7-9-9-7-8-11-13-10-13-13-18-13-21-12-21-15-26-12-21-12-20-11-19-34-58-20-34z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Compact wordmark used in the admin header. Uses our heading font
 * for the brand name, which is the same family the templates serve.
 */
export function LogoWordmark({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={size} />
      <span style={{
        fontFamily: 'var(--tsa-font-heading)',
        fontWeight: 500,
        fontSize:   18,
        letterSpacing: '-0.02em',
        color:      'var(--tsa-text)',
      }}>
        Tempaloo Studio
      </span>
    </span>
  );
}
